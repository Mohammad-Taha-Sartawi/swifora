import 'package:flutter/material.dart';

import '../../services/localization_service.dart';
import '../../services/theme_service.dart';
import '../ui/app_tone.dart';

/// Brand and layout pieces of the owner-approved Swifora Delivery screens
/// (Login, Customer Home, Driver Dashboard, Create Order).

bool _isDark(BuildContext context) =>
    Theme.of(context).brightness == Brightness.dark;

/// The Swifora logo (the same image as the app icon and the splash screen),
/// a rounded navy tile. Decorative: the name next to it is what is read out.
class SwiforaMark extends StatelessWidget {
  static const asset = 'assets/branding/logo_tile.png';

  final double size;

  /// Lifts the logo off the page with a soft shadow (Day login).
  final bool tile;

  const SwiforaMark({super.key, this.size = 48, this.tile = false});

  @override
  Widget build(BuildContext context) {
    final logo = Image.asset(
      asset,
      width: size,
      height: size,
      fit: BoxFit.contain,
      filterQuality: FilterQuality.high,
      // Decode at the size it is drawn, not the 512 px source.
      cacheWidth: (size * MediaQuery.devicePixelRatioOf(context)).round().clamp(
        1,
        512,
      ),
    );

    if (!tile) return ExcludeSemantics(child: logo);

    final scheme = Theme.of(context).colorScheme;
    return ExcludeSemantics(
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(size * 0.3),
          boxShadow: [
            BoxShadow(
              color: scheme.shadow.withValues(
                alpha: _isDark(context) ? 0.4 : 0.14,
              ),
              blurRadius: 24,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: logo,
      ),
    );
  }
}

/// "سويفورا دليفري" with "SWIFORA DELIVERY" underneath.
class SwiforaWordmark extends StatelessWidget {
  /// Small header form (home screens) or the large login form.
  final bool compact;
  final bool showTagline;

  const SwiforaWordmark({
    super.key,
    this.compact = false,
    this.showTagline = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final name = AppLocalization.get(context, 'app_name');
    final latin = AppLocalization.get(context, 'app_name_latin');
    // In English the name is already Latin; do not repeat it underneath.
    final showLatin = latin.toLowerCase() != name.toLowerCase();

    if (compact) {
      return Semantics(
        header: true,
        label: name,
        excludeSemantics: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              name,
              maxLines: 1,
              softWrap: false,
              overflow: TextOverflow.fade,
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w800,
                height: 1.1,
              ),
            ),
            if (showLatin)
              Text(
                latin,
                textDirection: TextDirection.ltr,
                maxLines: 1,
                softWrap: false,
                overflow: TextOverflow.fade,
                style: theme.textTheme.labelSmall?.copyWith(
                  letterSpacing: 2.4,
                  fontWeight: FontWeight.w600,
                ),
              ),
          ],
        ),
      );
    }

    final rule = Container(
      width: 28,
      height: 2,
      color: scheme.secondary.withValues(alpha: 0.8),
    );

    return Semantics(
      header: true,
      label: name,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ExcludeSemantics(
            child: Text(
              name,
              textAlign: TextAlign.center,
              style: theme.textTheme.displaySmall?.copyWith(
                fontWeight: FontWeight.w900,
                fontSize: 34,
              ),
            ),
          ),
          if (showLatin) ...[
            const SizedBox(height: AppSpacing.xs),
            ExcludeSemantics(
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    rule,
                    const SizedBox(width: AppSpacing.sm),
                    Text(
                      latin,
                      textDirection: TextDirection.ltr,
                      style: theme.textTheme.labelLarge?.copyWith(
                        letterSpacing: 4,
                        color: scheme.onSurface,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    rule,
                  ],
                ),
              ),
            ),
          ],
          if (showTagline) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              AppLocalization.get(context, 'app_tagline'),
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyLarge?.copyWith(
                color: scheme.onSurfaceVariant,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Home header: brand at the start, round action buttons at the end.
class SwiforaHeader extends StatelessWidget {
  final List<Widget> actions;

  const SwiforaHeader({super.key, this.actions = const []});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const SwiforaMark(size: 44),
        const SizedBox(width: AppSpacing.sm),
        const Expanded(
          child: Align(
            alignment: AlignmentDirectional.centerStart,
            child: SwiforaWordmark(compact: true),
          ),
        ),
        for (final action in actions) ...[
          const SizedBox(width: AppSpacing.sm),
          action,
        ],
      ],
    );
  }
}

/// A rounded square header button (notifications, account).
class SwiforaRoundButton extends StatelessWidget {
  final Widget child;
  final String tooltip;
  final VoidCallback onPressed;
  final bool highlighted;
  final int badgeCount;
  final String? badgeLabel;

  /// Side of the square; 48 keeps three header buttons on small phones.
  final double size;

  const SwiforaRoundButton({
    super.key,
    required this.child,
    required this.tooltip,
    required this.onPressed,
    this.highlighted = false,
    this.badgeCount = 0,
    this.badgeLabel,
    this.size = 52,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final button = Tooltip(
      message: tooltip,
      child: Material(
        color: highlighted
            ? scheme.primaryContainer
            : scheme.surfaceContainerLow,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          side: BorderSide(
            color: highlighted
                ? scheme.primary.withValues(alpha: 0.5)
                : scheme.outlineVariant,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onPressed,
          child: SizedBox(
            width: size,
            height: size,
            child: Center(
              child: IconTheme(
                data: IconThemeData(
                  color: highlighted ? scheme.primary : scheme.onSurface,
                ),
                child: DefaultTextStyle.merge(
                  style: theme.textTheme.titleMedium?.copyWith(
                    color: highlighted ? scheme.primary : scheme.onSurface,
                    fontWeight: FontWeight.w800,
                  ),
                  child: child,
                ),
              ),
            ),
          ),
        ),
      ),
    );

    if (badgeCount <= 0) {
      return Semantics(button: true, label: tooltip, child: button);
    }

    return Semantics(
      button: true,
      label: badgeLabel ?? tooltip,
      excludeSemantics: true,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          button,
          PositionedDirectional(
            end: -6,
            top: -6,
            child: Container(
              constraints: const BoxConstraints(minWidth: 22, minHeight: 22),
              padding: const EdgeInsetsDirectional.symmetric(horizontal: 6),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: scheme.error,
                borderRadius: BorderRadius.circular(AppRadius.pill),
                border: Border.all(color: scheme.surface, width: 2),
              ),
              child: Text(
                badgeCount > 99 ? '99+' : '$badgeCount',
                style: theme.textTheme.labelSmall?.copyWith(
                  color: scheme.onError,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Large rounded card used by the approved screens.
class SwiforaCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color? color;
  final Color? borderColor;
  final Gradient? gradient;
  final VoidCallback? onTap;

  const SwiforaCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsetsDirectional.all(AppSpacing.lg),
    this.color,
    this.borderColor,
    this.gradient,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final radius = BorderRadius.circular(AppRadius.xxl);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: gradient == null ? (color ?? scheme.surfaceContainerLow) : null,
        gradient: gradient,
        borderRadius: radius,
        border: Border.all(color: borderColor ?? scheme.outlineVariant),
        boxShadow: _isDark(context)
            ? null
            : [
                BoxShadow(
                  color: scheme.shadow.withValues(alpha: 0.05),
                  blurRadius: 18,
                  offset: const Offset(0, 6),
                ),
              ],
      ),
      child: Material(
        type: MaterialType.transparency,
        borderRadius: radius,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(padding: padding, child: child),
        ),
      ),
    );
  }
}

/// Tinted rounded icon tile.
class SwiforaIconTile extends StatelessWidget {
  final IconData icon;
  final AppTone tone;
  final double size;

  const SwiforaIconTile({
    super.key,
    required this.icon,
    required this.tone,
    this.size = 56,
  });

  @override
  Widget build(BuildContext context) {
    final style = appToneStyle(context, tone);
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: style.background,
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Icon(icon, color: style.solid, size: size * 0.46),
    );
  }
}

/// Count shown in a soft chip (e.g. "2" offers).
class SwiforaCountChip extends StatelessWidget {
  final int count;
  final AppTone tone;

  const SwiforaCountChip({
    super.key,
    required this.count,
    this.tone = AppTone.warning,
  });

  @override
  Widget build(BuildContext context) {
    final style = appToneStyle(context, tone);
    return Container(
      constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
      padding: const EdgeInsetsDirectional.symmetric(horizontal: AppSpacing.sm),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: style.background,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Text(
        '$count',
        style: Theme.of(context).textTheme.titleMedium?.copyWith(
          color: style.solid,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

/// Icon + title + subtitle + optional count + chevron, as one tap target.
class SwiforaActionRow extends StatelessWidget {
  final IconData icon;
  final AppTone tone;
  final String title;
  final String? subtitle;
  final int? count;
  final VoidCallback onTap;
  final bool emphasized;
  final Key? tapKey;

  const SwiforaActionRow({
    super.key,
    required this.icon,
    required this.tone,
    required this.title,
    required this.onTap,
    this.subtitle,
    this.count,
    this.emphasized = false,
    this.tapKey,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final toneStyle = appToneStyle(context, tone);
    final label = [
      title,
      if (subtitle != null && subtitle!.isNotEmpty) subtitle!,
      if (count != null && count! > 0) '$count',
    ].join('. ');

    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      onTap: onTap,
      child: SwiforaCard(
        key: tapKey,
        onTap: onTap,
        borderColor: emphasized ? toneStyle.border : null,
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.lg,
        ),
        child: Row(
          children: [
            SwiforaIconTile(icon: icon, tone: tone),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  if (subtitle != null && subtitle!.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.xxs),
                    Text(subtitle!, style: theme.textTheme.bodySmall),
                  ],
                ],
              ),
            ),
            if (count != null && count! > 0) ...[
              const SizedBox(width: AppSpacing.sm),
              SwiforaCountChip(count: count!, tone: AppTone.warning),
            ],
            const SizedBox(width: AppSpacing.sm),
            Icon(Icons.chevron_right, color: scheme.onSurfaceVariant),
          ],
        ),
      ),
    );
  }
}

/// Section title with an optional trailing link ("عرض جميع الطلبات").
class SwiforaSectionTitle extends StatelessWidget {
  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  const SwiforaSectionTitle({
    super.key,
    required this.title,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsetsDirectional.only(
        top: AppSpacing.sm,
        bottom: AppSpacing.md,
      ),
      child: Row(
        children: [
          Expanded(
            child: Semantics(
              header: true,
              child: Text(
                title,
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
          if (actionLabel != null && onAction != null)
            TextButton.icon(
              onPressed: onAction,
              iconAlignment: IconAlignment.end,
              icon: Icon(Icons.chevron_right, size: AppSizes.iconSm),
              label: Text(actionLabel!),
            ),
        ],
      ),
    );
  }
}

/// A dashed delivery route with a start dot and a destination pin, used as
/// decoration (hero card and login backdrop). Painted once; no animation.
class SwiforaRoutePainter extends CustomPainter {
  final Color routeColor;
  final Color accentColor;
  final Color ringColor;

  const SwiforaRoutePainter({
    required this.routeColor,
    required this.accentColor,
    required this.ringColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final ring = Paint()
      ..color = ringColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;
    final center = Offset(size.width * 0.2, size.height * 0.5);
    canvas.drawCircle(center, size.shortestSide * 0.62, ring);
    canvas.drawCircle(
      center,
      size.shortestSide * 0.95,
      ring..color = ringColor.withValues(alpha: ringColor.a * 0.6),
    );

    final route = Path()
      ..moveTo(size.width * 0.18, size.height * 0.72)
      ..cubicTo(
        size.width * 0.12,
        size.height * 0.4,
        size.width * 0.42,
        size.height * 0.28,
        size.width * 0.62,
        size.height * 0.34,
      );
    final dash = Paint()
      ..color = routeColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;
    for (final metric in route.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        canvas.drawPath(metric.extractPath(distance, distance + 9), dash);
        distance += 17;
      }
    }

    canvas.drawCircle(
      Offset(size.width * 0.18, size.height * 0.76),
      9,
      Paint()
        ..color = routeColor
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3,
    );

    final pinCenter = Offset(size.width * 0.66, size.height * 0.26);
    final pin = Path()
      ..addOval(Rect.fromCircle(center: pinCenter, radius: 14))
      ..moveTo(pinCenter.dx - 11, pinCenter.dy + 8)
      ..lineTo(pinCenter.dx, pinCenter.dy + 26)
      ..lineTo(pinCenter.dx + 11, pinCenter.dy + 8)
      ..close();
    canvas.drawPath(pin, Paint()..color = accentColor);
    canvas.drawCircle(pinCenter, 5, Paint()..color = Colors.white);

    canvas.drawLine(
      Offset(size.width * 0.02, size.height * 0.98),
      Offset(size.width * 0.82, size.height * 0.62),
      Paint()
        ..color = accentColor.withValues(alpha: 0.7)
        ..strokeWidth = 2,
    );
  }

  @override
  bool shouldRepaint(SwiforaRoutePainter oldDelegate) =>
      oldDelegate.routeColor != routeColor ||
      oldDelegate.accentColor != accentColor ||
      oldDelegate.ringColor != ringColor;
}

/// Quiet skyline + route decoration for the login background.
class SwiforaSkylinePainter extends CustomPainter {
  final Color buildingColor;
  final Color windowColor;
  final Color routeColor;
  final Color pinColor;

  const SwiforaSkylinePainter({
    required this.buildingColor,
    required this.windowColor,
    required this.routeColor,
    required this.pinColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final base = size.height;
    final building = Paint()..color = buildingColor;
    final window = Paint()..color = windowColor;
    const blocks = <List<double>>[
      [0.00, 0.10, 0.42],
      [0.09, 0.07, 0.62],
      [0.16, 0.09, 0.50],
      [0.78, 0.07, 0.55],
      [0.85, 0.09, 0.70],
      [0.93, 0.07, 0.46],
    ];
    for (final b in blocks) {
      final rect = Rect.fromLTWH(
        size.width * b[0],
        base - base * b[2],
        size.width * b[1],
        base * b[2],
      );
      canvas.drawRect(rect, building);
      for (var y = rect.top + 8; y < rect.bottom - 6; y += 14) {
        for (var x = rect.left + 5; x < rect.right - 6; x += 10) {
          canvas.drawRect(Rect.fromLTWH(x, y, 3, 4), window);
        }
      }
    }

    // Kept in the outer column so it never crosses the wordmark.
    final route = Path()
      ..moveTo(size.width * 0.99, base * 0.98)
      ..cubicTo(
        size.width * 0.80,
        base * 0.86,
        size.width * 0.98,
        base * 0.66,
        size.width * 0.86,
        base * 0.42,
      );
    canvas.drawPath(
      route,
      Paint()
        ..color = routeColor
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.4
        ..strokeCap = StrokeCap.round,
    );

    final pinCenter = Offset(size.width * 0.86, base * 0.3);
    final pin = Path()
      ..addOval(Rect.fromCircle(center: pinCenter, radius: 9))
      ..moveTo(pinCenter.dx - 7, pinCenter.dy + 5)
      ..lineTo(pinCenter.dx, pinCenter.dy + 17)
      ..lineTo(pinCenter.dx + 7, pinCenter.dy + 5)
      ..close();
    canvas.drawPath(pin, Paint()..color = pinColor);
  }

  @override
  bool shouldRepaint(SwiforaSkylinePainter oldDelegate) =>
      oldDelegate.buildingColor != buildingColor ||
      oldDelegate.routeColor != routeColor;
}
