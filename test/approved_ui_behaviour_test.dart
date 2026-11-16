// Behaviour of the owner-approved redesign (swifora-ui-ux): new interactions
// on Login and Create Order, in both approved modes.
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:swifora/bloc/app/app_bloc.dart';
import 'package:swifora/bloc/auth/auth_bloc.dart';
import 'package:swifora/screens/login_screen.dart';
import 'package:swifora/services/auth_service.dart';
import 'package:swifora/services/session_storage.dart';
import 'package:swifora/services/theme_service.dart';
import 'package:swifora/widgets/brand/swifora_brand.dart';
import 'package:swifora/widgets/ui/app_action_tile.dart';
import 'package:swifora/widgets/ui/app_button_loading_indicator.dart';
import 'package:swifora/widgets/ui/app_tone.dart';

import 'ux03_screen_harness.dart';

class _Vault implements TokenVault {
  final Map<String, String> values = {};

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<void> write(String key, String value) async => values[key] = value;

  @override
  Future<void> delete(String key) async => values.remove(key);
}

class _Gateway implements AuthGateway {
  int loginCalls = 0;

  @override
  Future<Map<String, dynamic>> login(
    String email,
    String password,
    String role,
  ) async {
    loginCalls += 1;
    throw const AuthRequestException('stop', code: 'INVALID_CREDENTIALS');
  }

  @override
  Future<Map<String, dynamic>> register(
    String fullName,
    String email,
    String phone,
    String password,
    String role,
    String area, {
    String governorate = '',
    bool privacyPolicy = true,
    List<String> serviceTypes = const [],
  }) => throw UnimplementedError();

  @override
  Future<Map<String, dynamic>> validateSession(String token) =>
      throw UnimplementedError();
}

Widget _login(
  _Gateway gateway,
  ThemeMode mode, {
  Locale locale = const Locale('en'),
}) {
  return MultiBlocProvider(
    providers: [
      BlocProvider(create: (_) => AppBloc()),
      BlocProvider(
        create: (_) => AuthBloc(
          authService: gateway,
          sessionStorage: SessionStorage(vault: _Vault()),
          checkOnStart: false,
        ),
      ),
    ],
    child: MaterialApp(
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: mode,
      locale: locale,
      supportedLocales: const [Locale('ar'), Locale('en')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: const LoginScreen(),
    ),
  );
}

EditableText _passwordEditable(WidgetTester tester) => tester.widget(
  find.descendant(
    of: find.byKey(const Key('passwordField')),
    matching: find.byType(EditableText),
  ),
);

/// True when the chevron icon is drawn mirrored (Flutter wraps a
/// direction-aware icon in a horizontal flip in RTL).
bool _chevronMirrored(
  WidgetTester tester, {
  IconData icon = Icons.chevron_right,
}) {
  final transforms = find.descendant(
    of: find.byIcon(icon),
    matching: find.byType(Transform),
  );
  return transforms.evaluate().any(
    (e) => (e.widget as Transform).transform.storage[0] < 0,
  );
}

void main() {
  group('row chevrons point forward in each language', () {
    for (final direction in [TextDirection.rtl, TextDirection.ltr]) {
      final arabic = direction == TextDirection.rtl;
      testWidgets(
        '${arabic ? 'Arabic: left' : 'English: right'} on AppActionTile and SwiforaActionRow',
        (tester) async {
          for (final tile in <Widget>[
            AppActionTile(
              icon: Icons.report_outlined,
              title: 'Report',
              tone: AppTone.danger,
              onTap: () {},
            ),
            SwiforaActionRow(
              icon: Icons.sell_outlined,
              tone: AppTone.warning,
              title: 'Offers',
              onTap: () {},
            ),
          ]) {
            await tester.pumpWidget(
              MaterialApp(
                theme: AppTheme.dark,
                home: Directionality(
                  textDirection: direction,
                  child: Scaffold(body: tile),
                ),
              ),
            );
            expect(find.byIcon(Icons.chevron_right), findsOneWidget);
            // Mirrored in Arabic (points left), plain in English (right).
            expect(_chevronMirrored(tester), arabic);
          }
        },
      );
    }
  });

  for (final locale in const [Locale('ar'), Locale('en')]) {
    final arabic = locale.languageCode == 'ar';
    testWidgets(
      'sign-in arrow points ${arabic ? 'left in Arabic' : 'right in English'}',
      (tester) async {
        await tester.pumpWidget(
          _login(_Gateway(), ThemeMode.dark, locale: locale),
        );
        await tester.pump(const Duration(milliseconds: 100));
        expect(find.byIcon(Icons.arrow_forward_rounded), findsOneWidget);
        expect(
          _chevronMirrored(tester, icon: Icons.arrow_forward_rounded),
          arabic,
        );
      },
    );
  }

  for (final mode in [ThemeMode.light, ThemeMode.dark]) {
    testWidgets('login: show/hide password (${mode.name})', (tester) async {
      await tester.pumpWidget(_login(_Gateway(), mode));
      await tester.pump(const Duration(milliseconds: 100));

      expect(_passwordEditable(tester).obscureText, isTrue);
      expect(find.byTooltip('Show password'), findsOneWidget);

      await tester.tap(find.byKey(const Key('passwordVisibilityToggle')));
      await tester.pump();
      expect(_passwordEditable(tester).obscureText, isFalse);
      expect(find.byTooltip('Hide password'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('login: "Done" on the keyboard signs in once', (tester) async {
    final gateway = _Gateway();
    await tester.pumpWidget(_login(gateway, ThemeMode.dark));
    await tester.pump(const Duration(milliseconds: 100));

    await tester.enterText(
      find.byType(TextFormField).at(0),
      'user@example.com',
    );
    await tester.enterText(
      find.byKey(const Key('passwordField')),
      'Password123!',
    );
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pump(const Duration(milliseconds: 100));

    expect(gateway.loginCalls, 1);
  });

  testWidgets('login: empty fields from the keyboard do not sign in', (
    tester,
  ) async {
    final gateway = _Gateway();
    await tester.pumpWidget(_login(gateway, ThemeMode.light));
    await tester.pump(const Duration(milliseconds: 100));

    await tester.showKeyboard(find.byKey(const Key('passwordField')));
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pump();

    expect(gateway.loginCalls, 0);
    expect(find.text('Required'), findsWidgets);
  });

  group('create order', () {
    late Ux03Harness harness;

    setUp(() {
      harness = Ux03Harness();
      harness.api.reset();
      harness.api.responseDelay = const Duration(milliseconds: 400);
    });

    tearDown(() => harness.dispose());

    testWidgets('asks for the order type before sending', (tester) async {
      await harness.pumpScreen(tester, Ux03Screen.createOrder);

      final fields = find.byType(TextFormField);
      await tester.enterText(fields.at(0), 'Two boxes');
      await tester.enterText(fields.at(1), 'Main street');
      await tester.enterText(fields.at(2), '0501234567');

      final submit = find.byKey(const Key('submitOrderButton'));
      await tester.ensureVisible(submit);
      await tester.tap(submit);
      await tester.pump(const Duration(milliseconds: 50));

      // The question is repeated as the inline error; nothing was sent.
      expect(find.text('What should we deliver for you?'), findsNWidgets(2));
      expect(find.byType(AppButtonLoadingIndicator), findsNothing);

      // Choosing a type clears the error and lets the order go out.
      await tester.ensureVisible(find.text('Product Order'));
      await tester.pump();
      await tester.tap(find.text('Product Order'));
      await tester.pump();
      expect(find.text('What should we deliver for you?'), findsOneWidget);
      await tester.ensureVisible(submit);
      await tester.tap(submit);
      await tester.pump(const Duration(milliseconds: 50));
      expect(find.byType(AppButtonLoadingIndicator), findsOneWidget);
      await tester.pump(const Duration(seconds: 1));
    });

    testWidgets('the selected type is marked with a check, not only colour', (
      tester,
    ) async {
      await harness.pumpScreen(tester, Ux03Screen.createOrder);
      expect(find.byIcon(Icons.check_circle), findsNothing);
      await tester.tap(find.text('People Transport'));
      await tester.pump();
      expect(find.byIcon(Icons.check_circle), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });
}
