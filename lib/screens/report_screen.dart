import 'package:flutter/material.dart';
import '../services/date_format.dart';
import '../services/localization_service.dart';
import '../services/report_service.dart';
import '../services/responsive.dart';
import '../services/theme_service.dart';
import '../widgets/ui/app_button_loading_indicator.dart';
import '../widgets/ui/app_feedback.dart';
import '../widgets/ui/latin_digits_formatter.dart';
import '../widgets/ui/app_state_views.dart';
import '../widgets/ui/app_status_chip.dart';
import '../widgets/ui/app_tone.dart';

class ReportScreen extends StatefulWidget {
  final String token;
  final String reportType; // 'driver' or 'user'
  final String title; // 'الابلاغ عن سائق' or 'الابلاغ عن زبون'

  const ReportScreen({
    super.key,
    required this.token,
    required this.reportType,
    required this.title,
  });

  @override
  State<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends State<ReportScreen> {
  final _formKey = GlobalKey<FormState>();
  final _idController = TextEditingController();
  final _contentController = TextEditingController();
  final _service = ReportService();

  List<Map<String, dynamic>> _history = [];
  bool _loadingHistory = true;
  bool _historyFailed = false;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    if (!_loadingHistory || _historyFailed) {
      setState(() {
        _loadingHistory = true;
        _historyFailed = false;
      });
    }
    try {
      final reports = await _service.getMyReports(widget.token);
      if (!mounted) return;
      setState(() {
        _history = reports;
        _loadingHistory = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loadingHistory = false;
        _historyFailed = true;
      });
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _sending = true);
    try {
      await _service.submitReport(
        token: widget.token,
        reportedPublicId: _idController.text.trim(),
        reportType: widget.reportType,
        content: _contentController.text.trim(),
      );
      if (!mounted) return;
      _idController.clear();
      _contentController.clear();
      AppFeedback.success(context, AppLocalization.get(context, 'report_sent'));
      _loadHistory();
    } catch (e) {
      if (!mounted) return;
      final message = e is ReportException ? e.message : '';
      AppFeedback.error(
        context,
        message.isNotEmpty
            ? message
            : AppLocalization.get(context, 'something_went_wrong'),
      );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  String _statusLabel(BuildContext context, String? s) {
    switch (s) {
      case 'in-review':
        return AppLocalization.get(context, 'report_status_in_review');
      case 'in-progress':
        return AppLocalization.get(context, 'report_status_in_progress');
      case 'resolved':
        return AppLocalization.get(context, 'report_status_resolved');
      case 'rejected':
        return AppLocalization.get(context, 'report_status_rejected');
      default:
        return s ?? '';
    }
  }

  AppTone _statusTone(String? s) {
    switch (s) {
      case 'in-review':
        return AppTone.warning;
      case 'in-progress':
        return AppTone.info;
      case 'resolved':
        return AppTone.success;
      case 'rejected':
        return AppTone.danger;
      default:
        return AppTone.neutral;
    }
  }

  @override
  void dispose() {
    _idController.dispose();
    _contentController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final dangerTone = appToneStyle(context, AppTone.danger);

    return Scaffold(
      appBar: AppBar(title: Text(widget.title), centerTitle: true),
      body: SafeArea(
        top: false,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 600),
            child: SingleChildScrollView(
              padding: EdgeInsets.symmetric(
                horizontal: Responsive.paddingHorizontal(context),
                vertical: Responsive.paddingVertical(context),
              ),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextFormField(
                      controller: _idController,
                      textDirection: TextDirection.ltr,
                      decoration: InputDecoration(
                        labelText: AppLocalization.get(
                          context,
                          'report_id_label',
                        ),
                        hintText: AppLocalization.get(
                          context,
                          'report_id_hint',
                        ),
                        border: const OutlineInputBorder(),
                        prefixIcon: const Icon(Icons.person_search),
                      ),
                      keyboardType: TextInputType.number,
                      // Account IDs are digits: Arabic-Indic digits are
                      // converted, anything else is not typed at all.
                      inputFormatters: const [LatinDigitsFormatter()],
                      maxLength: 12,
                      validator: (v) => (v == null || v.trim().isEmpty)
                          ? AppLocalization.get(context, 'required')
                          : null,
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _contentController,
                      decoration: InputDecoration(
                        labelText: AppLocalization.get(
                          context,
                          'report_content_label',
                        ),
                        hintText: AppLocalization.get(
                          context,
                          'report_content_hint',
                        ),
                        border: const OutlineInputBorder(),
                        prefixIcon: const Icon(Icons.description),
                      ),
                      maxLines: 4,
                      // Same limit as the server (reports.js).
                      maxLength: 2000,
                      validator: (v) => (v == null || v.trim().isEmpty)
                          ? AppLocalization.get(context, 'required')
                          : null,
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      height: 48,
                      child: ElevatedButton(
                        onPressed: _sending ? null : _submit,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: dangerTone.solid,
                          foregroundColor: dangerTone.onSolid,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadiusDirectional.circular(
                              AppRadius.sm,
                            ),
                          ),
                        ),
                        child: _sending
                            ? const AppButtonLoadingIndicator()
                            : Text(
                                AppLocalization.get(context, 'report_submit'),
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                ),
                              ),
                      ),
                    ),
                    const SizedBox(height: 32),
                    Text(
                      AppLocalization.get(context, 'recent_reports'),
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (_loadingHistory)
                      const Center(
                        child: Padding(
                          padding: EdgeInsets.all(24),
                          child: CircularProgressIndicator(),
                        ),
                      )
                    else if (_historyFailed)
                      AppErrorState(
                        message: AppLocalization.get(
                          context,
                          'report_history_failed',
                        ),
                        onRetry: _loadHistory,
                      )
                    else if (_history.isEmpty)
                      Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Text(
                            AppLocalization.get(context, 'no_previous_reports'),
                            style: TextStyle(color: scheme.onSurfaceVariant),
                          ),
                        ),
                      )
                    else
                      ..._history.map((r) {
                        return Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(12),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        'ID ${r['reportedPublicId'] ?? ''}',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ),
                                    AppStatusChip(
                                      label: _statusLabel(context, r['status']),
                                      tone: _statusTone(r['status']),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  r['content'] ?? '',
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: scheme.onSurfaceVariant,
                                  ),
                                ),
                                if (r['date'] != null) ...[
                                  const SizedBox(height: 4),
                                  Text(
                                    formatServerDate(r['date']),
                                    textDirection: TextDirection.ltr,
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: scheme.onSurfaceVariant,
                                    ),
                                  ),
                                ],
                                if (r['replies'] is List &&
                                    (r['replies'] as List).isNotEmpty) ...[
                                  const Divider(height: 20),
                                  ...(r['replies'] as List).map((reply) {
                                    final isAdmin = reply['sender'] == 'admin';
                                    final replyTone = appToneStyle(
                                      context,
                                      isAdmin ? AppTone.info : AppTone.neutral,
                                    );

                                    return Container(
                                      margin: const EdgeInsets.only(top: 6),
                                      padding: const EdgeInsets.all(10),
                                      decoration: BoxDecoration(
                                        color: replyTone.background,
                                        borderRadius:
                                            BorderRadiusDirectional.circular(
                                              AppRadius.xs,
                                            ),
                                        border: Border.all(
                                          color: replyTone.border,
                                        ),
                                      ),
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            children: [
                                              Icon(
                                                isAdmin
                                                    ? Icons.admin_panel_settings
                                                    : Icons.person,
                                                size: 14,
                                                color: replyTone.foreground,
                                              ),
                                              const SizedBox(width: 4),
                                              Text(
                                                isAdmin
                                                    ? AppLocalization.get(
                                                        context,
                                                        'support_team',
                                                      )
                                                    : AppLocalization.get(
                                                        context,
                                                        'you',
                                                      ),
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  fontWeight: FontWeight.bold,
                                                  color: replyTone.foreground,
                                                ),
                                              ),
                                              const Spacer(),
                                              if (reply['time'] != null)
                                                Text(
                                                  reply['time'].toString(),
                                                  style: TextStyle(
                                                    fontSize: 10,
                                                    color: replyTone.foreground,
                                                  ),
                                                ),
                                            ],
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            reply['text'] ?? '',
                                            style: const TextStyle(
                                              fontSize: 13,
                                            ),
                                          ),
                                        ],
                                      ),
                                    );
                                  }),
                                ],
                              ],
                            ),
                          ),
                        );
                      }),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
