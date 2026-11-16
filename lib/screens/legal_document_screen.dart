import 'package:flutter/material.dart';

import '../services/date_format.dart';
import '../services/legal_service.dart';
import '../services/localization_service.dart';
import '../services/responsive.dart';
import '../services/theme_service.dart';
import '../widgets/ui/app_state_views.dart';

/// Shows the privacy policy or the terms of use written in the dashboard,
/// exactly as written (line breaks kept, text selectable).
class LegalDocumentScreen extends StatefulWidget {
  /// [LegalService.privacy] or [LegalService.terms].
  final String documentKey;
  final LegalService? service;

  const LegalDocumentScreen({
    super.key,
    required this.documentKey,
    this.service,
  });

  static String titleKeyFor(String documentKey) =>
      documentKey == LegalService.terms ? 'terms_of_use' : 'privacy_policy';

  /// Opens the screen for [documentKey].
  static Future<void> open(BuildContext context, String documentKey) {
    return Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => LegalDocumentScreen(documentKey: documentKey),
      ),
    );
  }

  @override
  State<LegalDocumentScreen> createState() => _LegalDocumentScreenState();
}

class _LegalDocumentScreenState extends State<LegalDocumentScreen> {
  late final LegalService _service = widget.service ?? LegalService();
  LegalDocument? _document;
  bool _loading = true;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!_loading || _failed) {
      setState(() {
        _loading = true;
        _failed = false;
      });
    }
    try {
      final document = await _service.fetch(widget.documentKey);
      if (!mounted) return;
      setState(() {
        _document = document;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _failed = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final title = AppLocalization.get(
      context,
      LegalDocumentScreen.titleKeyFor(widget.documentKey),
    );

    Widget body;
    if (_loading) {
      body = const AppLoadingState();
    } else if (_failed) {
      body = AppErrorState(
        message: AppLocalization.get(context, 'legal_load_failed'),
        onRetry: _load,
      );
    } else if ((_document?.content.trim() ?? '').isEmpty) {
      body = AppEmptyState(
        icon: Icons.description_outlined,
        title: AppLocalization.get(context, 'legal_not_published'),
      );
    } else {
      final updatedAt = _document!.updatedAt;
      body = RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: EdgeInsets.symmetric(
            horizontal: Responsive.paddingHorizontal(context),
            vertical: AppSpacing.lg,
          ),
          children: [
            if (updatedAt != null) ...[
              Text(
                AppLocalization.get(
                  context,
                  'legal_updated_at',
                ).replaceFirst('%s', formatDisplayDate(updatedAt)),
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
            ],
            // Written by the admin in either language: the text picks its
            // own direction.
            SelectableText(
              _document!.content,
              key: const Key('legalDocumentText'),
              style: theme.textTheme.bodyLarge?.copyWith(height: 1.8),
            ),
          ],
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text(title), centerTitle: true),
      body: SafeArea(
        top: false,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 720),
            child: body,
          ),
        ),
      ),
    );
  }
}
