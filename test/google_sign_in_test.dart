// "Continue with Google" on the sign-in screen: hidden until configured; a
// driver under review sees that state; a new driver completes phone,
// governorate, city and services, and agrees to the terms first.
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:swifora/bloc/app/app_bloc.dart';
import 'package:swifora/bloc/auth/auth_bloc.dart';
import 'package:swifora/screens/google_complete_profile_screen.dart';
import 'package:swifora/screens/login_screen.dart';
import 'package:swifora/services/api_config.dart';
import 'package:swifora/services/auth_service.dart';
import 'package:swifora/services/google_sign_in_service.dart';
import 'package:swifora/services/mobile_api_client.dart';
import 'package:swifora/services/session_storage.dart';
import 'package:swifora/services/theme_service.dart';
import 'package:swifora/widgets/ui/google_sign_in_button.dart';

class _Vault implements TokenVault {
  @override
  Future<String?> read(String key) async => null;
  @override
  Future<void> write(String key, String value) async {}
  @override
  Future<void> delete(String key) async {}
}

class _Gateway implements AuthGateway {
  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

/// Serves the endpoints the flow touches and records what was sent.
class _Server implements HttpClientAdapter {
  _Server(this.governorates);

  final List<Map<String, dynamic>> governorates;
  Map<String, dynamic> googleReply = const {};
  Map<String, dynamic> completeReply = const {};
  final List<(String, Map<String, dynamic>)> calls = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final path = options.uri.path;
    final bytes =
        await (requestStream?.expand((c) => c).toList() ??
            Future.value(<int>[]));
    final body = bytes.isEmpty
        ? <String, dynamic>{}
        : Map<String, dynamic>.from(jsonDecode(utf8.decode(bytes)) as Map);
    calls.add((path, body));
    Object reply = <String, dynamic>{};
    if (path.endsWith('/locations/governorates')) reply = governorates;
    if (path.endsWith('/auth/google')) reply = googleReply;
    if (path.endsWith('/auth/google/complete')) reply = completeReply;
    return ResponseBody.fromString(
      jsonEncode(reply),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

Widget _app() => MultiBlocProvider(
  providers: [
    BlocProvider(create: (_) => AppBloc()),
    BlocProvider(
      create: (_) => AuthBloc(
        authService: _Gateway(),
        sessionStorage: SessionStorage(vault: _Vault()),
        checkOnStart: false,
      ),
    ),
  ],
  child: MaterialApp(
    theme: AppTheme.light,
    locale: const Locale('en'),
    supportedLocales: const [Locale('ar'), Locale('en')],
    localizationsDelegates: const [
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    home: const LoginScreen(),
  ),
);

void main() {
  final locations =
      jsonDecode(
            File(
              'swifora_backend/src/data/palestine-locations.json',
            ).readAsStringSync(),
          )
          as Map<String, dynamic>;
  final governorates = [
    for (final g
        in (locations['governorates'] as List)
            .cast<Map<String, dynamic>>()
            .take(3))
      {
        'name': g['name'],
        'native': g['native'],
        'cities': [
          for (final c in (g['cities'] as List).cast<Map<String, dynamic>>())
            {'name': c['name'], 'native': c['native']},
        ],
      },
  ];

  late _Server server;
  setUp(() {
    ApiConfig.initForTesting('http://127.0.0.1:1');
    server = _Server(governorates);
    MobileApiClient.testAdapter = server;
    GoogleSignInService.availableOverride = true;
    GoogleSignInService.idTokenOverride = () async => 'google-id-token';
  });
  tearDown(() {
    MobileApiClient.testAdapter = null;
    GoogleSignInService.availableOverride = null;
    GoogleSignInService.idTokenOverride = null;
  });

  Future<void> tapGoogle(WidgetTester tester) async {
    final button = find.byKey(const Key('googleSignInButton'));
    await tester.ensureVisible(button);
    await tester.tap(button);
    await tester.pumpAndSettle();
  }

  testWidgets('no Google button until Google sign-in is configured', (
    tester,
  ) async {
    GoogleSignInService.availableOverride = null; // real check: not set
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();
    expect(find.byType(GoogleSignInButton), findsNothing);
  });

  testWidgets('a driver under review sees that, signing in with Google', (
    tester,
  ) async {
    server.googleReply = {
      'pending': true,
      'code': 'ACCOUNT_PENDING_APPROVAL',
      'message': 'Your account is being reviewed.',
    };
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();
    await tester.tap(find.text('Provider'));
    await tester.pump();
    await tapGoogle(tester);

    final (path, body) = server.calls.firstWhere(
      (c) => c.$1.endsWith('/auth/google'),
    );
    expect(path, endsWith('/auth/google'));
    expect(body, {'idToken': 'google-id-token', 'role': 'provider'});
    expect(find.text('Your account is being reviewed.'), findsOneWidget);
  });

  testWidgets('closing the Google picker does nothing', (tester) async {
    GoogleSignInService.idTokenOverride = () async => null;
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();
    await tapGoogle(tester);
    expect(server.calls.where((c) => c.$1.contains('/auth/google')), isEmpty);
    expect(find.byType(GoogleCompleteProfileScreen), findsNothing);
  });

  testWidgets('a new driver completes the details and agrees, then waits', (
    tester,
  ) async {
    server.googleReply = {
      'needsProfile': true,
      'registrationToken': 'reg-token',
      'profile': {'fullName': 'Driver One', 'email': 'driver@example.test'},
    };
    server.completeReply = {
      'pending': true,
      'message': 'Sign-up request sent for review.',
    };
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();
    await tester.tap(find.text('Provider'));
    await tester.pump();
    await tapGoogle(tester);

    // The details screen, with what Google gave us.
    expect(find.byType(GoogleCompleteProfileScreen), findsOneWidget);
    expect(find.text('Driver One'), findsOneWidget);
    expect(find.text('driver@example.test'), findsOneWidget);

    // Nothing is sent while details are missing.
    final submit = find.byKey(const Key('googleCompleteSubmit'));
    await tester.ensureVisible(submit);
    await tester.tap(submit);
    await tester.pumpAndSettle();
    expect(server.calls.where((c) => c.$1.endsWith('/complete')), isEmpty);
    expect(find.text('Invalid phone number'), findsNothing);

    await tester.enterText(
      find.byKey(const Key('googlePhoneField')),
      '0591234567',
    );
    // Dropdown menus cannot be opened in widget tests; set the fields the
    // way a selection does (didChange also calls onChanged).
    tester
        .state<FormFieldState<String>>(
          find.byKey(const Key('googleGovernorateField')),
        )
        .didChange(governorates.first['name'] as String);
    await tester.pumpAndSettle();
    final firstCity =
        ((governorates.first['cities'] as List).first as Map)['name'] as String;
    tester
        .state<FormFieldState<String>>(
          find.byType(DropdownButtonFormField<String>).last,
        )
        .didChange(firstCity);
    await tester.pumpAndSettle();

    // A driver must choose at least one service.
    await tester.ensureVisible(submit);
    await tester.tap(submit);
    await tester.pumpAndSettle();
    expect(find.text('Agree'), findsNothing);
    await tester.ensureVisible(
      find.byKey(const Key('googleServiceType_goods')),
    );
    await tester.tap(find.byKey(const Key('googleServiceType_goods')));
    await tester.pump();

    // Terms, then privacy policy, then the request (after the earlier
    // "choose a service" message has gone).
    await tester.pump(const Duration(seconds: 6));
    await tester.pumpAndSettle();
    await tester.ensureVisible(submit);
    await tester.tap(submit);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Agree'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Agree'));
    await tester.pumpAndSettle();

    final (_, sent) = server.calls.firstWhere(
      (c) => c.$1.endsWith('/auth/google/complete'),
    );
    expect(sent['registrationToken'], 'reg-token');
    expect(sent['fullName'], 'Driver One');
    expect(sent['phone'], '0591234567');
    expect(sent['governorate'], governorates.first['name']);
    expect(sent['area'], firstCity);
    expect(sent['serviceTypes'], ['goods']);
    expect(sent['privacyPolicy'], true);

    // Back on the sign-in screen with the "under review" message.
    expect(find.byType(GoogleCompleteProfileScreen), findsNothing);
    expect(find.text('Sign-up request sent for review.'), findsOneWidget);
  });
}
