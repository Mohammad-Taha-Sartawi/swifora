// "Delete account": the app sends a deletion request after confirming, shows
// it as under review, and lets the user withdraw it while it waits.
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:swifora/screens/account_deletion_screen.dart';
import 'package:swifora/services/api_config.dart';
import 'package:swifora/services/mobile_api_client.dart';
import 'package:swifora/services/theme_service.dart';

import 'ux03_screen_harness.dart';

/// The deletion-request endpoint, with an open request or none.
class _Server implements HttpClientAdapter {
  Map<String, dynamic>? open;
  bool fail = false;
  final List<String> calls = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    calls.add('${options.method} ${options.uri.path}');
    if (fail) return _json({'error': 'down'}, 500);
    switch (options.method) {
      case 'POST':
        open ??= {
          'id': 'r1',
          'status': 'pending',
          'requestedAt': '2026-11-19T08:30:00.000Z',
        };
        return _json({'request': open}, 201);
      case 'DELETE':
        if (open == null) return _json({'error': 'none'}, 404);
        open = null;
        return _json({'request': null}, 200);
      default:
        return _json({'request': open}, 200);
    }
  }

  ResponseBody _json(Object body, int status) => ResponseBody.fromString(
    jsonEncode(body),
    status,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );

  @override
  void close({bool force = false}) {}
}

Widget _app(String role) => MaterialApp(
  theme: AppTheme.light,
  locale: const Locale('en'),
  supportedLocales: const [Locale('ar'), Locale('en')],
  localizationsDelegates: const [
    GlobalMaterialLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
  ],
  home: AccountDeletionScreen(token: 'token', role: role),
);

void main() {
  late _Server server;
  setUp(() {
    ApiConfig.initForTesting('http://127.0.0.1:1');
    server = _Server();
    MobileApiClient.testAdapter = server;
  });
  tearDown(() => MobileApiClient.testAdapter = null);

  final send = find.byKey(const Key('deleteAccountSend'));
  final withdraw = find.byKey(const Key('deleteAccountWithdraw'));
  final pending = find.byKey(const Key('deleteAccountPending'));

  testWidgets('a driver confirms, sends, and sees it under review', (
    tester,
  ) async {
    await tester.pumpWidget(_app('provider'));
    await tester.pumpAndSettle();
    expect(find.textContaining('platform commission'), findsOneWidget);
    expect(pending, findsNothing);

    // Cancelling the confirmation sends nothing.
    await tester.tap(send);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(server.calls.where((c) => c.startsWith('POST')), isEmpty);

    await tester.tap(send);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Send deletion request').last);
    await tester.pumpAndSettle();
    expect(server.calls.where((c) => c.startsWith('POST')), hasLength(1));
    expect(pending, findsOneWidget);
    expect(find.textContaining('Sent on 19/11/2026'), findsOneWidget);
    expect(withdraw, findsOneWidget);
  });

  testWidgets('a customer with an open request can withdraw it', (
    tester,
  ) async {
    server.open = {
      'id': 'r1',
      'status': 'pending',
      'requestedAt': '2026-11-18T10:00:00.000Z',
    };
    await tester.pumpWidget(_app('customer'));
    await tester.pumpAndSettle();
    expect(pending, findsOneWidget);
    expect(find.textContaining('orders not finished'), findsOneWidget);

    await tester.tap(withdraw);
    await tester.pumpAndSettle();
    expect(server.calls, contains('DELETE /api/users/deletion-request'));
    expect(pending, findsNothing);
    expect(send, findsOneWidget);
  });

  testWidgets('a failed load offers a retry, not a wrong state', (
    tester,
  ) async {
    server.fail = true;
    await tester.pumpWidget(_app('customer'));
    await tester.pumpAndSettle();
    expect(send, findsNothing);
    expect(pending, findsNothing);
    server.fail = false;
    await tester.tap(find.byIcon(Icons.refresh).first);
    await tester.pumpAndSettle();
    expect(send, findsOneWidget);
  });

  testWidgets('the account menu opens the deletion screen', (tester) async {
    final harness = Ux03Harness();
    harness.api.reset();
    addTearDown(harness.dispose);
    await harness.pumpCustomerHome(tester);
    for (var i = 0; i < 5; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    await tester.tap(find.text('Account'));
    for (var i = 0; i < 5; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    expect(find.byKey(const Key('accountDeleteAccount')), findsOneWidget);
  });
}
