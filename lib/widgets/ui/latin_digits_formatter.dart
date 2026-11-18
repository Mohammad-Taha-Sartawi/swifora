import 'package:flutter/services.dart';

import '../../services/validators.dart';

/// Turns Arabic-Indic digits into 0-9 as they are typed and drops anything
/// that is not a digit (or one decimal point when [allowDecimal]). Without it
/// a digits-only field stays empty on an Arabic keyboard, and a number field
/// accepts letters.
class LatinDigitsFormatter extends TextInputFormatter {
  const LatinDigitsFormatter({this.allowDecimal = false});

  final bool allowDecimal;

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final converted = Validators.latinDigits(newValue.text);
    final buffer = StringBuffer();
    var hasDot = false;
    for (final char in converted.split('')) {
      if (RegExp(r'\d').hasMatch(char)) {
        buffer.write(char);
      } else if (allowDecimal && char == '.' && !hasDot) {
        hasDot = true;
        buffer.write(char);
      }
    }
    final text = buffer.toString();
    if (text == newValue.text) return newValue;
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}
