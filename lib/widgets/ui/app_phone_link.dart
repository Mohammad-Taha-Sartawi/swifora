import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../services/localization_service.dart';
import '../../services/theme_service.dart';
import 'app_feedback.dart';

/// A phone number the user can tap to call.
///
/// Numbers always read left-to-right, also inside Arabic text. Used where the
/// app already shows a phone number (the customer's number on the driver's
/// order screens); it does not reveal any number that was hidden before.
class AppPhoneLink extends StatelessWidget {
  final String phone;
  final TextStyle? style;

  const AppPhoneLink({super.key, required this.phone, this.style});

  /// The number to dial, or null when it cannot be called: empty, or masked
  /// by the server (e.g. `0590000***` before the customer accepts an offer).
  static Uri? telUri(String phone) {
    if (phone.contains('*') || phone.contains('•')) return null;
    final digits = phone.replaceAll(RegExp(r'[^0-9+]'), '');
    if (digits.replaceAll('+', '').length < 7) return null;
    return Uri(scheme: 'tel', path: digits);
  }

  Future<void> _call(BuildContext context) async {
    final uri = telUri(phone);
    var opened = false;
    if (uri != null) {
      try {
        opened = await launchUrl(uri);
      } catch (_) {
        opened = false;
      }
    }
    if (!opened && context.mounted) {
      AppFeedback.error(context, AppLocalization.get(context, 'call_failed'));
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final label = AppLocalization.get(context, 'call_number');
    if (telUri(phone) == null) {
      // Masked or incomplete: plain text, not a link.
      return Text(
        phone,
        textDirection: TextDirection.ltr,
        style: style ?? Theme.of(context).textTheme.bodyMedium,
      );
    }
    return Semantics(
      button: true,
      label: '$label $phone',
      excludeSemantics: true,
      child: InkWell(
        onTap: telUri(phone) == null ? null : () => _call(context),
        borderRadius: BorderRadius.circular(AppRadius.sm),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: AppSizes.minTouchTarget),
          child: Padding(
            padding: const EdgeInsetsDirectional.symmetric(
              horizontal: AppSpacing.xs,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.call_outlined,
                  size: AppSizes.iconSm,
                  color: scheme.primary,
                ),
                const SizedBox(width: AppSpacing.xs),
                Flexible(
                  child: Text(
                    phone,
                    textDirection: TextDirection.ltr,
                    style: (style ?? Theme.of(context).textTheme.bodyMedium)
                        ?.copyWith(
                          color: scheme.primary,
                          decoration: TextDecoration.underline,
                          decorationColor: scheme.primary,
                        ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
