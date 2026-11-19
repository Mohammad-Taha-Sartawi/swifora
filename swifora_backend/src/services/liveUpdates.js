// Live updates for the dashboard and the mobile apps.
//
// Every write to the database (from any route, script or admin action) is
// picked up from a MongoDB change stream, so nothing has to remember to
// announce its changes:
//  * admins get `admin_update` { topics } and refresh the affected pages;
//  * the apps get small "something changed, reload it" events (ads,
//    available drivers, their own account, their earnings).
// Events are coalesced (debounced) so a burst of writes sends one message.
// Without a replica set (some test setups) the stream cannot start and the
// dashboard keeps its periodic refresh.

// Dashboard pages (data-page names) to refresh when a collection changes.
const COLLECTION_TOPICS = Object.freeze({
  orders: ['dashboard', 'orders', 'commissions', 'drivers', 'users', 'deletion-requests'],
  offers: ['dashboard', 'orders'],
  rejectedorders: ['orders'],
  users: ['dashboard', 'drivers', 'users', 'areas'],
  pendingproviders: ['dashboard', 'pending-providers'],
  reports: ['dashboard', 'driver-reports', 'user-reports'],
  commissionpayments: ['dashboard', 'commissions', 'drivers', 'deletion-requests'],
  commissionsettings: ['commissions'],
  ratings: ['drivers'],
  customerratings: ['users'],
  chatmessages: ['support-chat'],
  contactrequests: ['support-chat'],
  broadcastmessages: ['broadcast-drivers', 'broadcast-users'],
  ads: ['ads'],
  accountdeletionrequests: ['dashboard', 'deletion-requests'],
  adstats: ['ads'],
});

// User fields that change who can take orders (the customers' "drivers
// available now" figure).
const AVAILABILITY_FIELDS = Object.freeze([
  'isAvailable', 'blockedUntil', 'status', 'deleted',
  'area', 'governorate', 'governorateLevel', 'serviceTypes',
]);

// User fields shown in the app's own account (changed by an admin, say).
const ACCOUNT_FIELDS = Object.freeze([
  'fullName', 'phoneNumbers', 'phone', 'email', 'area', 'governorate',
  'governorateLevel', 'serviceTypes', 'licenseType', 'licenseNotAvailable',
  'isAvailable', 'status', 'publicId',
]);

const ADMIN_DELAY_MS = 1000;
const APP_DELAY_MS = Object.freeze({
  ads_changed: 2000,
  drivers_changed: 5000,
  account_changed: 1000,
  earnings_changed: 1000,
});

function changedFields(change) {
  const fields = change.updateDescription?.updatedFields || {};
  const removed = change.updateDescription?.removedFields || [];
  return [...Object.keys(fields), ...removed]
    // "phoneNumbers.0" -> "phoneNumbers"
    .map((field) => field.split('.')[0]);
}

function touches(change, list) {
  if (change.operationType !== 'update') return true;
  return changedFields(change).some((field) => list.includes(field));
}

/**
 * What one change-stream event should cause: dashboard topics and app
 * events. Pure, so it can be tested without a database.
 */
function planLiveEffects(change) {
  const collection = change?.ns?.coll;
  const adminTopics = [...(COLLECTION_TOPICS[collection] || [])];
  const appEvents = [];
  const id = change?.documentKey?._id?.toString?.() || '';

  if (collection === 'ads') {
    appEvents.push({ room: 'role:customer', event: 'ads_changed' });
    appEvents.push({ room: 'role:provider', event: 'ads_changed' });
  }

  if (collection === 'users') {
    if (touches(change, AVAILABILITY_FIELDS)) {
      appEvents.push({ room: 'role:customer', event: 'drivers_changed' });
    }
    if (id && change.operationType === 'update'
      && touches(change, ACCOUNT_FIELDS)) {
      appEvents.push({ room: `user:${id}`, event: 'account_changed' });
    }
  }

  if (collection === 'commissionsettings') {
    // E.g. the "commission due" card was shown/hidden for drivers.
    appEvents.push({ room: 'role:provider', event: 'earnings_changed' });
  }

  if (collection === 'commissionpayments') {
    const driverId = change.fullDocument?.driverId?.toString?.();
    if (driverId) {
      appEvents.push({ room: `user:${driverId}`, event: 'earnings_changed' });
    }
  }

  return { adminTopics, appEvents };
}

/** Coalesces bursts: one call per key per [delay]. */
function createDebouncer(setTimer = setTimeout, clearTimer = clearTimeout) {
  const pending = new Map();
  return {
    schedule(key, delay, merge, fire) {
      const entry = pending.get(key) || { value: undefined, timer: null };
      entry.value = merge(entry.value);
      if (!entry.timer) {
        entry.timer = setTimer(() => {
          pending.delete(key);
          fire(entry.value);
        }, delay);
      }
      pending.set(key, entry);
    },
    cancelAll() {
      for (const entry of pending.values()) clearTimer(entry.timer);
      pending.clear();
    },
  };
}

/** Sends the planned effects through socket.io, coalesced. */
function createLiveNotifier(io, { setTimer, clearTimer } = {}) {
  const debouncer = createDebouncer(setTimer, clearTimer);

  return {
    apply({ adminTopics, appEvents }) {
      if (adminTopics.length > 0) {
        debouncer.schedule(
          'admin',
          ADMIN_DELAY_MS,
          (topics) => new Set([...(topics || []), ...adminTopics]),
          (topics) => io.to('admins').emit('admin_update', {
            topics: [...topics].sort(),
            at: new Date().toISOString(),
          }),
        );
      }
      for (const { room, event } of appEvents) {
        debouncer.schedule(
          `${room}|${event}`,
          APP_DELAY_MS[event] || 1000,
          () => true,
          () => io.to(room).emit(event, { at: new Date().toISOString() }),
        );
      }
    },
    stop() {
      debouncer.cancelAll();
    },
  };
}

/**
 * Watches the database and forwards changes. Restarts the stream after an
 * error (with growing pauses); gives up quietly when the server does not
 * support change streams.
 */
function startLiveUpdates({ io, db, log = console }) {
  const notifier = createLiveNotifier(io);
  const pipeline = [{
    $match: {
      'ns.coll': { $in: Object.keys(COLLECTION_TOPICS) },
      operationType: { $in: ['insert', 'update', 'replace', 'delete'] },
    },
  }];
  let stream = null;
  let stopped = false;
  let retryMs = 2000;
  let retryTimer = null;

  const open = () => {
    if (stopped) return;
    try {
      stream = db.watch(pipeline);
    } catch (error) {
      log.error('Live updates unavailable:', error.message);
      return;
    }
    stream.on('change', (change) => {
      retryMs = 2000;
      try {
        notifier.apply(planLiveEffects(change));
      } catch (error) {
        log.error('Live update failed:', error.message);
      }
    });
    stream.on('error', (error) => {
      const unsupported = error?.code === 40573
        || /replica set|change stream/i.test(error?.message || '');
      stream?.close().catch(() => {});
      stream = null;
      if (unsupported) {
        log.warn('Live updates off: the database does not support change streams.');
        return;
      }
      log.error('Live updates interrupted, retrying:', error.message);
      retryTimer = setTimeout(open, retryMs);
      retryMs = Math.min(retryMs * 2, 60000);
    });
  };

  open();

  return {
    async stop() {
      stopped = true;
      clearTimeout(retryTimer);
      notifier.stop();
      if (stream) await stream.close().catch(() => {});
    },
  };
}

module.exports = {
  ACCOUNT_FIELDS,
  AVAILABILITY_FIELDS,
  COLLECTION_TOPICS,
  createDebouncer,
  createLiveNotifier,
  planLiveEffects,
  startLiveUpdates,
};
