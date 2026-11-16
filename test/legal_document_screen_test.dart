// Privacy policy and terms of use in the app: shown exactly as written in
// the dashboard, with clear empty and error states, reachable from the
// account menu and before signing in.
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:swifora/screens/legal_document_screen.dart';
import 'package:swifora/services/legal_defaults.dart';
import 'package:swifora/services/legal_service.dart';
import 'package:swifora/widgets/ui/legal_consent_dialog.dart';

class _FakeLegalService implements LegalService {
  _FakeLegalService(this.responses);

  /// Each call returns the next item: a [LegalDocument] or an error.
  final List<Object> responses;
  int calls = 0;

  @override
  Future<LegalDocument> fetch(String key) async {
    final next = responses[calls.clamp(0, responses.length - 1)];
    calls += 1;
    if (next is LegalDocument) return next;
    throw next;
  }
}

Widget _app(Widget home, {Locale locale = const Locale('en')}) => MaterialApp(
  locale: locale,
  supportedLocales: const [Locale('ar'), Locale('en')],
  localizationsDelegates: const [
    GlobalMaterialLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
  ],
  home: home,
);

void main() {
  consentTests();

  test('app and server carry the same shipped texts', () {
    final js = File(
      'swifora_backend/src/services/legalDefaults.js',
    ).readAsStringSync();
    String read(String key) =>
        jsonDecode(
              RegExp(
                '  $key: '
                r'("(?:[^"\\]|\\.)*"),',
              ).firstMatch(js)!.group(1)!,
            )
            as String;
    expect(read('terms'), LegalDefaults.terms);
    expect(read('privacy'), LegalDefaults.privacy);
  });

  testWidgets('shows the text as written, with the update date', (
    tester,
  ) async {
    final service = _FakeLegalService([
      LegalDocument(
        key: 'privacy',
        content: 'First paragraph.\n\nSecond line\nThird line',
        updatedAt: DateTime(2026, 11, 16, 9, 30),
      ),
    ]);
    await tester.pumpWidget(
      _app(LegalDocumentScreen(documentKey: 'privacy', service: service)),
    );
    await tester.pumpAndSettle();

    expect(find.text('Privacy policy'), findsOneWidget);
    expect(find.text('Last updated: 16/11/2026'), findsOneWidget);
    final text = tester.widget<SelectableText>(
      find.byKey(const Key('legalDocumentText')),
    );
    expect(text.data, 'First paragraph.\n\nSecond line\nThird line');
  });

  testWidgets('an unpublished text says so', (tester) async {
    final service = _FakeLegalService([
      const LegalDocument(key: 'terms', content: '   '),
    ]);
    await tester.pumpWidget(
      _app(LegalDocumentScreen(documentKey: 'terms', service: service)),
    );
    await tester.pumpAndSettle();

    expect(find.text('Terms of use'), findsOneWidget);
    expect(find.text("This text hasn't been published yet."), findsOneWidget);
  });

  testWidgets('a failed load offers a retry that loads the text', (
    tester,
  ) async {
    final service = _FakeLegalService([
      Exception('offline'),
      const LegalDocument(key: 'terms', content: 'The terms.'),
    ]);
    await tester.pumpWidget(
      _app(LegalDocumentScreen(documentKey: 'terms', service: service)),
    );
    await tester.pumpAndSettle();

    expect(
      find.text("Couldn't load the text. Check your connection and try again."),
      findsOneWidget,
    );
    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();
    expect(find.text('The terms.'), findsOneWidget);
    expect(service.calls, 2);
  });

  testWidgets('Arabic titles', (tester) async {
    final service = _FakeLegalService([
      const LegalDocument(key: 'privacy', content: 'نص.'),
    ]);
    await tester.pumpWidget(
      _app(
        LegalDocumentScreen(documentKey: 'privacy', service: service),
        locale: const Locale('ar'),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('سياسة الخصوصية'), findsOneWidget);
  });

  test('reachable from the account menu and before signing in', () {
    final sheet = File(
      'lib/widgets/brand/swifora_home_chrome.dart',
    ).readAsStringSync();
    expect(sheet, contains("Key('accountPrivacyPolicy')"));
    expect(sheet, contains("Key('accountTermsOfUse')"));

    final login = File('lib/screens/login_screen.dart').readAsStringSync();
    expect(login, contains("Key('loginPrivacyPolicy')"));
    expect(login, contains("Key('loginTermsOfUse')"));
    // Creating an account still asks to agree to each text.
    expect(login, contains('showLegalConsentDialog('));

    // Public endpoint: no sign-in token is sent.
    final service = File('lib/services/legal_service.dart').readAsStringSync();
    expect(service, contains("_dio.get('/legal/\$key')"));
    expect(service, isNot(contains('Authorization')));
  });
}

Widget _consentHost(LegalService service, void Function(bool) onResult) => _app(
  Builder(
    builder: (context) => ElevatedButton(
      onPressed: () async => onResult(
        await showLegalConsentDialog(
          context,
          title: 'Terms of Service',
          documentKey: 'terms',
          fallbackText: 'Built-in terms.',
          service: service,
        ),
      ),
      child: const Text('open'),
    ),
  ),
);

class _SlowLegalService implements LegalService {
  final completer = Completer<LegalDocument>();
  @override
  Future<LegalDocument> fetch(String key) => completer.future;
}

void consentTests() {
  testWidgets('sign-up agreement shows the dashboard text', (tester) async {
    bool? agreed;
    await tester.pumpWidget(
      _consentHost(
        _FakeLegalService([
          const LegalDocument(
            key: 'terms',
            content: 'Terms from the dashboard.',
          ),
        ]),
        (value) => agreed = value,
      ),
    );
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    expect(find.text('Terms from the dashboard.'), findsOneWidget);
    await tester.tap(find.text('Agree'));
    await tester.pumpAndSettle();
    expect(agreed, isTrue);
  });

  testWidgets('offline or empty: the built-in text, never an empty page', (
    tester,
  ) async {
    bool? agreed;
    await tester.pumpWidget(
      _consentHost(
        _FakeLegalService([Exception('offline')]),
        (value) => agreed = value,
      ),
    );
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    expect(find.text('Built-in terms.'), findsOneWidget);
    await tester.tap(find.text('Decline'));
    await tester.pumpAndSettle();
    expect(agreed, isFalse);
  });

  testWidgets('agree stays locked until the text is shown', (tester) async {
    final service = _SlowLegalService();
    await tester.pumpWidget(_consentHost(service, (_) {}));
    await tester.tap(find.text('open'));
    await tester.pump();
    final agree = find.widgetWithText(ElevatedButton, 'Agree');
    expect(tester.widget<ElevatedButton>(agree).onPressed, isNull);
    service.completer.complete(
      const LegalDocument(key: 'terms', content: 'Loaded.'),
    );
    await tester.pumpAndSettle();
    expect(tester.widget<ElevatedButton>(agree).onPressed, isNotNull);
  });
}
