// Owner requests of 2026-11-16: dashboard messages pop up on the home screen
// (confirm unlocks after 5 s, the message stays pinned in the
// notifications), support/report sit in the header next to notifications,
// no initial-letter button, the full name is shown, numeric dates.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:swifora/services/date_format.dart';
import 'package:swifora/widgets/ui/broadcast_popup.dart';

import 'ux03_screen_harness.dart';

Map<String, dynamic> _broadcast(String id, {bool acknowledged = false}) => {
  '_id': id,
  'type': 'broadcast',
  'title': 'Service update',
  'body': 'Deliveries pause tonight from 1 to 2 am.',
  'read': false,
  'pinned': true,
  'acknowledgedAt': acknowledged ? '2026-11-16T10:00:00.000Z' : null,
  'createdAt': '2026-11-16T09:00:00.000Z',
};

void main() {
  late Ux03Harness harness;

  setUp(() {
    harness = Ux03Harness();
    harness.api.reset();
  });
  tearDown(() => harness.dispose());

  testWidgets('a dashboard message pops up and unlocks after 5 seconds', (
    tester,
  ) async {
    harness.api.notifications = [_broadcast('n1')];
    await harness.pumpCustomerHome(tester);
    await tester.pump(const Duration(milliseconds: 200));

    expect(find.text('Service update'), findsOneWidget);
    expect(
      find.text('Deliveries pause tonight from 1 to 2 am.'),
      findsOneWidget,
    );

    ElevatedButton confirm() => tester.widget<ElevatedButton>(
      find.byKey(const Key('broadcastConfirmButton')),
    );
    expect(confirm().onPressed, isNull);
    expect(find.text('OK (5)'), findsOneWidget);

    // Tapping outside does not close it.
    await tester.tapAt(const Offset(5, 5));
    await tester.pump();
    expect(find.text('Service update'), findsOneWidget);

    await tester.pump(const Duration(seconds: 3));
    expect(confirm().onPressed, isNull);
    await tester.pump(const Duration(seconds: 2));
    expect(confirm().onPressed, isNotNull);
    expect(find.text('OK'), findsOneWidget);

    await tester.tap(find.byKey(const Key('broadcastConfirmButton')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('broadcastConfirmButton')), findsNothing);
    // Confirmed on the server, not deleted: it stays in the notifications.
    expect(harness.api.acknowledgedNotifications, ['n1']);
  });

  testWidgets('an already confirmed message does not pop up again', (
    tester,
  ) async {
    harness.api.notifications = [_broadcast('n1', acknowledged: true)];
    await harness.pumpCustomerHome(tester);
    await tester.pump(const Duration(milliseconds: 200));

    expect(find.byKey(const Key('broadcastConfirmButton')), findsNothing);
    expect(harness.api.acknowledgedNotifications, isEmpty);
  });

  testWidgets('the popup can be shown directly with the same lock', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => ElevatedButton(
            onPressed: () =>
                showBroadcastPopup(context, title: 'Hello', body: 'Body'),
            child: const Text('open'),
          ),
        ),
      ),
    );
    await tester.tap(find.text('open'));
    await tester.pump();
    expect(find.text('Hello'), findsOneWidget);
    expect(
      tester
          .widget<ElevatedButton>(
            find.byKey(const Key('broadcastConfirmButton')),
          )
          .onPressed,
      isNull,
    );
    await tester.pump(broadcastConfirmDelay);
    await tester.tap(find.byKey(const Key('broadcastConfirmButton')));
    await tester.pumpAndSettle();
    expect(find.text('Hello'), findsNothing);
  });

  testWidgets('customer header: notifications, support, report; full name', (
    tester,
  ) async {
    await harness.pumpCustomerHome(tester);
    await tester.pump(const Duration(milliseconds: 200));

    expect(find.byTooltip('Notifications'), findsWidgets);
    expect(find.byKey(const Key('headerSupportButton')), findsOneWidget);
    expect(find.byKey(const Key('headerReportButton')), findsOneWidget);
    expect(find.byKey(const Key('accountMenuButton')), findsNothing);
    // The full name, not an initial.
    expect(find.byKey(const Key('homeFullName')), findsOneWidget);
    expect(find.text('Customer One'), findsOneWidget);
    // Help and report no longer repeat at the bottom of the page.
    expect(find.text('Help & reports'), findsNothing);
  });

  testWidgets('driver header: notifications, support, report customer', (
    tester,
  ) async {
    await harness.pumpProviderHome(tester);
    await tester.pump(const Duration(milliseconds: 200));

    expect(find.byKey(const Key('headerSupportButton')), findsOneWidget);
    expect(find.byTooltip('Report a Customer'), findsWidgets);
    expect(find.byKey(const Key('accountMenuButton')), findsNothing);
    expect(find.text('Provider One'), findsOneWidget);
  });

  testWidgets('new orders wait until the driver confirms the message', (
    tester,
  ) async {
    harness.api.notifications = [_broadcast('n9')];
    harness.api.statsJson = {
      ...harness.api.statsJson,
      'pendingOrdersCount': 1,
      'isAvailable': true,
    };
    harness.api.pendingOrders = [
      {
        '_id': 'order-1',
        'status': 'pending',
        'type': 'product',
        'description': 'Bread',
        'area': 'Jerusalem',
        'phone': '0591234***',
        'customerId': {'fullName': 'Customer One', 'publicId': 'CUS-1'},
      },
    ];
    await harness.pumpProviderHome(tester);
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pump(const Duration(milliseconds: 300));

    // The message is on top, the new orders have not covered it.
    expect(find.byKey(const Key('broadcastConfirmButton')), findsOneWidget);
    expect(find.text('New Orders'), findsNothing);

    await tester.pump(const Duration(seconds: 5));
    await tester.tap(find.byKey(const Key('broadcastConfirmButton')));
    await tester.pumpAndSettle();

    // Then the new orders open.
    expect(find.byKey(const Key('broadcastConfirmButton')), findsNothing);
    expect(find.text('Bread'), findsOneWidget);
  });

  test('dates are numbers: DD/MM/YYYY', () {
    expect(formatDisplayDate(DateTime(2026, 11, 5, 9, 7)), '05/11/2026');
    expect(
      formatDisplayDateTime(DateTime(2026, 1, 9, 23, 4)),
      '09/01/2026 23:04',
    );
    expect(formatServerDate('2026-11-16'), '16/11/2026');
    expect(formatServerDate(''), '');
    expect(formatServerDate('not a date'), 'not a date');
    final iso = DateTime(2026, 11, 16, 8, 30).toUtc().toIso8601String();
    expect(formatServerDate(iso, withTime: true), '16/11/2026 08:30');
  });
}
