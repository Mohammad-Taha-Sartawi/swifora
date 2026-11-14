const AD_AUDIENCES = Object.freeze([
  'all',
  'customers',
  'providers',
]);

// What a tap on the ad opens: nothing (''), a screen of the app
// ('app:<screen>') or a web page (an https:// address).
const AD_APP_SCREENS = Object.freeze([
  'create_order',
  'my_orders',
  'support',
  'notifications',
]);
const MAX_AD_LINK_LENGTH = 500;

/** The stored link, '' for none, or undefined when it is not allowed. */
function normalizeAdLink(value) {
  const link = trimmed(value);
  if (!link) return '';
  if (link.length > MAX_AD_LINK_LENGTH) return undefined;

  if (link.startsWith('app:')) {
    return AD_APP_SCREENS.includes(link.slice(4)) ? link : undefined;
  }

  try {
    const url = new URL(link);
    if (url.protocol !== 'https:' || !url.hostname) return undefined;
    if (url.username || url.password) return undefined;
    return url.toString();
  } catch (_) {
    return undefined;
  }
}

function trimmed(value) {
  return typeof value === 'string'
    ? value.trim()
    : '';
}

function parseOptionalDate(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const date = new Date(value);

  return Number.isFinite(date.getTime())
    ? date
    : undefined;
}

function normalizeAdPayload(body = {}, { imageCount = 0 } = {}) {
  const title = trimmed(body.title);
  const description = trimmed(body.body);
  const audience = trimmed(body.audience) || 'all';
  const rawSortOrder = body.sortOrder;
  const sortOrder = rawSortOrder === undefined || rawSortOrder === ''
    ? 0
    : Number(rawSortOrder);
  const startsAt = parseOptionalDate(body.startsAt);
  const endsAt = parseOptionalDate(body.endsAt);
  const isActive = body.isActive === undefined
    ? true
    : body.isActive === true || body.isActive === 'true';

  if (title.length > 120) {
    return {
      ok: false,
      message: 'عنوان الإعلان يجب ألا يتجاوز 120 حرفاً.',
    };
  }

  if (description.length > 300) {
    return {
      ok: false,
      message: 'نص الإعلان يجب ألا يتجاوز 300 حرف.',
    };
  }

  if (
    !title
    && !description
    && imageCount === 0
  ) {
    return {
      ok: false,
      message: 'أضف عنواناً أو نصاً أو صورة واحدة على الأقل للإعلان.',
    };
  }

  if (!AD_AUDIENCES.includes(audience)) {
    return {
      ok: false,
      message: 'الجهة المستهدفة غير صالحة.',
    };
  }

  if (
    !Number.isInteger(sortOrder)
    || sortOrder < 0
    || sortOrder > 9999
  ) {
    return {
      ok: false,
      message: 'ترتيب الإعلان يجب أن يكون رقماً بين 0 و9999.',
    };
  }

  if (startsAt === undefined || endsAt === undefined) {
    return {
      ok: false,
      message: 'تاريخ بداية أو نهاية الإعلان غير صالح.',
    };
  }

  // Every ad must end: the mobile apps stop showing it at that moment.
  if (!endsAt) {
    return {
      ok: false,
      message: 'تاريخ نهاية الإعلان مطلوب.',
    };
  }

  const link = normalizeAdLink(body.link);
  if (link === undefined) {
    return {
      ok: false,
      message: 'رابط الإعلان غير صالح. اختر شاشة من التطبيق أو أدخل رابطاً يبدأ بـ https://',
    };
  }

  if (startsAt && endsAt && endsAt <= startsAt) {
    return {
      ok: false,
      message: 'تاريخ نهاية الإعلان يجب أن يكون بعد تاريخ البداية.',
    };
  }

  return {
    ok: true,
    value: {
      title,
      body: description,
      audience,
      isActive,
      startsAt,
      endsAt,
      sortOrder,
      link,
    },
  };
}

function publicAd(ad) {
  return {
    _id: ad._id?.toString?.() || '',
    title: ad.title || '',
    body: ad.body || '',
    images: Array.isArray(ad.images) ? ad.images : [],
    startsAt: ad.startsAt || null,
    endsAt: ad.endsAt || null,
    link: ad.link || '',
  };
}

module.exports = {
  AD_APP_SCREENS,
  AD_AUDIENCES,
  normalizeAdLink,
  normalizeAdPayload,
  publicAd,
};
