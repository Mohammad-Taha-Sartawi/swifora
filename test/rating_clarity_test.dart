// Owner requests of 2026-11-16: the person rating sees exactly what they are
// giving (numbered stars, "4 out of 5 — Very good", a send button), and
// drivers see the customer's rating on a new order like customers see the
// driver's rating on an offer.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:swifora/widgets/ui/rating_summary_bar.dart';
import 'package:swifora/widgets/ui/star_rating_dialog.dart';

import 'ux03_screen_harness.dart';

Widget _host(void Function(int?) onResult) {
  return MaterialApp(
    locale: const Locale('en'),
    home: Builder(
      builder: (context) => ElevatedButton(
        onPressed: () async => onResult(
          await showStarRatingDialog(
            context,
            title: 'Rate the customer',
            body: 'How was this customer?',
          ),
        ),
        child: const Text('open'),
      ),
    ),
  );
}

void main() {
  testWidgets('a star selects (does not send) and the choice is spelled out', (
    tester,
  ) async {
    int? result = -1;
    await tester.pumpWidget(_host((value) => result = value));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    // Every star carries its number; nothing chosen yet, send is disabled.
    for (var value = 1; value <= 5; value += 1) {
      expect(find.byKey(Key('ratingStar$value')), findsOneWidget);
      expect(find.text('$value'), findsOneWidget);
    }
    expect(find.text('Tap a star: 1 is lowest, 5 is best'), findsOneWidget);
    ElevatedButton send() =>
        tester.widget(find.byKey(const Key('ratingSendButton')));
    expect(send().onPressed, isNull);

    await tester.tap(find.byKey(const Key('ratingStar4')));
    await tester.pumpAndSettle();
    // Still open, with the choice in words.
    expect(find.text('4 out of 5 — Very good'), findsOneWidget);
    expect(result, -1);

    // Changing one's mind is possible before sending.
    await tester.tap(find.byKey(const Key('ratingStar2')));
    await tester.pumpAndSettle();
    expect(find.text('2 out of 5 — Poor'), findsOneWidget);

    await tester.tap(find.byKey(const Key('ratingSendButton')));
    await tester.pumpAndSettle();
    expect(result, 2);
  });

  testWidgets('cancel sends nothing', (tester) async {
    int? result = -1;
    await tester.pumpWidget(_host((value) => result = value));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('ratingStar5')));
    await tester.pump();
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(result, isNull);
  });

  testWidgets('the rating bar spells out average, count and likes', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: RatingSummaryBar.fromSummary(const {
            'average': 4.5,
            'count': 12,
            'positiveCount': 9,
          }, positiveLabelKey: 'positive_ratings_by_drivers'),
        ),
      ),
    );
    expect(find.text('4.5 out of 5'), findsOneWidget);
    expect(find.text('12 ratings'), findsOneWidget);
    expect(find.text('Liked by 9 drivers'), findsOneWidget);
    // 4 full stars and a half.
    expect(find.byIcon(Icons.star_rounded), findsNWidgets(4));
    expect(find.byIcon(Icons.star_half_rounded), findsOneWidget);
  });

  testWidgets('a driver sees the customer rating on a new order', (
    tester,
  ) async {
    final harness = Ux03Harness();
    addTearDown(harness.dispose);
    harness.api.pendingOrders = [
      {
        '_id': 'order-1',
        'status': 'pending',
        'type': 'product',
        'description': 'Bread and milk',
        'area': 'Jerusalem',
        'phone': '0591234***',
        'customerId': {'fullName': 'Customer One', 'publicId': 'CUS-1'},
        'customerRatingSummary': {
          'average': 3.0,
          'count': 4,
          'positiveCount': 1,
        },
      },
      {
        '_id': 'order-2',
        'status': 'pending',
        'type': 'goods',
        'description': 'A sofa',
        'area': 'Jerusalem',
        'phone': '0597654***',
        'customerId': {'fullName': 'New Customer', 'publicId': 'CUS-2'},
        'customerRatingSummary': {'average': 0, 'count': 0, 'positiveCount': 0},
      },
    ];
    await harness.pumpScreen(tester, Ux03Screen.pendingOrders);
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('customerRatingBar')), findsWidgets);
    expect(find.text('3.0 out of 5'), findsOneWidget);
    expect(find.text('4 ratings'), findsOneWidget);
    expect(find.text('Liked by 1 drivers'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('A sofa'), 300);
    expect(find.text('New customer — no ratings yet'), findsOneWidget);
    // A masked number is not a call link.
    expect(find.text('0591234***'), findsOneWidget);
  });
}
