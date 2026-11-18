// Push notification taps and foreground pushes (no Firebase needed: the
// service's handlers are exercised directly).
import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:swifora/screens/my_orders_screen.dart';
import 'package:swifora/screens/notifications_screen.dart';
import 'package:swifora/screens/order_detail_screen.dart';
import 'package:swifora/screens/rejected_orders_screen.dart';
import 'package:swifora/screens/support_chat_screen.dart';
import 'package:swifora/services/notification_router.dart';
import 'package:swifora/services/push_notification_service.dart';

void main() {
  group('NotificationRouter.pageFor', () {
    Object? page(String type, [String orderId = 'o1']) =>
        NotificationRouter.pageFor(type: type, orderId: orderId, token: 't');

    test('driver order events open the order detail', () {
      for (final type in [
        'new_order',
        'offer_accepted',
        'delivery_confirmed',
        'delivery_rejected',
        'new_rating',
      ]) {
        final p = page(type);
        expect(p, isA<OrderDetailScreen>(), reason: type);
        expect((p! as OrderDetailScreen).orderId, 'o1');
      }
    });

    test('customer offer events open the order offers', () {
      for (final type in [
        'new_offer',
        'order_pending',
        'order_completed',
        'driver_taken',
      ]) {
        expect(page(type), isA<BlocProvider>(), reason: type);
      }
    });

    test('delivery confirmation and not-selected have their own screens', () {
      expect(page('delivery_confirmation'), isA<MyOrdersScreen>());
      expect(page('offer_not_selected'), isA<RejectedOrdersScreen>());
    });

    test('notifications without an order have no order screen', () {
      expect(page('broadcast', ''), isNull);
      expect(page('report_reply', ''), isNull);
      expect(page('unknown_type'), isNull);
    });
  });

  group('PushNotificationService taps', () {
    final service = PushNotificationService.instance;

    tearDown(() => service.takePendingOpen());

    test('a tap with no screen listening is kept for the next home screen', () {
      service.handleOpened({'type': 'new_offer', 'orderId': 'o9'});
      expect(service.takePendingOpen(), {'type': 'new_offer', 'orderId': 'o9'});
      expect(service.takePendingOpen(), isNull);
    });

    test('a tap is delivered to a listening home screen', () async {
      final received = <Map<String, dynamic>>[];
      final sub = service.onOpened.listen(received.add);
      service.handleOpened({'type': 'new_order', 'orderId': 'o2'});
      await Future<void>.delayed(Duration.zero);
      expect(received, [
        {'type': 'new_order', 'orderId': 'o2'},
      ]);
      expect(service.takePendingOpen(), isNull);
      await sub.cancel();
    });

    test('foreground pushes are streamed to the open app', () async {
      final received = <ForegroundPush>[];
      final sub = service.onForeground.listen(received.add);
      service.handleForeground(
        const ForegroundPush(title: 'عرض جديد', body: '15 شيكل', data: {}),
      );
      await Future<void>.delayed(Duration.zero);
      expect(received.single.title, 'عرض جديد');
      await sub.cancel();
    });

    test(
      'a broadcast push in the open app is left to the pop-up (no duplicate)',
      () async {
        final received = <ForegroundPush>[];
        final sub = service.onForeground.listen(received.add);
        service.handleForeground(
          const ForegroundPush(
            title: 'رسالة الإدارة',
            body: 'نص',
            data: {'type': 'broadcast'},
          ),
        );
        service.handleForeground(
          const ForegroundPush(
            title: 'رد من فريق الدعم',
            body: 'أهلاً',
            data: {'type': 'support_reply'},
          ),
        );
        await Future<void>.delayed(Duration.zero);
        expect(received.map((push) => push.title), ['رد من فريق الدعم']);
        await sub.cancel();
      },
    );
  });

  test('tapped pushes: support reply opens the support chat', () {
    Widget page(Map<String, dynamic> data) =>
        NotificationRouter.pushPageFor(data: data, token: 't');

    expect(page({'type': 'support_reply'}), isA<SupportChatScreen>());
    expect(
      page({'type': 'new_order', 'orderId': 'o1'}),
      isA<OrderDetailScreen>(),
    );
    // Broadcasts, account notices and cancelled orders show their full text
    // in the notifications list.
    for (final data in [
      {'type': 'broadcast'},
      {'type': 'order_cancelled', 'orderId': 'o1'},
    ]) {
      expect(page(data), isA<NotificationsScreen>(), reason: '$data');
    }
  });
}
