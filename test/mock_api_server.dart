// UX-01 remediation test fixture: an in-memory Replacement ApiClient adapter.
//
// Flutter's widget-test binding installs `_MockHttpOverrides`, which intercepts
// every HttpClient and returns mock 400 responses even for runAsync blocks.
// Real loopback HTTP is therefore impossible inside `WidgetTester`. Instead of
// a socket mock, tests install a `Dio` HttpClientAdapter: requests are served
// from immutable fixture data with deterministic delays, all clock-driven by
// the test's fake async time.
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

/// Recorded fixture+stub used by the remediation widget tests.
class MockApi {
  // -------- mutable per-test fixtures --------

  Map<String, dynamic> statsJson = _defaultStats();

  List<Map<String, dynamic>> pendingOrders = [];

  List<Map<String, dynamic>> offeredOrders = [];

  /// The driver's own orders (accepted / fulfilling), `/api/provider/orders`.
  List<Map<String, dynamic>> activeOrders = [];

  /// The customer's own orders, `GET /api/orders`.
  List<Map<String, dynamic>> customerOrders = [];

  /// Trip updates sent by the driver: `/api/orders/<id>/fulfilling|complete`.
  final List<String> tripUpdates = [];

  /// Offers the driver withdrew: `/api/provider/orders/<id>/withdraw-offer`.
  final List<String> withdrawnOffers = [];

  /// When true, withdrawing answers "the offer is no longer open" (409).
  bool withdrawConflict = false;

  /// Broadcast pop-ups confirmed by the user (`/api/notifications/<id>/ack`).
  final List<String> acknowledgedNotifications = [];

  int supportUnreadCount = 0;

  int statsRequests = 0;

  /// Optional artificial latency so tests can observe genuine loading states.
  Duration responseDelay = Duration.zero;

  /// Notifications served by `/api/notifications`.
  List<Map<String, dynamic>> notifications = [];

  final List<Map<String, dynamic>> availabilityCalls = [];

  final List<Map<String, dynamic>> contactCalls = [];

  /// Artificial latency applied to the support-contact endpoint so tests can
  /// observe the dialog's in-flight loading state before it dismisses.
  Duration contactDelay = Duration.zero;

  // -------- construction --------

  MockApi();

  void reset() {
    statsJson = _defaultStats();
    pendingOrders = [];
    offeredOrders = [];
    supportUnreadCount = 0;
    statsRequests = 0;
    responseDelay = Duration.zero;
    notifications = [];
    availabilityCalls.clear();
    activeOrders = [];
    customerOrders = [];
    tripUpdates.clear();
    withdrawnOffers.clear();
    withdrawConflict = false;
    acknowledgedNotifications.clear();
    contactCalls.clear();
    contactDelay = Duration.zero;
  }

  static Map<String, dynamic> _defaultStats() => {
    'dailyEarnings': 0.0,
    'monthlyEarnings': 0.0,
    'totalSuccessful': 0,
    'dailyOrderCount': 0,
    'dailyCommission': 0.0,
    'monthlyCommission': 0.0,
    'pendingOrdersCount': 0,
    'offeredOrdersCount': 0,
    'ordersReportCount': 0,
    'activeOrdersCount': 0,
    'isAvailable': true,
  };

  /// The [HttpClientAdapter] to install via
  /// `MobileApiClient.testAdapter = mockApi.adapter`.
  HttpClientAdapter get adapter => _MockApiAdapter._(this);
}

class _MockApiAdapter implements HttpClientAdapter {
  _MockApiAdapter._(this._api);

  final MockApi _api;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? bodyStream,
    Future<void>? cancelToken,
  ) async {
    if (_api.responseDelay > Duration.zero) {
      await Future<void>.delayed(_api.responseDelay);
    }

    final body =
        await (bodyStream?.expand((chunk) => chunk).toList() ??
            Future<List<int>>.value(const []));
    Map<String, dynamic>? decoded;

    if (body.isNotEmpty) {
      try {
        decoded = jsonDecode(utf8.decode(body)) as Map<String, dynamic>?;
      } catch (_) {}
    }

    return _respondFor(options.uri.path, decoded, options.method);
  }

  Future<ResponseBody> _respondFor(
    String path,
    Map<String, dynamic>? decoded,
    String method,
  ) async {
    Object? data;
    int status = 200;

    switch (path) {
      case '/api/orders' when method == 'GET':
        data = _api.customerOrders;
      case '/api/provider/stats':
        _api.statsRequests++;
        data = _api.statsJson;
      case '/api/provider/pending-orders':
        data = _api.pendingOrders;
      case '/api/provider/offered-orders':
        data = _api.offeredOrders;
      case '/api/provider/orders':
        data = _api.activeOrders;
      case final p
          when p.startsWith('/api/provider/orders/') &&
              p.endsWith('/withdraw-offer'):
        final orderId = p.split('/')[4];
        if (_api.withdrawConflict) {
          status = 409;
          data = {'conflict': true, 'code': 'OFFER_NOT_AVAILABLE'};
        } else {
          _api.withdrawnOffers.add(orderId);
          _api.offeredOrders.removeWhere((o) => o['_id'] == orderId);
          data = {'success': true, 'orderStatus': 'pending'};
        }
      case final p
          when p.startsWith('/api/notifications/') && p.endsWith('/ack'):
        _api.acknowledgedNotifications.add(p.split('/')[3]);
        data = {'acknowledgedAt': DateTime.now().toIso8601String()};
      case final p
          when p.startsWith('/api/orders/') &&
              (p.endsWith('/fulfilling') || p.endsWith('/complete')):
        _api.tripUpdates.add(p);
        data = const <String, dynamic>{};
      case '/api/notifications':
        data = _api.notifications;
      case '/api/notifications/unread-count':
        data = {'count': 0};
      case '/api/chat/unread-count':
        data = {'count': _api.supportUnreadCount};
      case '/api/provider/availability':
        _api.availabilityCalls.add(decoded ?? {});
        data = const <String, dynamic>{};
      case '/api/chat/contact':
        if (_api.contactDelay > Duration.zero) {
          await Future<void>.delayed(_api.contactDelay);
        }
        _api.contactCalls.add(decoded ?? {});
        data = const <String, dynamic>{};
      default:
        status = 404;
        data = {'error': 'unexpected path in test: $path'};
    }

    return ResponseBody.fromString(
      jsonEncode(data),
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  Future<void> close({bool force = false}) async {}
}
