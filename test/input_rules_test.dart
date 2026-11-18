// Wrong-kind input in the app's number and text fields: letters, symbols,
// Arabic-Indic digits, "NaN", huge values, very long text.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:swifora/services/offer_service.dart';
import 'package:swifora/services/validators.dart';
import 'package:swifora/widgets/ui/latin_digits_formatter.dart';

void main() {
  group('Validators.latinDigits', () {
    test('Arabic-Indic and Persian digits and decimal marks become Latin', () {
      expect(Validators.latinDigits('١٢٣٤٥٦٧٨٩٠'), '1234567890');
      expect(Validators.latinDigits('۱۲۳'), '123');
      expect(Validators.latinDigits('١٢٫٥'), '12.5');
      expect(Validators.latinDigits('12,5'), '12.5');
      expect(Validators.latinDigits('abc'), 'abc');
    });
  });

  group('Validators.parseAmount (offer price)', () {
    test('accepts a price however the digits are typed', () {
      expect(Validators.parseAmount('15'), 15);
      expect(Validators.parseAmount(' 12.5 '), 12.5);
      expect(Validators.parseAmount('١٥'), 15);
      expect(Validators.parseAmount('12,5'), 12.5);
      expect(Validators.parseAmount('١٢٫٥'), 12.5);
    });

    test('refuses anything that is not a plain amount', () {
      for (final input in [
        '',
        '   ',
        'abc',
        '15abc',
        'NaN',
        'Infinity',
        '1e6',
        '-5',
        '12.555',
        '1.2.3',
        '😀',
        '<script>',
        '99999999',
      ]) {
        expect(Validators.parseAmount(input), isNull, reason: input);
      }
    });

    test('the offer limits match the server', () {
      expect(OfferService.minOfferPrice, 9);
      expect(OfferService.maxOfferPrice, 100000);
      expect(OfferService.maxEstimatedMinutes, 1440);
    });
  });

  group('Validators.parseWholeNumber (delivery minutes)', () {
    test('digits only, Arabic-Indic included', () {
      expect(Validators.parseWholeNumber('30'), 30);
      expect(Validators.parseWholeNumber('٣٠'), 30);
      for (final input in ['', 'abc', '3.5', '-1', '30 min', '1e3']) {
        expect(Validators.parseWholeNumber(input), isNull, reason: input);
      }
    });
  });

  group('Validators.isValidName', () {
    test('2 to 80 characters after removing extra spaces', () {
      expect(Validators.isValidName('محمد علي'), isTrue);
      expect(Validators.isValidName('  Ahmad   Salem  '), isTrue);
      expect(Validators.isValidName('a'), isFalse);
      expect(Validators.isValidName('   '), isFalse);
      expect(Validators.isValidName('x' * 81), isFalse);
      expect(Validators.isValidName('x' * 80), isTrue);
    });
  });

  group('LatinDigitsFormatter', () {
    TextEditingValue type(LatinDigitsFormatter formatter, String text) =>
        formatter.formatEditUpdate(
          TextEditingValue.empty,
          TextEditingValue(
            text: text,
            selection: TextSelection.collapsed(offset: text.length),
          ),
        );

    test(
      'digits field: converts Arabic-Indic digits, drops everything else',
      () {
        const formatter = LatinDigitsFormatter();
        expect(type(formatter, '١٢٣٤').text, '1234');
        expect(type(formatter, '12ab34').text, '1234');
        expect(type(formatter, '<script>').text, '');
        expect(type(formatter, '12.5').text, '125');
      },
    );

    test('decimal field keeps one decimal point', () {
      const formatter = LatinDigitsFormatter(allowDecimal: true);
      expect(type(formatter, '١٢٫٥').text, '12.5');
      expect(type(formatter, '12,5').text, '12.5');
      expect(type(formatter, '1.2.3').text, '1.23');
      expect(type(formatter, 'NaN').text, '');
    });

    testWidgets('a digits field on an Arabic keyboard is not left empty', (
      tester,
    ) async {
      final controller = TextEditingController();
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: TextField(
              controller: controller,
              inputFormatters: [
                const LatinDigitsFormatter(),
                LengthLimitingTextInputFormatter(8),
              ],
            ),
          ),
        ),
      );
      await tester.enterText(find.byType(TextField), '١٢٣٤٥٦٧٨٩');
      expect(controller.text, '12345678');
    });
  });
}
