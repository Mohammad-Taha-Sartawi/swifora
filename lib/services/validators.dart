class Validators {
  static const int minPasswordLength = 12;
  static const int maxPasswordLength = 128;

  static const Set<String> _insecurePasswords = {
    'admin123',
    'do-not-store-a-real-password-here',
    'changeme',
    'change-me',
    'change me',
  };

  static final RegExp _obviousPlaceholderPattern = RegExp(
    r'^(change|replace|your|example|placeholder|dummy)[-_ ]',
  );

  static String? email(String? value) {
    if (value == null || value.trim().isEmpty) return 'مطلوب / Required';
    final emailRegex = RegExp(
      r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
    );
    if (!emailRegex.hasMatch(value.trim())) {
      return 'بريد إلكتروني غير صالح / Invalid email';
    }
    return null;
  }

  static String? password(String? value) {
    if (value == null || value.isEmpty) return 'مطلوب / Required';

    final normalized = value.trim().toLowerCase();

    if (value.trim().length < minPasswordLength ||
        value.length > maxPasswordLength) {
      return 'بين 12 و128 حرفاً / 12-128 characters';
    }

    if (_insecurePasswords.contains(normalized) ||
        _obviousPlaceholderPattern.hasMatch(normalized)) {
      return 'اختر كلمة مرور غير افتراضية / Avoid obvious placeholder passwords';
    }

    return null;
  }

  static String? phone(String? value) {
    if (value == null || value.trim().isEmpty) return 'مطلوب / Required';
    if (!isValidPhone(value)) return 'رقم غير صالح / Invalid number';
    return null;
  }

  /// Drops spaces, dashes, dots, brackets and direction marks, turns
  /// Arabic-Indic digits into 0-9 and a leading 00 into +.
  static String normalizePhone(String value) {
    final buffer = StringBuffer();
    for (final rune in value.trim().runes) {
      if (rune >= 0x0660 && rune <= 0x0669) {
        buffer.write(rune - 0x0660);
      } else if (rune >= 0x06F0 && rune <= 0x06F9) {
        buffer.write(rune - 0x06F0);
      } else {
        buffer.writeCharCode(rune);
      }
    }
    var number = buffer.toString().replaceAll(
      RegExp(r'[\s\-().\u200E\u200F\u202A-\u202E\u2066-\u2069]'),
      '',
    );
    if (number.startsWith('00')) number = '+${number.substring(2)}';
    return number;
  }

  static final RegExp _mobileNumber = RegExp(r'^(?:0|\+97[02])5\d(\d{7})$');

  /// A mobile number used in Palestine: 05X and 7 digits (0599123456), or
  /// +970 / +972 instead of the 0. The last 7 digits may not all be the same.
  static bool isValidPhone(String value) {
    final match = _mobileNumber.firstMatch(normalizePhone(value));
    if (match == null) return false;
    return !RegExp(r'^(\d)\1{6}$').hasMatch(match.group(1)!);
  }

  static final RegExp _emailLabel = RegExp(
    r'^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$',
  );

  /// A complete address: name@domain.tld, no leading, trailing or double
  /// dots, a letter TLD (the server also checks the domain receives mail).
  static bool isCompleteEmail(String value) {
    final email = value.trim().toLowerCase();
    if (email.length > 254) return false;
    if (!RegExp(
      r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
    ).hasMatch(email)) {
      return false;
    }
    final at = email.lastIndexOf('@');
    final local = email.substring(0, at);
    final domain = email.substring(at + 1);
    if (local.isEmpty || local.length > 64) return false;
    if (local.startsWith('.') || local.endsWith('.') || local.contains('..')) {
      return false;
    }
    final labels = domain.split('.');
    if (labels.length < 2 || !labels.every(_emailLabel.hasMatch)) return false;
    return RegExp(r'^[a-z]{2,24}$').hasMatch(labels.last);
  }

  static const Map<String, String> _domainTypos = {
    'gmail.con': 'gmail.com',
    'gmail.co': 'gmail.com',
    'gmail.cm': 'gmail.com',
    'gmail.om': 'gmail.com',
    'gmail.comm': 'gmail.com',
    'gmail.cpm': 'gmail.com',
    'gmail.vom': 'gmail.com',
    'gmai.com': 'gmail.com',
    'gmial.com': 'gmail.com',
    'gamil.com': 'gmail.com',
    'gmal.com': 'gmail.com',
    'gmaill.com': 'gmail.com',
    'gnail.com': 'gmail.com',
    'gmeil.com': 'gmail.com',
    'hotmail.con': 'hotmail.com',
    'hotmail.co': 'hotmail.com',
    'hotmial.com': 'hotmail.com',
    'hotmai.com': 'hotmail.com',
    'hotmal.com': 'hotmail.com',
    'homail.com': 'hotmail.com',
    'hotmil.com': 'hotmail.com',
    'outlook.con': 'outlook.com',
    'outlook.co': 'outlook.com',
    'outlok.com': 'outlook.com',
    'outllok.com': 'outlook.com',
    'yahoo.con': 'yahoo.com',
    'yahoo.co': 'yahoo.com',
    'yaho.com': 'yahoo.com',
    'yahooo.com': 'yahoo.com',
    'icloud.con': 'icloud.com',
    'iclod.com': 'icloud.com',
    'icoud.com': 'icloud.com',
  };

  /// The intended address when [value] misspells a mail provider
  /// (name@gmail.con → name@gmail.com), else null.
  static String? suggestedEmail(String value) {
    final email = value.trim().toLowerCase();
    final at = email.lastIndexOf('@');
    if (at <= 0) return null;
    final fix = _domainTypos[email.substring(at + 1)];
    return fix == null ? null : '${email.substring(0, at)}@$fix';
  }

  static String? required(String? value) {
    if (value == null || value.trim().isEmpty) return 'مطلوب / Required';
    return null;
  }

  static String? price(String? value) {
    if (value == null || value.trim().isEmpty) return 'مطلوب / Required';
    final price = double.tryParse(value.trim());
    if (price == null || price <= 0) {
      return 'يجب أن يكون السعر أكبر من 0 / Price must be > 0';
    }
    return null;
  }
}
