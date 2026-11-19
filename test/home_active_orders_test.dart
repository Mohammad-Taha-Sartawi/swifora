// Both home screens show only the order lists that have something in them:
// the customer's "My orders" while an order is not finished, the "Driver
// price offers" row while at least one offer waits, "Orders in progress"
// while one is accepted; the driver's cards likewise. The account menu no
// longer repeats the language and theme options (they live in Settings).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'ux03_screen_harness.dart';

void main() {
  late Ux03Harness harness;

  setUp(() {
    harness = Ux03Harness();
    harness.api.reset();
  });

  tearDown(() => harness.dispose());

  Future<void> settle(WidgetTester tester) async {
    for (var i = 0; i < 5; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
  }

  Map<String, dynamic> order(String id, String status) => {
    '_id': id,
    'type': 'product',
    'description': 'Order $id',
    'status': status,
    'createdAt': DateTime.now().toIso8601String(),
  };

  group('customer home', () {
    final offersRow = find.byKey(const Key('offersRow'));
    final inProgressRow = find.byKey(const Key('inProgressRow'));
    // The section's own link (the bottom bar also says "My orders").
    final myOrders = find.text('View all orders');

    testWidgets('nothing under way: no orders section at all', (tester) async {
      harness.api.customerOrders = [
        order('1', 'completed'),
        order('2', 'cancelled'),
        order('3', 'expired'),
      ];
      await harness.pumpCustomerHome(tester);
      await settle(tester);
      expect(myOrders, findsNothing);
      expect(offersRow, findsNothing);
      expect(inProgressRow, findsNothing);
    });

    testWidgets('an order still waiting for offers: the section only', (
      tester,
    ) async {
      harness.api.customerOrders = [order('1', 'pending')];
      await harness.pumpCustomerHome(tester);
      await settle(tester);
      expect(myOrders, findsOneWidget);
      expect(offersRow, findsNothing);
      expect(inProgressRow, findsNothing);
    });

    testWidgets('an offer waiting: the offers row with its count', (
      tester,
    ) async {
      harness.api.customerOrders = [
        order('1', 'offered'),
        order('2', 'offered'),
        order('3', 'pending'),
      ];
      await harness.pumpCustomerHome(tester);
      await settle(tester);
      expect(myOrders, findsOneWidget);
      expect(offersRow, findsOneWidget);
      expect(
        find.descendant(of: offersRow, matching: find.text('2')),
        findsOneWidget,
      );
      expect(inProgressRow, findsNothing);
    });

    testWidgets('an accepted order: the in-progress row only', (tester) async {
      harness.api.customerOrders = [
        order('1', 'accepted'),
        order('2', 'completed'),
      ];
      await harness.pumpCustomerHome(tester);
      await settle(tester);
      expect(myOrders, findsOneWidget);
      expect(offersRow, findsNothing);
      expect(inProgressRow, findsOneWidget);
    });
  });

  group('driver home', () {
    final newRequests = find.byKey(const Key('statPendingOrders'));
    final myOffers = find.byKey(const Key('statOfferedOrders'));
    final active = find.byKey(const Key('statActiveOrders'));

    void stats({int pending = 0, int offered = 0, int active = 0}) {
      harness.api.statsJson = {
        ...harness.api.statsJson,
        'pendingOrdersCount': pending,
        'offeredOrdersCount': offered,
        'activeOrdersCount': active,
      };
    }

    testWidgets('nothing under way: no order cards', (tester) async {
      stats();
      await harness.pumpProviderHome(tester);
      await settle(tester);
      expect(newRequests, findsNothing);
      expect(myOffers, findsNothing);
      expect(active, findsNothing);
      // The orders report (history) stays.
      expect(find.byKey(const Key('ordersReportRow')), findsOneWidget);
    });

    testWidgets('only the cards that have orders', (tester) async {
      stats(offered: 2);
      await harness.pumpProviderHome(tester);
      await settle(tester);
      expect(newRequests, findsNothing);
      expect(myOffers, findsOneWidget);
      expect(active, findsNothing);
    });

    testWidgets('all three when all have orders', (tester) async {
      stats(pending: 3, offered: 1, active: 1);
      await harness.pumpProviderHome(tester);
      await settle(tester);
      expect(newRequests, findsOneWidget);
      expect(myOffers, findsOneWidget);
      expect(active, findsOneWidget);
    });
  });

  testWidgets('the account menu has no language or theme option', (
    tester,
  ) async {
    await harness.pumpCustomerHome(tester);
    await settle(tester);
    await tester.tap(find.text('Account'));
    await settle(tester);
    expect(find.byKey(const Key('accountSettings')), findsOneWidget);
    expect(find.text('Language'), findsNothing);
    expect(find.text('Theme'), findsNothing);
  });
}
