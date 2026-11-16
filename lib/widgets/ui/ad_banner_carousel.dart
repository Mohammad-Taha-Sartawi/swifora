import 'dart:async';

import 'package:flutter/material.dart';

import '../../models/ad_model.dart';
import '../../services/ad_repository.dart';
import '../../services/api_config.dart';
import '../../services/localization_service.dart';
import '../../services/theme_service.dart';
import '../brand/swifora_brand.dart';

/// Home-screen advertisement banner: dashboard-managed image ads in a fixed
/// height carousel.
///
/// * Only active, started and unexpired ads are shown ([adSlidesAt]); the
///   banner refreshes by itself at the moment an ad starts or expires.
/// * Several pages slide automatically every [autoAdvanceInterval]; the
///   carousel loops forward without rewinding.
/// * A manual swipe moves at once and pauses the automatic sliding until
///   the user has left it alone for [manualPause].
/// * One page: no sliding and no indicator. No pages (or the first load
///   failed): the whole section collapses.
class AdBannerCarousel extends StatefulWidget {
  const AdBannerCarousel({
    super.key,
    this.token = '',
    this.refreshTick = 0,
    this.repository,
    this.events = const NoAdEvents(),
    this.clock = DateTime.now,
  });

  /// Session token for the dashboard ads endpoint (used when no
  /// [repository] is given).
  final String token;

  /// Changing it reloads the ads (pull-to-refresh on the home screen).
  final int refreshTick;

  /// Where the ads come from; defaults to the dashboard API.
  final AdRepository? repository;

  /// Impression/tap hooks (analytics, deep links).
  final AdEvents events;
  final DateTime Function() clock;

  static const autoAdvanceInterval = Duration(seconds: 5);
  static const manualPause = Duration(seconds: 10);
  static const slideDuration = Duration(milliseconds: 520);

  /// A page counts as one more view each time it is shown, but at most once
  /// per this interval, so a banner left rotating does not flood tracking.
  static const impressionInterval = Duration(minutes: 10);

  /// Fixed banner height: 168 on regular phones, 160 on narrow ones and 180
  /// on tablets. Recommended dashboard upload: 1200 x 560 px (about 2.15:1),
  /// with the important content kept in the centre.
  static double heightFor(double width) {
    if (width < 340) return 160;
    if (width >= 600) return 180;
    return 168;
  }

  @override
  State<AdBannerCarousel> createState() => AdBannerCarouselState();
}

class AdBannerCarouselState extends State<AdBannerCarousel> {
  // The page view is endless in both directions: page p shows slide
  // p % count, starting far from page 0 so the user can swipe back too.
  static const _loopStart = 1000;

  late AdRepository _repository;
  List<AdModel> _ads = const [];
  List<AdSlide> _slides = const [];
  PageController? _controller;
  int _index = 0;
  Timer? _autoTimer;
  Timer? _changeTimer;
  bool _userDragging = false;
  bool _pausedByUser = false;
  // When each page was last reported as seen (see [impressionInterval]).
  final Map<String, DateTime> _reportedAt = {};

  /// Index of the slide on screen (for tests and accessibility).
  int get currentIndex => _index;
  int get slideCount => _slides.length;

  @override
  void initState() {
    super.initState();
    _repository = widget.repository ?? ApiAdRepository(widget.token);
    _load();
  }

  @override
  void didUpdateWidget(covariant AdBannerCarousel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.repository != widget.repository ||
        oldWidget.token != widget.token) {
      _repository = widget.repository ?? ApiAdRepository(widget.token);
      _load();
    } else if (oldWidget.refreshTick != widget.refreshTick) {
      _load();
    }
  }

  @override
  void dispose() {
    _autoTimer?.cancel();
    _changeTimer?.cancel();
    _controller?.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final ads = await _repository.fetchAds();
      if (!mounted) return;
      _apply(ads);
    } catch (_) {
      // Keep what is on screen; with nothing loaded yet the section simply
      // stays hidden. The next pull-to-refresh tries again.
    }
  }

  /// Recomputes the visible pages (after a load, or when an ad starts or
  /// expires) and schedules the next such moment.
  void _apply(List<AdModel> ads) {
    final now = widget.clock();
    final slides = adSlidesAt(ads, now);
    final sameSlides =
        slides.length == _slides.length &&
        List.generate(
          slides.length,
          (i) => slides[i].key == _slides[i].key,
        ).every((same) => same);

    _ads = ads;
    _changeTimer?.cancel();
    final nextChange = nextAdChangeAfter(ads, now);
    if (nextChange != null) {
      _changeTimer = Timer(
        nextChange.difference(now) + const Duration(milliseconds: 50),
        () {
          if (mounted) _apply(_ads);
        },
      );
    }

    if (sameSlides) {
      // Same pages, possibly new details (title, link, countdown setting):
      // show them without moving the carousel.
      setState(() => _slides = slides);
      return;
    }

    final keepKey = _slides.isEmpty ? null : _slides[_index].key;
    var index = keepKey == null
        ? 0
        : slides.indexWhere((slide) => slide.key == keepKey);
    if (index < 0) index = 0;

    _controller?.dispose();
    _controller = slides.length > 1
        ? PageController(initialPage: _loopStart * slides.length + index)
        : null;

    setState(() {
      _slides = slides;
      _index = index;
      _userDragging = false;
      _pausedByUser = false;
    });
    _reportImpression();
    _scheduleAuto(AdBannerCarousel.autoAdvanceInterval);
  }

  void _scheduleAuto(Duration delay) {
    _autoTimer?.cancel();
    if (_slides.length < 2) return;
    _autoTimer = Timer(delay, _advance);
  }

  Future<void> _advance() async {
    final controller = _controller;
    if (!mounted || _userDragging || _slides.length < 2 || controller == null) {
      return;
    }
    if (!controller.hasClients) {
      _scheduleAuto(AdBannerCarousel.autoAdvanceInterval);
      return;
    }

    final next =
        (controller.page ?? controller.initialPage.toDouble()).round() + 1;
    if (MediaQuery.maybeDisableAnimationsOf(context) ?? false) {
      controller.jumpToPage(next);
    } else {
      await controller.animateToPage(
        next,
        duration: AdBannerCarousel.slideDuration,
        curve: Curves.easeInOutCubic,
      );
    }
    if (!mounted || _userDragging || _pausedByUser) return;
    _scheduleAuto(AdBannerCarousel.autoAdvanceInterval);
  }

  bool _onScroll(ScrollNotification notification) {
    if (notification.depth != 0) return false;

    if (notification is ScrollStartNotification &&
        notification.dragDetails != null) {
      // The user took over: stop sliding while they swipe.
      _userDragging = true;
      _pausedByUser = true;
      _autoTimer?.cancel();
    } else if (notification is ScrollEndNotification && _userDragging) {
      // Resume once they have left the banner alone for 10 seconds.
      _userDragging = false;
      _autoTimer?.cancel();
      if (_slides.length > 1) {
        _autoTimer = Timer(AdBannerCarousel.manualPause, () {
          _pausedByUser = false;
          _advance();
        });
      }
    }
    return false;
  }

  void _onPageChanged(int page) {
    if (_slides.isEmpty) return;
    setState(() => _index = page % _slides.length);
    _reportImpression();
  }

  void _reportImpression() {
    if (_slides.isEmpty) return;
    final slide = _slides[_index.clamp(0, _slides.length - 1)];
    final now = widget.clock();
    final last = _reportedAt[slide.key];
    if (last != null &&
        now.difference(last) < AdBannerCarousel.impressionInterval) {
      return;
    }
    _reportedAt[slide.key] = now;
    widget.events.onImpression(slide.ad);
  }

  VoidCallback? _tapHandler(AdModel ad) {
    // Tappable only when the link leads somewhere on this home screen.
    if (!widget.events.canOpen(ad)) return null;
    return () => widget.events.onTap(ad);
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedSize(
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeOutCubic,
      alignment: Alignment.topCenter,
      child: _slides.isEmpty
          ? const SizedBox(width: double.infinity)
          : Padding(
              // The home screen adds its own section spacing below.
              padding: const EdgeInsetsDirectional.only(top: AppSpacing.md),
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final height = AdBannerCarousel.heightFor(
                    constraints.maxWidth,
                  );
                  return Column(
                    key: const Key('adBanner'),
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(
                        height: height,
                        width: constraints.maxWidth,
                        child: _slides.length == 1
                            ? _AdBannerSlide(
                                slide: _slides.first,
                                height: height,
                                clock: widget.clock,
                                onTap: _tapHandler(_slides.first.ad),
                              )
                            : _buildPager(constraints.maxWidth, height),
                      ),
                      if (_slides.length > 1) ...[
                        const SizedBox(height: AppSpacing.sm),
                        _AdPageDots(count: _slides.length, index: _index),
                      ],
                    ],
                  );
                },
              ),
            ),
    );
  }

  Widget _buildPager(double width, double height) {
    // Pages are separated by a small gap while swiping, yet each banner is
    // as wide as the cards around it.
    const gap = AppSpacing.sm;
    return OverflowBox(
      maxWidth: width + gap * 2,
      minWidth: width + gap * 2,
      child: NotificationListener<ScrollNotification>(
        onNotification: _onScroll,
        child: PageView.builder(
          key: ValueKey(_controller),
          controller: _controller,
          onPageChanged: _onPageChanged,
          itemBuilder: (context, page) {
            final slide = _slides[page % _slides.length];
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: gap),
              child: _AdBannerSlide(
                slide: slide,
                height: height,
                clock: widget.clock,
                onTap: _tapHandler(slide.ad),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _AdBannerSlide extends StatelessWidget {
  const _AdBannerSlide({
    required this.slide,
    required this.height,
    required this.onTap,
    required this.clock,
  });

  final AdSlide slide;
  final double height;
  final VoidCallback? onTap;
  final DateTime Function() clock;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final dark = theme.brightness == Brightness.dark;
    final ad = slide.ad;
    final radius = BorderRadius.circular(AppRadius.xxl);
    final hasImage = slide.imageUrl.isNotEmpty;
    final title = ad.title.trim();
    final subtitle = ad.body.trim();
    final label = [
      AppLocalization.get(context, 'ad_label'),
      if (title.isNotEmpty) title,
      if (subtitle.isNotEmpty) subtitle,
    ].join('. ');

    return Semantics(
      container: true,
      image: hasImage,
      button: onTap != null,
      onTap: onTap,
      label: label,
      child: ExcludeSemantics(
        child: DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: radius,
            border: Border.all(
              color: scheme.outlineVariant.withValues(alpha: dark ? 0.7 : 0.9),
            ),
          ),
          child: ClipRRect(
            borderRadius: radius,
            child: Material(
              color: scheme.surfaceContainerHigh,
              child: InkWell(
                onTap: onTap,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (hasImage)
                      _AdImage(
                        url: ApiConfig.resolveMediaUrl(slide.imageUrl),
                        height: height,
                        fallback: _AdFallback(ad: ad, showText: true),
                      )
                    else
                      _AdFallback(ad: ad, showText: true),
                    if (hasImage && (title.isNotEmpty || subtitle.isNotEmpty))
                      _AdCaption(title: title, subtitle: subtitle),
                    PositionedDirectional(
                      top: AppSpacing.md,
                      start: AppSpacing.md,
                      child: _AdChip(onImage: hasImage),
                    ),
                    if (ad.showCountdown && ad.endsAt != null)
                      PositionedDirectional(
                        top: AppSpacing.md,
                        end: AppSpacing.md,
                        child: _AdCountdown(
                          endsAt: ad.endsAt!,
                          clock: clock,
                          onImage: hasImage,
                        ),
                      ),
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

class _AdImage extends StatelessWidget {
  const _AdImage({
    required this.url,
    required this.height,
    required this.fallback,
  });

  final String url;
  final double height;
  final Widget fallback;

  @override
  Widget build(BuildContext context) {
    final dpr = MediaQuery.maybeDevicePixelRatioOf(context) ?? 2;
    return Image.network(
      url,
      key: ValueKey(url),
      fit: BoxFit.cover,
      gaplessPlayback: true,
      // Decode at display size, not at upload size.
      cacheHeight: (height * dpr).round(),
      frameBuilder: (context, child, frame, wasSynchronouslyLoaded) {
        if (wasSynchronouslyLoaded) return child;
        return AnimatedOpacity(
          opacity: frame == null ? 0 : 1,
          duration: const Duration(milliseconds: 260),
          curve: Curves.easeOut,
          child: child,
        );
      },
      errorBuilder: (context, error, stackTrace) =>
          KeyedSubtree(key: const Key('adImageFallback'), child: fallback),
    );
  }
}

/// Branded panel used while an image is missing or failed to load.
class _AdFallback extends StatelessWidget {
  const _AdFallback({required this.ad, required this.showText});

  final AdModel ad;
  final bool showText;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final title = ad.title.trim();
    final subtitle = ad.body.trim();
    final hasText = showText && (title.isNotEmpty || subtitle.isNotEmpty);

    return DecoratedBox(
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHigh,
        gradient: LinearGradient(
          begin: AlignmentDirectional.topStart,
          end: AlignmentDirectional.bottomEnd,
          colors: [
            scheme.surfaceContainerHigh,
            Color.alphaBlend(
              scheme.primary.withValues(alpha: 0.10),
              scheme.surfaceContainerHigh,
            ),
          ],
        ),
      ),
      child: Stack(
        children: [
          PositionedDirectional(
            end: -18,
            bottom: -18,
            child: Opacity(opacity: 0.14, child: const SwiforaMark(size: 132)),
          ),
          Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(
              AppSpacing.lg,
              AppSpacing.xxxl,
              AppSpacing.xxxl,
              AppSpacing.lg,
            ),
            child: hasText
                ? Column(
                    mainAxisAlignment: MainAxisAlignment.end,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (title.isNotEmpty)
                        Text(
                          title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.titleMedium?.copyWith(
                            color: scheme.onSurface,
                            fontWeight: FontWeight.w700,
                            height: 1.25,
                          ),
                        ),
                      if (subtitle.isNotEmpty) ...[
                        const SizedBox(height: AppSpacing.xxs),
                        Text(
                          subtitle,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: scheme.onSurfaceVariant,
                            height: 1.35,
                          ),
                        ),
                      ],
                    ],
                  )
                : Align(
                    alignment: AlignmentDirectional.bottomStart,
                    child: Icon(
                      Icons.image_outlined,
                      size: AppSizes.iconLg,
                      color: scheme.onSurfaceVariant.withValues(alpha: 0.6),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

/// Title and subtitle over the image, on a soft scrim for legibility.
class _AdCaption extends StatelessWidget {
  const _AdCaption({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Align(
      alignment: Alignment.bottomCenter,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.bottomCenter,
            end: Alignment.topCenter,
            colors: [
              Colors.black.withValues(alpha: 0.66),
              Colors.black.withValues(alpha: 0.0),
            ],
          ),
        ),
        child: Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(
            AppSpacing.lg,
            AppSpacing.xxl,
            AppSpacing.lg,
            AppSpacing.md,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (title.isNotEmpty)
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleSmall?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              if (subtitle.isNotEmpty)
                Text(
                  subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: Colors.white.withValues(alpha: 0.88),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// "Ends in 2 days 05:12:09", ticking every second while on screen. Shown
/// only for ads whose dashboard setting asks for it.
class _AdCountdown extends StatefulWidget {
  const _AdCountdown({
    required this.endsAt,
    required this.clock,
    required this.onImage,
  });

  final DateTime endsAt;
  final DateTime Function() clock;
  final bool onImage;

  @override
  State<_AdCountdown> createState() => _AdCountdownState();
}

class _AdCountdownState extends State<_AdCountdown> {
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  static String _two(int value) => value.toString().padLeft(2, '0');

  String _days(BuildContext context, int days) {
    final arabic = Localizations.localeOf(context).languageCode == 'ar';
    if (!arabic) return '${days}d';
    if (days == 1) return 'يوم';
    if (days == 2) return 'يومان';
    if (days <= 10) return '$days أيام';
    return '$days يوماً';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final remaining = widget.endsAt.difference(widget.clock());
    final foreground = widget.onImage ? Colors.white : scheme.onSurfaceVariant;
    final style = theme.textTheme.labelSmall?.copyWith(
      color: foreground,
      fontWeight: FontWeight.w700,
      fontFeatures: const [FontFeature.tabularFigures()],
    );

    final ended = remaining <= Duration.zero;
    final time =
        '${_two(remaining.inHours.remainder(24))}:'
        '${_two(remaining.inMinutes.remainder(60))}:'
        '${_two(remaining.inSeconds.remainder(60))}';

    return DecoratedBox(
      key: const Key('adCountdown'),
      decoration: BoxDecoration(
        color: widget.onImage
            ? Colors.black.withValues(alpha: 0.42)
            : scheme.surface.withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Padding(
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.xxs,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.timer_outlined, size: 13, color: foreground),
            const SizedBox(width: AppSpacing.xs),
            if (ended)
              Text(AppLocalization.get(context, 'ad_ended'), style: style)
            else ...[
              Text(
                remaining.inDays > 0
                    ? '${AppLocalization.get(context, 'ad_ends_in')} '
                          '${_days(context, remaining.inDays)}'
                    : AppLocalization.get(context, 'ad_ends_in'),
                style: style,
              ),
              const SizedBox(width: AppSpacing.xs),
              // Digits read left to right in Arabic too.
              Text(time, textDirection: TextDirection.ltr, style: style),
            ],
          ],
        ),
      ),
    );
  }
}

/// "Ad" disclosure label.
class _AdChip extends StatelessWidget {
  const _AdChip({required this.onImage});

  final bool onImage;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: onImage
            ? Colors.black.withValues(alpha: 0.42)
            : scheme.surface.withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Padding(
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.xxs,
        ),
        child: Text(
          AppLocalization.get(context, 'ad_label'),
          style: theme.textTheme.labelSmall?.copyWith(
            color: onImage ? Colors.white : scheme.onSurfaceVariant,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

class _AdPageDots extends StatelessWidget {
  const _AdPageDots({required this.count, required this.index});

  final int count;
  final int index;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Semantics(
      label: AppLocalization.get(
        context,
        'ad_position',
      ).replaceFirst('%1', '${index + 1}').replaceFirst('%2', '$count'),
      child: ExcludeSemantics(
        child: Row(
          key: const Key('adBannerDots'),
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(count, (i) {
            final selected = i == index;
            return AnimatedContainer(
              duration: const Duration(milliseconds: 240),
              curve: Curves.easeOutCubic,
              margin: const EdgeInsets.symmetric(horizontal: 3),
              width: selected ? 20 : 6,
              height: 6,
              decoration: BoxDecoration(
                color: selected ? scheme.primary : scheme.outlineVariant,
                borderRadius: BorderRadius.circular(AppRadius.pill),
              ),
            );
          }),
        ),
      ),
    );
  }
}
