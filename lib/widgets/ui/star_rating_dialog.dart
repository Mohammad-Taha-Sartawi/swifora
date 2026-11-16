import 'package:flutter/material.dart';

import '../../services/localization_service.dart';
import '../../services/theme_service.dart';
import 'app_tone.dart';

/// Asks for a 1-5 star rating; returns the chosen value, or null if the
/// dialog was cancelled.
///
/// Tapping a star selects it (it does not send): the stars up to it fill in,
/// each star shows its number, and the choice is spelled out ("4 من 5 —
/// جيد جداً"). The rating is sent with the "Send rating" button, which stays
/// disabled until a star is chosen.
Future<int?> showStarRatingDialog(
  BuildContext context, {
  required String title,
  required String body,
}) {
  return showDialog<int>(
    context: context,
    builder: (_) => _StarRatingDialog(title: title, body: body),
  );
}

/// "Very poor" … "Excellent" for 1 … 5 stars.
String ratingWordFor(BuildContext context, int value) {
  const keys = [
    'rating_word_1',
    'rating_word_2',
    'rating_word_3',
    'rating_word_4',
    'rating_word_5',
  ];
  return AppLocalization.get(context, keys[(value - 1).clamp(0, 4)]);
}

class _StarRatingDialog extends StatefulWidget {
  final String title;
  final String body;

  const _StarRatingDialog({required this.title, required this.body});

  @override
  State<_StarRatingDialog> createState() => _StarRatingDialogState();
}

class _StarRatingDialogState extends State<_StarRatingDialog> {
  int _value = 0;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final gold = appToneStyle(context, AppTone.warning);
    final outOf = AppLocalization.get(context, 'rating_value_of_five');

    return AlertDialog(
      title: Text(widget.title, textAlign: TextAlign.center),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(widget.body, textAlign: TextAlign.center),
          const SizedBox(height: AppSpacing.md),
          // 1 … 5 always read left to right, also in Arabic, like a scale.
          Directionality(
            textDirection: TextDirection.ltr,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(5, (index) {
                final value = index + 1;
                final filled = value <= _value;
                return Semantics(
                  button: true,
                  selected: value == _value,
                  label:
                      '${outOf.replaceFirst('%d', '$value')} — ${ratingWordFor(context, value)}',
                  excludeSemantics: true,
                  child: InkResponse(
                    key: Key('ratingStar$value'),
                    onTap: () => setState(() => _value = value),
                    radius: 28,
                    child: SizedBox(
                      width: 48,
                      height: 64,
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            filled
                                ? Icons.star_rounded
                                : Icons.star_border_rounded,
                            size: 36,
                            color: filled ? gold.solid : scheme.outline,
                          ),
                          Text(
                            '$value',
                            style: theme.textTheme.labelMedium?.copyWith(
                              fontWeight: value == _value
                                  ? FontWeight.w900
                                  : FontWeight.w500,
                              color: value == _value
                                  ? scheme.onSurface
                                  : scheme.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          // The choice in words, so it is clear what will be sent.
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 150),
            child: Text(
              _value == 0
                  ? AppLocalization.get(context, 'rating_pick_hint')
                  : '${outOf.replaceFirst('%d', '$_value')} — ${ratingWordFor(context, _value)}',
              key: ValueKey(_value),
              textAlign: TextAlign.center,
              style: _value == 0
                  ? theme.textTheme.bodyMedium?.copyWith(
                      color: scheme.onSurfaceVariant,
                    )
                  : theme.textTheme.titleMedium?.copyWith(
                      color: gold.foreground,
                      fontWeight: FontWeight.w800,
                    ),
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(AppLocalization.get(context, 'cancel')),
        ),
        ElevatedButton(
          key: const Key('ratingSendButton'),
          onPressed: _value == 0 ? null : () => Navigator.pop(context, _value),
          child: Text(AppLocalization.get(context, 'rating_send')),
        ),
      ],
    );
  }
}

/// Compact "★ 4.5 (12)" label for a rating summary map `{average, count}`;
/// empty when there is no rating yet.
String ratingSummaryLabel(Object? summary) {
  if (summary is! Map) return '';
  final count = (summary['count'] as num?)?.toInt() ?? 0;
  if (count <= 0) return '';
  final average = (summary['average'] as num?)?.toDouble() ?? 0;
  return '★ ${average.toStringAsFixed(1)} ($count)';
}
