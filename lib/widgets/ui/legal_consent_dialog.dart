import 'package:flutter/material.dart';

import '../../services/legal_service.dart';
import '../../services/localization_service.dart';
import '../../services/theme_service.dart';

/// The terms or privacy agreement shown while creating an account.
///
/// Shows the text written in the dashboard settings; if it cannot be loaded
/// (or is empty) it shows the text that shipped with the app, so signing up
/// never asks to agree to an empty page. "Agree" is enabled only once the
/// text is on screen. Returns true for agree, false for decline.
Future<bool> showLegalConsentDialog(
  BuildContext context, {
  required String title,
  required String documentKey,
  required String fallbackText,
  LegalService? service,
}) async {
  final agreed = await showDialog<bool>(
    context: context,
    barrierDismissible: false,
    builder: (_) => _LegalConsentDialog(
      title: title,
      documentKey: documentKey,
      fallbackText: fallbackText,
      service: service ?? LegalService(),
    ),
  );
  return agreed == true;
}

/// Right-to-left when the text is mostly Arabic, otherwise left-to-right.
TextDirection legalTextDirection(String text) {
  final arabic = RegExp(r'[؀-ۿ]').allMatches(text).length;
  final latin = RegExp(r'[A-Za-z]').allMatches(text).length;
  return arabic >= latin ? TextDirection.rtl : TextDirection.ltr;
}

class _LegalConsentDialog extends StatefulWidget {
  final String title;
  final String documentKey;
  final String fallbackText;
  final LegalService service;

  const _LegalConsentDialog({
    required this.title,
    required this.documentKey,
    required this.fallbackText,
    required this.service,
  });

  @override
  State<_LegalConsentDialog> createState() => _LegalConsentDialogState();
}

class _LegalConsentDialogState extends State<_LegalConsentDialog> {
  String? _text;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    var text = '';
    try {
      final document = await widget.service
          .fetch(widget.documentKey)
          .timeout(const Duration(seconds: 12));
      text = document.content.trim();
    } catch (_) {
      text = '';
    }
    if (!mounted) return;
    setState(() => _text = text.isEmpty ? widget.fallbackText : text);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final text = _text;

    return AlertDialog(
      title: Text(widget.title, style: theme.textTheme.titleLarge),
      content: text == null
          ? const SizedBox(
              height: 120,
              child: Center(child: CircularProgressIndicator()),
            )
          : SingleChildScrollView(
              child: Text(
                text,
                key: const Key('legalConsentText'),
                style: theme.textTheme.bodySmall?.copyWith(height: 1.5),
                // The legal body keeps its own direction (Arabic documents
                // stay right-to-left in the English app).
                textDirection: legalTextDirection(text),
              ),
            ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          style: TextButton.styleFrom(foregroundColor: theme.colorScheme.error),
          child: Text(AppLocalization.get(context, 'decline')),
        ),
        ElevatedButton(
          onPressed: text == null ? null : () => Navigator.pop(context, true),
          child: Text(AppLocalization.get(context, 'agree')),
        ),
      ],
      actionsPadding: const EdgeInsetsDirectional.fromSTEB(
        AppSpacing.lg,
        0,
        AppSpacing.lg,
        AppSpacing.md,
      ),
    );
  }
}
