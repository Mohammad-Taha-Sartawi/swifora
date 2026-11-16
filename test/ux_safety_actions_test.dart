// Phase 1 usability and safety fixes (docs/ux/redesign-audit-2026-11.md):
// confirmation before one-way steps, one request per tap, errors that are
// not shown as "empty", password visibility and tappable phone numbers.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:swifora/services/theme_service.dart';
import 'package:swifora/widgets/ui/app_busy_actions.dart';
import 'package:swifora/widgets/ui/app_password_toggle.dart';
import 'package:swifora/widgets/ui/app_phone_link.dart';
import 'package:swifora/widgets/ui/app_state_views.dart';

import 'ux03_screen_harness.dart';

Map<String, dynamic> _acceptedOrder() => {
  '_id': 'order-1',
  'status': 'accepted',
  'type': 'product',
  'description': 'Medicine from the pharmacy',
  'area': 'Jerusalem',
  'phone': '0591234567',
  'price': 20,
};

class _BusyProbe extends StatefulWidget {
  const _BusyProbe({required this.action});

  final Future<void> Function() action;

  @override
  State<_BusyProbe> createState() => _BusyProbeState();
}

class _BusyProbeState extends State<_BusyProbe> with AppBusyActions {
  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: isActionBusy('send')
          ? null
          : () => runBusyAction('send', widget.action),
      child: Text(isActionBusy('send') ? 'sending' : 'send'),
    );
  }
}

void main() {
  late Ux03Harness harness;

  setUp(() => harness = Ux03Harness());
  tearDown(() => harness.dispose());

  testWidgets('starting a delivery asks first; cancel sends nothing', (
    tester,
  ) async {
    harness.api.activeOrders = [_acceptedOrder()];
    await harness.pumpScreen(tester, Ux03Screen.providerActive);
    await tester.pump(const Duration(milliseconds: 100));

    await tester.tap(find.text('Start Delivering'));
    await tester.pumpAndSettle();

    expect(find.text('Start the delivery now?'), findsOneWidget);
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();

    expect(harness.api.tripUpdates, isEmpty);
  });

  testWidgets('confirming a delivery start sends exactly one request', (
    tester,
  ) async {
    harness.api.activeOrders = [_acceptedOrder()];
    harness.api.responseDelay = const Duration(milliseconds: 300);
    await harness.pumpScreen(tester, Ux03Screen.providerActive);
    await tester.pump(const Duration(milliseconds: 400));

    await tester.tap(find.text('Start Delivering'));
    await tester.pumpAndSettle();
    // The dialog's confirm button carries the same label as the action.
    await tester.tap(
      find.widgetWithText(ElevatedButton, 'Start Delivering').last,
    );
    // Let the dialog close; the request (300 ms) is still on its way.
    await tester.pump(const Duration(milliseconds: 150));

    // While the request is on its way the button is disabled.
    final button = tester.widget<ElevatedButton>(
      find.widgetWithText(ElevatedButton, 'Start Delivering').first,
    );
    expect(button.onPressed, isNull);

    await tester.pump(const Duration(seconds: 2));
    await tester.pumpAndSettle();
    expect(harness.api.tripUpdates, ['/api/orders/order-1/fulfilling']);
  });

  testWidgets('a report history that fails to load offers a retry', (
    tester,
  ) async {
    // The stub API has no /reports/my route, so the request fails.
    await harness.pumpScreen(tester, Ux03Screen.report);
    await tester.pumpAndSettle();

    expect(find.text("Couldn't load your previous reports."), findsOneWidget);
    expect(find.text('No previous reports'), findsNothing);
    expect(find.widgetWithText(OutlinedButton, 'Retry'), findsOneWidget);
  });

  testWidgets('the report form is in English when the app is in English', (
    tester,
  ) async {
    await harness.pumpScreen(tester, Ux03Screen.report);
    await tester.pumpAndSettle();

    expect(find.text('Send report'), findsOneWidget);
    expect(find.text('What happened'), findsOneWidget);
    expect(find.text('إرسال البلاغ'), findsNothing);
  });

  testWidgets('a repeated tap does not start the same action twice', (
    tester,
  ) async {
    var runs = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: _BusyProbe(
            action: () async {
              runs++;
              await Future<void>.delayed(const Duration(milliseconds: 200));
            },
          ),
        ),
      ),
    );

    await tester.tap(find.text('send'));
    await tester.pump();
    expect(find.text('sending'), findsOneWidget);
    await tester.tap(find.text('sending'), warnIfMissed: false);
    await tester.pump(const Duration(milliseconds: 300));

    expect(runs, 1);
    expect(find.text('send'), findsOneWidget);
  });

  testWidgets('the password toggle shows and hides the password', (
    tester,
  ) async {
    var obscured = true;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: StatefulBuilder(
            builder: (context, setState) => TextField(
              obscureText: obscured,
              decoration: InputDecoration(
                suffixIcon: AppPasswordToggle(
                  obscured: obscured,
                  onPressed: () => setState(() => obscured = !obscured),
                ),
              ),
            ),
          ),
        ),
      ),
    );

    expect(find.byTooltip('Show password'), findsOneWidget);
    await tester.tap(find.byTooltip('Show password'));
    await tester.pump();
    expect(tester.widget<TextField>(find.byType(TextField)).obscureText, false);
    expect(find.byTooltip('Hide password'), findsOneWidget);
    final size = tester.getSize(find.byType(AppPasswordToggle));
    expect(size.width, greaterThanOrEqualTo(AppSizes.minTouchTarget));
  });

  test('phone links dial the digits of the number', () {
    expect(AppPhoneLink.telUri('059 123 4567').toString(), 'tel:0591234567');
    expect(
      AppPhoneLink.telUri('+970-59-1234567').toString(),
      'tel:+970591234567',
    );
    expect(AppPhoneLink.telUri('—'), isNull);
    // Masked by the server before an offer is accepted: not callable.
    expect(AppPhoneLink.telUri('0590000***'), isNull);
    expect(AppPhoneLink.telUri('12345'), isNull);
  });

  testWidgets('a phone link reads left to right and is one labelled button', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    await tester.pumpWidget(
      const MaterialApp(
        locale: Locale('en'),
        home: Scaffold(
          body: Directionality(
            textDirection: TextDirection.rtl,
            child: AppPhoneLink(phone: '0591234567'),
          ),
        ),
      ),
    );

    final text = tester.widget<Text>(find.text('0591234567'));
    expect(text.textDirection, TextDirection.ltr);
    expect(find.bySemanticsLabel('Call 0591234567'), findsOneWidget);
    expect(
      tester.getSize(find.byType(AppPhoneLink)).height,
      greaterThanOrEqualTo(AppSizes.minTouchTarget),
    );
    semantics.dispose();
  });

  testWidgets('a masked number is plain text, not a link', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: AppPhoneLink(phone: '0590000***')),
      ),
    );
    expect(find.text('0590000***'), findsOneWidget);
    expect(find.byType(InkWell), findsNothing);
  });

  testWidgets('error and empty views scroll instead of overflowing', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AppErrorState(message: 'Network error', onRetry: () {}),
        ),
      ),
    );
    expect(tester.takeException(), isNull);
    expect(find.byType(SingleChildScrollView), findsOneWidget);
  });
}
