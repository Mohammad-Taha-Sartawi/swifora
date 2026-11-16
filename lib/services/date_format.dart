/// Dates are shown as numbers in the app: DD/MM/YYYY, plus HH:mm when the
/// time matters (same format as the dashboard). Western digits, read
/// left-to-right inside Arabic text.
library;

String _two(int value) => value.toString().padLeft(2, '0');

/// `16/11/2026`, in the device's local time.
String formatDisplayDate(DateTime value) {
  final local = value.toLocal();
  return '${_two(local.day)}/${_two(local.month)}/${local.year}';
}

/// `16/11/2026 08:04`, in the device's local time.
String formatDisplayDateTime(DateTime value) {
  final local = value.toLocal();
  return '${formatDisplayDate(local)} ${_two(local.hour)}:${_two(local.minute)}';
}

/// Formats a date coming from the server: an ISO timestamp or a plain
/// `YYYY-MM-DD` day. Anything else is returned unchanged.
String formatServerDate(Object? raw, {bool withTime = false}) {
  final text = raw?.toString().trim() ?? '';
  if (text.isEmpty) return '';
  final day = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(text);
  if (day != null) {
    return '${day.group(3)}/${day.group(2)}/${day.group(1)}';
  }
  final parsed = DateTime.tryParse(text);
  if (parsed == null) return text;
  return withTime ? formatDisplayDateTime(parsed) : formatDisplayDate(parsed);
}
