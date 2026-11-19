// The driver's "orders I sent a price offer for" list: each card shows the
// customer first, then the description, area and phone; the driver can take
// the offer back after confirming, and the order leaves the list.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:swifora/screens/offered_orders_screen.dart';

import 'ux03_screen_harness.dart';

Map<String, dynamic> _offeredOrder(String id) => {
  '_id': id,
  'type': 'product',
  'status': 'offered',
  'description': 'Two loaves of bread',
  'phone': '0569571***',
  'area': 'Al-Bireh',
  'customerId': {'fullName': 'Mohamad Hussen', 'publicId': '611434882593'},
  'offeredPrice': 9,
  'offeredTime': 20,
};

void main() {
  late Ux03Harness harness;

  setUp(() {
    harness = Ux03Harness();
    harness.api.reset();
  });
  tearDown(() => harness.dispose());

  Future<void> pumpList(
    WidgetTester tester,
    List<Map<String, dynamic>> orders,
  ) async {
    harness.api.offeredOrders = List.of(orders);
    await tester.pumpWidget(
      harness.app(
        OfferedOrdersScreen(orders: orders, token: 'test-token'),
        themeMode: ThemeMode.light,
        locale: const Locale('en'),
      ),
    );
    for (var i = 0; i < 5; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
  }

  Future<void> settle(WidgetTester tester) async {
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
  }

  testWidgets('the card shows customer, then description, area, phone, price', (
    tester,
  ) async {
    await pumpList(tester, [_offeredOrder('o-1')]);

    double top(Finder finder) => tester.getTopLeft(finder).dy;
    final customer = top(find.text('Mohamad Hussen'));
    final id = top(find.text('ID 611434882593'));
    final description = top(find.text('Two loaves of bread'));
    final area = top(find.text('Al-Bireh'));
    final phone = top(find.text('0569571***'));
    final price = top(find.textContaining('9 '));

    expect(id, closeTo(customer, 6), reason: 'name and ID share one line');
    expect(customer, lessThan(description));
    expect(description, lessThan(area));
    expect(area, lessThan(phone));
    expect(phone, lessThan(price));
    expect(find.byKey(const Key('withdrawOffer:o-1')), findsOneWidget);
  });

  testWidgets('withdrawing asks first, then removes the order', (tester) async {
    await pumpList(tester, [_offeredOrder('o-1'), _offeredOrder('o-2')]);

    // Cancelling the confirmation sends nothing.
    await tester.tap(find.byKey(const Key('withdrawOffer:o-1')));
    await settle(tester);
    expect(find.text('Withdraw your offer?'), findsOneWidget);
    await tester.tap(find.text('Cancel'));
    await settle(tester);
    expect(harness.api.withdrawnOffers, isEmpty);

    await tester.tap(find.byKey(const Key('withdrawOffer:o-1')));
    await settle(tester);
    await tester.tap(find.text('Withdraw offer').last);
    await settle(tester);

    expect(harness.api.withdrawnOffers, ['o-1']);
    expect(find.byKey(const Key('withdrawOffer:o-1')), findsNothing);
    expect(find.byKey(const Key('withdrawOffer:o-2')), findsOneWidget);
    expect(find.textContaining('Offer withdrawn'), findsOneWidget);
  });

  testWidgets('an offer already accepted or expired says so', (tester) async {
    await pumpList(tester, [_offeredOrder('o-1')]);
    harness.api.withdrawConflict = true;

    await tester.tap(find.byKey(const Key('withdrawOffer:o-1')));
    await settle(tester);
    await tester.tap(find.text('Withdraw offer').last);
    await settle(tester);

    expect(harness.api.withdrawnOffers, isEmpty);
    expect(find.textContaining('can no longer be withdrawn'), findsOneWidget);
  });
}
