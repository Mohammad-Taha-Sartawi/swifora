// Sign-up accepts only a real mobile number and a complete email (same rules
// as the server: swifora_backend/src/services/phoneNumbers.js and
// emailCheck.js). Sign-in only checks the email is well formed.
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:swifora/bloc/app/app_bloc.dart';
import 'package:swifora/bloc/auth/auth_bloc.dart';
import 'package:swifora/screens/login_screen.dart';
import 'package:swifora/services/api_config.dart';
import 'package:swifora/services/auth_service.dart';
import 'package:swifora/services/session_storage.dart';
import 'package:swifora/services/theme_service.dart';
import 'package:swifora/services/validators.dart';

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
  group('phone numbers', () {
    test('mobile numbers used in Palestine, in any common writing', () {
      for (final typed in [
        '0599123456',
        '0568123456',
        '0527123456',
        '059 912 3456',
        '059-912-3456',
        '+970599123456',
        '+972 52 712 3456',
        '00970599123456',
        '٠٥٩٩١٢٣٤٥٦',
        '۰۵۶۸۱۲۳۴۵۶',
      ]) {
        expect(Validators.isValidPhone(typed), isTrue, reason: typed);
      }
      expect(Validators.normalizePhone('٠٥٩٩ ١٢٣ ٤٥٦'), '0599123456');
      expect(Validators.normalizePhone('00970 59 912 3456'), '+970599123456');
    });

    test('other numbers are refused', () {
      for (final typed in [
        '',
        '0599',
        '059912345',
        '05991234567',
        '599123456',
        '0499123456',
        '0222981234',
        '+12025550143',
        '+971599123456',
        '0590000000',
        '05991234ab',
      ]) {
        expect(Validators.isValidPhone(typed), isFalse, reason: typed);
      }
    });
  });

  group('emails', () {
    test('complete addresses only', () {
      for (final email in [
        'name@gmail.com',
        'first.last+tag@mail.co.uk',
        ' Name@Gmail.COM ',
      ]) {
        expect(Validators.isCompleteEmail(email), isTrue, reason: email);
      }
      for (final email in [
        'name',
        'name@',
        '@gmail.com',
        'name@gmail',
        '.name@gmail.com',
        'na..me@gmail.com',
        'name@gmail..com',
        'name@-gmail.com',
        'name@gmail.c',
        'name@gmail.123',
      ]) {
        expect(Validators.isCompleteEmail(email), isFalse, reason: email);
      }
    });

    test('misspelled providers get the right address suggested', () {
      expect(Validators.suggestedEmail('Ahmad@Gmail.con'), 'ahmad@gmail.com');
      expect(Validators.suggestedEmail('a@hotmial.com'), 'a@hotmail.com');
      expect(Validators.suggestedEmail('a@gmail.com'), isNull);
    });
  });

  group('sign-up form', () {
    setUp(() => ApiConfig.initForTesting('http://127.0.0.1:1'));

    Future<void> openSignUp(WidgetTester tester) async {
      await tester.pumpWidget(_app());
      await tester.pumpAndSettle();
      final toggle = find.textContaining(
        "Don't have an account?",
        findRichText: true,
      );
      await tester.ensureVisible(toggle);
      await tester.tap(toggle);
      await tester.pumpAndSettle();
    }

    Future<void> submit(WidgetTester tester) async {
      final button = find.widgetWithText(ElevatedButton, 'Create Account');
      await tester.ensureVisible(button);
      await tester.tap(button);
      await tester.pumpAndSettle();
    }

    testWidgets('a wrong number and an incomplete email are explained', (
      tester,
    ) async {
      await openSignUp(tester);
      await tester.enterText(
        find.byKey(const Key('registerPhoneField')),
        '12345',
      );
      await tester.enterText(find.byKey(const Key('emailField')), 'name@gmail');
      await submit(tester);
      expect(
        find.text(
          'Invalid number. Enter a 10-digit mobile number starting with 05, e.g. 0599123456',
        ),
        findsOneWidget,
      );
      expect(
        find.text('Invalid email. Enter the full address, e.g. name@gmail.com'),
        findsOneWidget,
      );
    });

    testWidgets('a misspelled provider gets the right address suggested', (
      tester,
    ) async {
      await openSignUp(tester);
      await tester.enterText(
        find.byKey(const Key('registerPhoneField')),
        '٠٥٩٩١٢٣٤٥٦',
      );
      await tester.enterText(
        find.byKey(const Key('emailField')),
        'ahmad@gmial.com',
      );
      await submit(tester);
      expect(
        find.text('This email looks misspelled. Did you mean ahmad@gmail.com?'),
        findsOneWidget,
      );
      // The Arabic-digit number is fine.
      expect(find.textContaining('Invalid number'), findsNothing);
    });

    testWidgets('sign-in only needs a well-formed email', (tester) async {
      await tester.pumpWidget(_app());
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('emailField')), 'name');
      final button = find.widgetWithText(ElevatedButton, 'Sign In');
      await tester.ensureVisible(button);
      await tester.tap(button);
      await tester.pumpAndSettle();
      expect(find.text('Invalid email'), findsOneWidget);
      expect(find.textContaining('full address'), findsNothing);
    });
  });
}
