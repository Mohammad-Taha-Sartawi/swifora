import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'api_config.dart';

class SocketService {
  static SocketService? _instance;
  io.Socket? _socket;

  final _newOrderController =
      StreamController<Map<String, dynamic>>.broadcast();
  final _newOfferController =
      StreamController<Map<String, dynamic>>.broadcast();
  final _offerAcceptedController =
      StreamController<Map<String, dynamic>>.broadcast();
  final _offerNotSelectedController =
      StreamController<Map<String, dynamic>>.broadcast();
  final _offerCancelledController =
      StreamController<Map<String, dynamic>>.broadcast();
  final _offerWithdrawnController =
      StreamController<Map<String, dynamic>>.broadcast();
  final _providerProfileUpdatedController =
      StreamController<Map<String, dynamic>>.broadcast();
  final _orderStatusController =
      StreamController<Map<String, dynamic>>.broadcast();
  final _deliveryConfirmationRequestedController =
      StreamController<Map<String, dynamic>>.broadcast();
  final _deliveryConfirmationResultController =
      StreamController<Map<String, dynamic>>.broadcast();
  final _notifCountController = StreamController<int>.broadcast();
  final _supportReplyController =
      StreamController<Map<String, dynamic>>.broadcast();
  final _broadcastController =
      StreamController<Map<String, dynamic>>.broadcast();
  final _accountDeletedController = StreamController<void>.broadcast();
  final _sessionRevokedController = StreamController<void>.broadcast();
  final _connectedController = StreamController<void>.broadcast();

  // "Something changed, reload it" events, sent by the server when the data
  // changes (often from the dashboard): see services/liveUpdates.js.
  late final Map<String, StreamController<void>> _liveControllers = {
    'ads_changed': StreamController<void>.broadcast(),
    'drivers_changed': StreamController<void>.broadcast(),
    'account_changed': StreamController<void>.broadcast(),
    'earnings_changed': StreamController<void>.broadcast(),
  };

  /// Ads were added, edited, paused or removed in the dashboard.
  Stream<void> get onAdsChanged => _liveControllers['ads_changed']!.stream;

  /// Drivers' availability changed (customers' "drivers available" figure).
  Stream<void> get onDriversChanged =>
      _liveControllers['drivers_changed']!.stream;

  /// This user's own account was changed (e.g. edited by an admin).
  Stream<void> get onAccountChanged =>
      _liveControllers['account_changed']!.stream;

  /// A commission payment was recorded for this driver.
  Stream<void> get onEarningsChanged =>
      _liveControllers['earnings_changed']!.stream;

  /// Delivers a live event as if the server had sent it (tests only).
  @visibleForTesting
  void debugReceiveLiveEvent(String event) =>
      _liveControllers[event]?.add(null);

  Stream<Map<String, dynamic>> get onNewOrder => _newOrderController.stream;
  Stream<Map<String, dynamic>> get onNewOffer => _newOfferController.stream;
  Stream<Map<String, dynamic>> get onOfferAccepted =>
      _offerAcceptedController.stream;
  Stream<Map<String, dynamic>> get onOfferNotSelected =>
      _offerNotSelectedController.stream;
  Stream<Map<String, dynamic>> get onOfferCancelled =>
      _offerCancelledController.stream;

  /// A driver took back their price offer (the customer's side).
  Stream<Map<String, dynamic>> get onOfferWithdrawn =>
      _offerWithdrawnController.stream;
  Stream<Map<String, dynamic>> get onProviderProfileUpdated =>
      _providerProfileUpdatedController.stream;
  Stream<Map<String, dynamic>> get onOrderStatusChanged =>
      _orderStatusController.stream;
  Stream<Map<String, dynamic>> get onDeliveryConfirmationRequested =>
      _deliveryConfirmationRequestedController.stream;
  Stream<Map<String, dynamic>> get onDeliveryConfirmationResult =>
      _deliveryConfirmationResultController.stream;
  Stream<int> get onNotificationCount => _notifCountController.stream;
  Stream<Map<String, dynamic>> get onSupportReply =>
      _supportReplyController.stream;
  Stream<Map<String, dynamic>> get onBroadcast => _broadcastController.stream;
  Stream<void> get onAccountDeleted => _accountDeletedController.stream;
  Stream<void> get onSessionRevoked => _sessionRevokedController.stream;
  Stream<void> get onConnected => _connectedController.stream;

  bool get isConnected => _socket?.connected ?? false;

  static SocketService get instance {
    // Widget tests install a no-op override so no real socket is opened.
    final override = _instanceOverride;
    if (override != null) {
      return override;
    }

    _instance ??= SocketService._();
    return _instance!;
  }

  static SocketService? _instanceOverride;

  /// Installs a test double; pass null to restore the real singleton.
  @visibleForTesting
  static set testInstance(SocketService? value) => _instanceOverride = value;

  SocketService._();

  /// Constructor for test doubles only (real code uses the [instance]
  /// singleton and never constructs this class directly).
  @visibleForTesting
  SocketService.forTest();

  void connect({required String token, String? area}) {
    disconnect();

    final uri = ApiConfig.serverUrl;
    _socket = io.io(
      uri,
      io.OptionBuilder()
          .setAuth({'token': token})
          .setQuery({'area': area ?? ''})
          .setTransports(['websocket', 'polling'])
          // socket_io_client caches one Manager per URI and hands back the
          // previous socket, including its auth payload. Without a fresh
          // Manager, the first connection after logout reused the revoked
          // token, the server rejected it, and the new login was ended as
          // "session revoked" until the app was restarted.
          .enableForceNew()
          .enableAutoConnect()
          .build(),
    );

    _socket!.onConnect((_) {
      print('Socket connected');
      _connectedController.add(null);
    });

    _socket!.onDisconnect((reason) {
      print('Socket disconnected');

      if (reason == 'io server disconnect') {
        _sessionRevokedController.add(null);
      }
    });

    _socket!.onConnectError((error) {
      final message = error.toString().toLowerCase();

      if (message.contains('invalid authentication') ||
          message.contains('authentication required')) {
        _sessionRevokedController.add(null);
      }
    });

    _socket!.on('new_order', (data) {
      if (data is Map) {
        _newOrderController.add(Map<String, dynamic>.from(data));
      }
    });

    _socket!.on('new_offer', (data) {
      if (data is Map) {
        _newOfferController.add(Map<String, dynamic>.from(data));
      }
    });

    _socket!.on('offer_accepted', (data) {
      if (data is Map) {
        _offerAcceptedController.add(Map<String, dynamic>.from(data));
      }
    });

    _socket!.on('offer_not_selected', (data) {
      if (data is Map) {
        _offerNotSelectedController.add(Map<String, dynamic>.from(data));
      }
    });

    _socket!.on('offer_cancelled', (data) {
      if (data is Map) {
        _offerCancelledController.add(Map<String, dynamic>.from(data));
      }
    });

    _socket!.on('offer_withdrawn', (data) {
      if (data is Map) {
        _offerWithdrawnController.add(Map<String, dynamic>.from(data));
      }
    });

    _socket!.on('provider_profile_updated', (data) {
      if (data is Map) {
        _providerProfileUpdatedController.add(Map<String, dynamic>.from(data));
      }
    });

    _socket!.on('order_status_changed', (data) {
      if (data is Map) {
        _orderStatusController.add(Map<String, dynamic>.from(data));
      }
    });

    _socket!.on('delivery_confirmation_requested', (data) {
      if (data is Map) {
        _deliveryConfirmationRequestedController.add(
          Map<String, dynamic>.from(data),
        );
      }
    });

    _socket!.on('delivery_confirmation_result', (data) {
      if (data is Map) {
        _deliveryConfirmationResultController.add(
          Map<String, dynamic>.from(data),
        );
      }
    });

    _socket!.on('notification_count', (data) {
      if (data is Map && data['unreadCount'] is int) {
        _notifCountController.add(data['unreadCount'] as int);
      }
    });

    _socket!.on('support_reply', (data) {
      if (data is Map) {
        _supportReplyController.add(Map<String, dynamic>.from(data));
      }
    });

    _socket!.on('broadcast', (data) {
      if (data is Map) {
        _broadcastController.add(Map<String, dynamic>.from(data));
      }
    });

    _socket!.on('account_deleted', (_) {
      _accountDeletedController.add(null);
    });

    for (final entry in _liveControllers.entries) {
      _socket!.on(entry.key, (_) => entry.value.add(null));
    }

    _socket!.connect();
  }

  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
  }

  void dispose() {
    disconnect();
    _newOrderController.close();
    _newOfferController.close();
    _offerAcceptedController.close();
    _offerNotSelectedController.close();
    _offerCancelledController.close();
    _offerWithdrawnController.close();
    _providerProfileUpdatedController.close();
    _orderStatusController.close();
    _deliveryConfirmationRequestedController.close();
    _deliveryConfirmationResultController.close();
    _notifCountController.close();
    _supportReplyController.close();
    _broadcastController.close();
    _accountDeletedController.close();
    _sessionRevokedController.close();
    _connectedController.close();
    _instance = null;
  }
}
