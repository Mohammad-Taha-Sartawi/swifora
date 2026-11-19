// A new customer who continues with Google only agrees to the terms and the
// privacy policy (no details form); the first order then asks for the
// governorate and city/village once, and sends them with the order.
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
import 'package:swifora/bloc/order/order_bloc.dart';
import 'package:swifora/models/user_model.dart';
import 'package:swifora/screens/create_order_screen.dart';
import 'package:swifora/screens/google_complete_profile_screen.dart';
import 'package:swifora/screens/login_screen.dart';
import 'package:swifora/services/api_config.dart';
import 'package:swifora/services/auth_service.dart';
import 'package:swifora/services/google_sign_in_service.dart';
import 'package:swifora/services/location_catalog.dart';
import 'package:swifora/services/mobile_api_client.dart';
import 'package:swifora/services/session_storage.dart';
import 'package:swifora/services/theme_service.dart';

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

/// Serves the endpoints these flows touch and records what was sent.
class _Server implements HttpClientAdapter {
  _Server(this.governorates);

  final List<Map<String, dynamic>> governorates;
  Map<String, dynamic> googleReply = const {};
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
    var status = 200;
    Object reply = <String, dynamic>{};
    if (path.endsWith('/locations/governorates')) reply = governorates;
    if (path.endsWith('/auth/google')) reply = googleReply;
    if (path.endsWith('/auth/google/complete')) {
      // Kept on the sign-in screen: the reply itself is handled like any
      // sign-in reply (tested elsewhere).
      status = 503;
      reply = {'error': 'Server busy.'};
    }
    if (path.endsWith('/orders')) {
      status = 201;
      reply = {'_id': 'order-1', 'type': body['type'], 'status': 'pending'};
    }
    return ResponseBody.fromString(
      jsonEncode(reply),
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

MaterialApp _material(Widget home) => MaterialApp(
  theme: AppTheme.light,
  locale: const Locale('en'),
  supportedLocales: const [Locale('ar'), Locale('en')],
  localizationsDelegates: const [
    GlobalMaterialLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
  ],
  home: home,
);

Widget _loginApp() => MultiBlocProvider(
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
  child: _material(const LoginScreen()),
);

/// A page with a button that opens the order screen, as the home does.
Widget _orderApp(UserModel user) => _material(
  Builder(
    builder: (context) => Scaffold(
      body: Center(
        child: TextButton(
          onPressed: () => Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => BlocProvider(
                create: (_) => OrderBloc(),
                child: CreateOrderScreen(user: user, token: 'token'),
              ),
            ),
          ),
          child: const Text('open'),
        ),
      ),
    ),
  ),
);

UserModel _customer({String phone = '', String area = '', String gov = ''}) =>
    UserModel(
      id: 'customer-1',
      fullName: 'Google Customer',
      email: 'customer@example.test',
      phone: phone,
      role: 'customer',
      area: area,
      governorate: gov,
      publicId: 'CUS-1',
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
  final firstGovernorate = governorates.first['name'] as String;
  final firstCity =
      ((governorates.first['cities'] as List).first as Map)['name'] as String;

  late _Server server;
  setUp(() {
    ApiConfig.initForTesting('http://127.0.0.1:1');
    ApiConfig.detectedArea = null;
    LocationCatalog.clearCache();
    server = _Server(governorates);
    MobileApiClient.testAdapter = server;
    GoogleSignInService.availableOverride = true;
    GoogleSignInService.idTokenOverride = () async => 'google-id-token';
  });
  tearDown(() {
    MobileApiClient.testAdapter = null;
    GoogleSignInService.availableOverride = null;
    GoogleSignInService.idTokenOverride = null;
    ApiConfig.detectedArea = null;
    LocationCatalog.clearCache();
  });

  Iterable<Map<String, dynamic>> sent(String suffix) =>
      server.calls.where((c) => c.$1.endsWith(suffix)).map((c) => c.$2);

  // The Google button keeps its spinner while the agreements are open, so
  // the screen never "settles": step time forward instead.
  Future<void> settle(WidgetTester tester) async {
    for (var i = 0; i < 20; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
  }

  Future<void> tapGoogle(WidgetTester tester) async {
    final button = find.byKey(const Key('googleSignInButton'));
    await tester.ensureVisible(button);
    await tester.tap(button);
    await settle(tester);
  }

  group('a new customer with Google', () {
    setUp(() {
      server.googleReply = {
        'needsProfile': true,
        'registrationToken': 'reg-token',
        'profile': {
          'fullName': 'New Customer',
          'email': 'new@example.test',
          'role': 'customer',
        },
      };
    });

    testWidgets('agrees to the terms and privacy policy, with no form', (
      tester,
    ) async {
      await tester.pumpWidget(_loginApp());
      await settle(tester);
      await tapGoogle(tester);

      // Straight to the agreements: no details screen.
      expect(find.byType(GoogleCompleteProfileScreen), findsNothing);
      expect(sent('/auth/google/complete'), isEmpty);
      await tester.tap(find.text('Agree'));
      await settle(tester);
      expect(sent('/auth/google/complete'), isEmpty);
      await tester.tap(find.text('Agree'));
      await settle(tester);

      expect(sent('/auth/google/complete').single, {
        'registrationToken': 'reg-token',
        'fullName': 'New Customer',
        'phone': '',
        'governorate': '',
        'area': '',
        'serviceTypes': <dynamic>[],
        'privacyPolicy': true,
      });
      expect(find.byType(GoogleCompleteProfileScreen), findsNothing);
      // The server's reply is shown as with any sign-in.
      expect(find.text('Server busy.'), findsOneWidget);
    });

    testWidgets('declining the terms creates nothing', (tester) async {
      await tester.pumpWidget(_loginApp());
      await settle(tester);
      await tapGoogle(tester);
      await tester.tap(find.text('Decline'));
      await settle(tester);
      expect(sent('/auth/google/complete'), isEmpty);
      expect(find.byType(LoginScreen), findsOneWidget);
    });
  });

  group('the order screen', () {
    Future<void> open(WidgetTester tester, UserModel user) async {
      await tester.pumpWidget(_orderApp(user));
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
    }

    Future<void> fillOrder(WidgetTester tester) async {
      await tester.tap(find.text('Product Order'));
      await tester.pump();
      final fields = find.byType(TextFormField);
      await tester.enterText(fields.at(0), 'Bread');
      await tester.enterText(fields.at(1), 'Main street');
      await tester.enterText(fields.at(2), '0591234567');
    }

    Future<void> submit(WidgetTester tester) async {
      final button = find.byKey(const Key('submitOrderButton'));
      await tester.ensureVisible(button);
      await tester.tap(button);
      await tester.pumpAndSettle();
    }

    testWidgets('asks a customer with no place for it, once, and sends it', (
      tester,
    ) async {
      await open(tester, _customer());
      expect(find.textContaining('Your area'), findsOneWidget);
      expect(find.byKey(const Key('orderGovernorateField')), findsOneWidget);

      // Not sent without the place.
      await fillOrder(tester);
      await submit(tester);
      expect(sent('/orders'), isEmpty);
      expect(find.text('Required'), findsNWidgets(2));

      tester
          .state<FormFieldState<String>>(
            find.byKey(const Key('orderGovernorateField')),
          )
          .didChange(firstGovernorate);
      await tester.pumpAndSettle();
      final cityField = find.byWidgetPredicate(
        (w) =>
            w is DropdownButtonFormField<String> &&
            w.key != const Key('orderGovernorateField'),
      );
      tester.state<FormFieldState<String>>(cityField).didChange(firstCity);
      await tester.pumpAndSettle();
      // The messages go away once both are chosen.
      expect(find.text('Required'), findsNothing);
      await submit(tester);

      final order = sent('/orders').single;
      expect(order['governorate'], firstGovernorate);
      expect(order['area'], firstCity);
      expect(order['phone'], '0591234567');
      // Done: back on the page that opened it.
      expect(find.byType(CreateOrderScreen), findsNothing);
    });

    testWidgets('preselects the governorate the phone location found', (
      tester,
    ) async {
      ApiConfig.detectedArea = governorates[1]['native'] as String;
      await open(tester, _customer());
      final field = tester.widget<DropdownButtonFormField<String>>(
        find.byKey(const Key('orderGovernorateField')),
      );
      expect(field.initialValue, governorates[1]['name']);
    });

    testWidgets('a governorate saved from the phone location still asks '
        'for the city', (tester) async {
      await open(tester, _customer(area: firstGovernorate));
      expect(find.byKey(const Key('orderGovernorateField')), findsOneWidget);
    });

    testWidgets('a customer with a place is not asked again', (tester) async {
      await open(
        tester,
        _customer(phone: '0591234567', area: firstCity, gov: firstGovernorate),
      );
      expect(find.textContaining('Your area'), findsNothing);
      expect(find.byKey(const Key('orderGovernorateField')), findsNothing);
      await fillOrder(tester);
      await submit(tester);
      final order = sent('/orders').single;
      expect(order.containsKey('governorate'), isFalse);
    });

    testWidgets('an older account with a city and no governorate is not '
        'asked', (tester) async {
      await open(tester, _customer(phone: '0591234567', area: firstCity));
      expect(find.byKey(const Key('orderGovernorateField')), findsNothing);
    });
  });
}
