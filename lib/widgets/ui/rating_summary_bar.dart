import 'package:flutter/material.dart';

import '../../services/localization_service.dart';
import '../../services/theme_service.dart';
import 'app_tone.dart';

/// How someone has been rated, at a glance: five stars filled to the
/// average, "4.5 من 5", the number of ratings and how many liked them.
///
/// Customers see it for the driver on each price offer; drivers see the
/// same bar for the customer on a new order.
class RatingSummaryBar extends StatelessWidget {
  final double average;
  final int count;
  final int positiveCount;

  /// "Liked by %d customers" (for drivers) or "… drivers" (for customers).
  final String positiveLabelKey;

  /// Shown instead of the figures when nobody has rated yet.
  final String noRatingsKey;

  /// Optional extra chip (e.g. the driver's category).
  final Widget? trailing;

  const RatingSummaryBar({
    super.key,
    required this.average,
    required this.count,
    this.positiveCount = 0,
    this.positiveLabelKey = 'positive_ratings_count',
    this.noRatingsKey = 'no_ratings_yet',
    this.trailing,
  });

  /// From a server summary map `{average, count, positiveCount}`; a missing
  /// summary reads as "no ratings yet".
  factory RatingSummaryBar.fromSummary(
    Object? summary, {
    Key? key,
    String positiveLabelKey = 'positive_ratings_count',
    String noRatingsKey = 'no_ratings_yet',
    Widget? trailing,
  }) {
    final map = summary is Map ? summary : const {};
    return RatingSummaryBar(
      key: key,
      average: (map['average'] as num?)?.toDouble() ?? 0,
      count: (map['count'] as num?)?.toInt() ?? 0,
      positiveCount: (map['positiveCount'] as num?)?.toInt() ?? 0,
      positiveLabelKey: positiveLabelKey,
      noRatingsKey: noRatingsKey,
      trailing: trailing,
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final gold = appToneStyle(context, AppTone.warning).solid;
    final rated = count > 0;
    final averageText = AppLocalization.get(
      context,
      'rating_average',
    ).replaceAll('%s', average.toStringAsFixed(1));
    final countText = AppLocalization.get(
      context,
      'rating_count',
    ).replaceAll('%d', '$count');
    final positiveText = AppLocalization.get(
      context,
      positiveLabelKey,
    ).replaceAll('%d', '$positiveCount');
    final noneText = AppLocalization.get(context, noRatingsKey);

    final stars = <Widget>[
      for (var index = 0; index < 5; index += 1)
        Icon(
          rated && average >= index + 1
              ? Icons.star_rounded
              : rated && average >= index + 0.5
              ? Icons.star_half_rounded
              : Icons.star_border_rounded,
          size: 16,
          color: rated && average >= index + 0.5 ? gold : scheme.outlineVariant,
        ),
    ];

    return Semantics(
      label: rated
          ? [
              averageText,
              countText,
              if (positiveCount > 0) positiveText,
            ].join('، ')
          : noneText,
      excludeSemantics: trailing == null,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.sm + 2,
          vertical: AppSpacing.xs + 3,
        ),
        decoration: BoxDecoration(
          color: scheme.surfaceContainerHighest.withValues(alpha: 0.55),
          borderRadius: BorderRadius.circular(AppRadius.pill),
        ),
        child: Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.xs,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            // Stars fill left to right, like the rating scale.
            Directionality(
              textDirection: TextDirection.ltr,
              child: Row(mainAxisSize: MainAxisSize.min, children: stars),
            ),
            if (rated) ...[
              Text(
                averageText,
                style: theme.textTheme.labelLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: scheme.onSurface,
                ),
              ),
              Text(
                countText,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: scheme.onSurfaceVariant,
                ),
              ),
              if (positiveCount > 0)
                Text(
                  positiveText,
                  style: theme.textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: appToneStyle(context, AppTone.success).foreground,
                  ),
                ),
            ] else
              Text(
                noneText,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: scheme.onSurfaceVariant,
                ),
              ),
            ?trailing,
          ],
        ),
      ),
    );
  }
}
