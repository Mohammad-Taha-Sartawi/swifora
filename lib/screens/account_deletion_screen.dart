import 'package:flutter/material.dart';

import '../services/account_deletion_service.dart';
import '../services/date_format.dart';
import '../services/localization_service.dart';
import '../services/responsive.dart';
import '../services/theme_service.dart';
import '../widgets/ui/app_button_loading_indicator.dart';
import '../widgets/ui/app_confirm_dialog.dart';
import '../widgets/ui/app_feedback.dart';
import '../widgets/ui/app_state_views.dart';
import '../widgets/ui/app_tone.dart';

/// "Delete account": the customer or driver asks the admins to delete the
/// account. A driver's request is checked for platform commission still
/// owed, a customer's waits for unfinished orders; until an admin approves
/// it, the request can be withdrawn here.
class AccountDeletionScreen extends StatefulWidget {
  const AccountDeletionScreen({
    super.key,
    required this.token,
    required this.role,
    this.service,
  });

  final String token;

  /// 'customer' or 'provider'.
  final String role;
  final AccountDeletionService? service;

  @override
  State<AccountDeletionScreen> createState() => _AccountDeletionScreenState();
}

class _AccountDeletionScreenState extends State<AccountDeletionScreen> {
  late final AccountDeletionService _service =
      widget.service ?? AccountDeletionService();

  bool _loading = true;
  bool _loadFailed = false;
  bool _busy = false;
  AccountDeletionRequest? _request;

  bool get _isDriver => widget.role == 'provider';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _loadFailed = false;
    });
    try {
      final request = await _service.status(widget.token);
      if (!mounted) return;
      setState(() {
        _request = request;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _loadFailed = true;
      });
    }
  }

  Future<void> _send() async {
    final confirmed = await showAppConfirmDialog(
      context,
      title: AppLocalization.get(context, 'delete_account_confirm_title'),
      message: AppLocalization.get(context, 'delete_account_confirm'),
      confirmLabel: AppLocalization.get(context, 'delete_account_send'),
      destructive: true,
    );
    if (!confirmed || !mounted) return;
    await _run(() async {
      final request = await _service.send(widget.token);
      if (!mounted) return;
      setState(() => _request = request);
      AppFeedback.success(
        context,
        AppLocalization.get(context, 'delete_account_sent'),
      );
    });
  }

  Future<void> _withdraw() async {
    await _run(() async {
      await _service.withdraw(widget.token);
      if (!mounted) return;
      setState(() => _request = null);
      AppFeedback.success(
        context,
        AppLocalization.get(context, 'delete_account_withdrawn'),
      );
    });
  }

  Future<void> _run(Future<void> Function() action) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await action();
    } on AccountDeletionException catch (e) {
      if (!mounted) return;
      AppFeedback.error(
        context,
        e.message.isNotEmpty
            ? e.message
            : AppLocalization.get(context, 'something_went_wrong'),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(AppLocalization.get(context, 'delete_account')),
        centerTitle: true,
      ),
      body: SafeArea(
        top: false,
        child: _loading
            ? const AppLoadingState()
            : _loadFailed
            ? AppErrorState(
                message: AppLocalization.get(context, 'something_went_wrong'),
                onRetry: _load,
              )
            : Align(
                alignment: Alignment.topCenter,
                child: ConstrainedBox(
                  constraints: const BoxConstraints(
                    maxWidth: Responsive.maxReadableContentWidth,
                  ),
                  child: SingleChildScrollView(
                    padding: Responsive.pageInsets(context),
                    child: _request == null
                        ? _buildRequestForm(context)
                        : _buildPending(context, _request!),
                  ),
                ),
              ),
      ),
    );
  }

  Widget _buildRequestForm(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Icon(Icons.person_remove_outlined, size: 56, color: scheme.error),
        const SizedBox(height: AppSpacing.lg),
        Text(
          AppLocalization.get(context, 'delete_account_title'),
          style: theme.textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          AppLocalization.get(
            context,
            _isDriver
                ? 'delete_account_explain_driver'
                : 'delete_account_explain_customer',
          ),
          style: theme.textTheme.bodyLarge,
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          AppLocalization.get(context, 'delete_account_explain_withdraw'),
          style: theme.textTheme.bodyMedium?.copyWith(
            color: scheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: AppSpacing.xl),
        SizedBox(
          height: AppSizes.buttonHeight,
          child: ElevatedButton.icon(
            key: const Key('deleteAccountSend'),
            onPressed: _busy ? null : _send,
            style: ElevatedButton.styleFrom(
              backgroundColor: scheme.error,
              foregroundColor: scheme.onError,
            ),
            icon: _busy
                ? const SizedBox.shrink()
                : const Icon(Icons.delete_outline),
            label: _busy
                ? const AppButtonLoadingIndicator()
                : Text(AppLocalization.get(context, 'delete_account_send')),
          ),
        ),
      ],
    );
  }

  Widget _buildPending(BuildContext context, AccountDeletionRequest request) {
    final theme = Theme.of(context);
    final tone = appToneStyle(context, AppTone.warning);
    final sentAt = request.requestedAt;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(AppSpacing.lg),
          decoration: BoxDecoration(
            color: tone.background,
            border: Border.all(color: tone.border),
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.hourglass_top_rounded, color: tone.foreground),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      AppLocalization.get(context, 'delete_account_pending'),
                      key: const Key('deleteAccountPending'),
                      style: theme.textTheme.titleMedium?.copyWith(
                        color: tone.foreground,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    if (sentAt != null) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        AppLocalization.get(
                          context,
                          'delete_account_sent_on',
                        ).replaceFirst('%s', formatDisplayDateTime(sentAt)),
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: tone.foreground,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          AppLocalization.get(
            context,
            _isDriver
                ? 'delete_account_explain_driver'
                : 'delete_account_explain_customer',
          ),
          style: theme.textTheme.bodyLarge,
        ),
        const SizedBox(height: AppSpacing.xl),
        SizedBox(
          height: AppSizes.buttonHeight,
          child: OutlinedButton.icon(
            key: const Key('deleteAccountWithdraw'),
            onPressed: _busy ? null : _withdraw,
            icon: _busy ? const SizedBox.shrink() : const Icon(Icons.undo),
            label: _busy
                ? const AppButtonLoadingIndicator()
                : Text(AppLocalization.get(context, 'delete_account_withdraw')),
          ),
        ),
      ],
    );
  }
}
