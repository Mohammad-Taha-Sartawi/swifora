import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:swifora/models/ad_model.dart';
import 'package:swifora/services/ad_repository.dart';
import 'package:swifora/services/ad_service.dart';
import 'package:swifora/services/api_config.dart';
import 'package:swifora/services/theme_service.dart';
import 'package:swifora/widgets/ui/ad_banner_carousel.dart';

final _base = DateTime.utc(2026, 11, 15, 12);

AdModel _ad(
  String id, {
  List<String>? images,
  String title = '',
  String body = '',
  DateTime? startsAt,
  DateTime? endsAt,
  bool isActive = true,
  int sortOrder = 0,
  String deepLink = '',
  bool showCountdown = false,
}) {
  return AdModel(
    id: id,
    title: title,
    body: body,
    images: images ?? ['/uploads/ads/$id.png'],
    startsAt: startsAt,
    endsAt: endsAt ?? _base.add(const Duration(days: 3)),
    isActive: isActive,
    sortOrder: sortOrder,
    deepLink: deepLink,
    showCountdown: showCountdown,
  );
}

class _RecordingEvents extends AdEvents {
  final impressions = <String>[];
  final taps = <String>[];

  @override
  void onImpression(AdModel ad) => impressions.add(ad.id);

  @override
  void onTap(AdModel ad) => taps.add(ad.id);
}

void main() {
  setUpAll(() => ApiConfig.initForTesting('http://127.0.0.1:1'));

  group('ad rules', () {
    test('parses the dashboard payload', () {
      final ad = AdModel.fromJson({
        '_id': 'ad-1',
        'title': '',
        'body': 'خصم على التوصيل',
        'images': ['/uploads/ads/a.png', '/uploads/ads/b.png'],
        'startsAt': '2026-11-10T10:00:00.000Z',
        'endsAt': '2026-11-20T10:00:00.000Z',
      });
      expect(ad.id, 'ad-1');
      expect(ad.body, 'خصم على التوصيل');
      expect(ad.images.length, 2);
      expect(ad.imageUrl, '/uploads/ads/a.png');
      expect(ad.isActive, isTrue, reason: 'the public list is active only');
      expect(ad.isVisibleAt(DateTime.utc(2026, 11, 15)), isTrue);
      expect(ad.isVisibleAt(DateTime.utc(2026, 11, 21)), isFalse);

      final generic = AdModel.fromJson({
        'id': 'ad-2',
        'imageUrl': 'https://cdn.example/ad.png',
        'subtitle': 'Sub',
        'expiresAt': '2026-11-20T10:00:00.000Z',
        'isActive': false,
        'sortOrder': '3',
        'deepLink': 'swifora://create-order',
      });
      expect(generic.images.single, 'https://cdn.example/ad.png');
      expect(generic.body, 'Sub');
      expect(generic.endsAt, isNotNull);
      expect(generic.isActive, isFalse);
      expect(generic.sortOrder, 3);
      expect(generic.deepLink, 'swifora://create-order');
    });

    test('shows only active, started, unexpired ads, by sort order', () {
      final slides = adSlidesAt([
        _ad('late', sortOrder: 2),
        _ad('inactive', isActive: false),
        _ad('expired', endsAt: _base.subtract(const Duration(minutes: 1))),
        _ad('future', startsAt: _base.add(const Duration(hours: 1))),
        _ad('first', sortOrder: 1),
        _ad('alsoFirst', sortOrder: 1),
        _ad('noEnd', sortOrder: 3).copyWithNoEnd(),
      ], _base);
      expect(slides.map((s) => s.ad.id), [
        'first',
        'alsoFirst',
        'late',
        'noEnd',
      ]);
    });

    test('an ad with several images gives one page per image', () {
      final slides = adSlidesAt([
        _ad('multi', images: ['/a.png', '/b.png']),
        _ad('text', images: const [], title: 'Only text'),
        _ad('empty', images: const []),
      ], _base);
      expect(slides.map((s) => s.key), [
        'multi|/a.png',
        'multi|/b.png',
        'text|',
      ]);
    });

    test('knows when the visible set changes next', () {
      final next = nextAdChangeAfter([
        _ad('a', endsAt: _base.add(const Duration(hours: 5))),
        _ad('b', startsAt: _base.add(const Duration(hours: 2))),
        _ad('c', isActive: false, endsAt: _base.add(const Duration(hours: 1))),
      ], _base);
      expect(next, _base.add(const Duration(hours: 2)));
    });
  });

  group('banner carousel', () {
    late DateTime now;

    setUp(() => now = _base);

    Future<AdBannerCarouselState> pumpBanner(
      WidgetTester tester,
      List<AdModel> ads, {
      ThemeData? theme,
      AdEvents events = const NoAdEvents(),
      Object? error,
    }) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: theme ?? AppTheme.light,
          locale: const Locale('ar'),
          supportedLocales: const [Locale('ar'), Locale('en')],
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          home: Scaffold(
            body: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  AdBannerCarousel(
                    repository: MockAdRepository(ads, error: error),
                    events: events,
                    clock: () => now,
                  ),
                  const Text('below'),
                ],
              ),
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      return tester.state<AdBannerCarouselState>(find.byType(AdBannerCarousel));
    }

    Future<void> wait(WidgetTester tester, Duration duration) async {
      now = now.add(duration);
      await tester.pump(duration);
      await tester.pump(const Duration(milliseconds: 600));
    }

    testWidgets('no ads: the section is hidden and the layout holds', (
      tester,
    ) async {
      await pumpBanner(tester, const []);
      expect(find.byKey(const Key('adBanner')), findsNothing);
      expect(find.text('below'), findsOneWidget);
    });

    testWidgets('load failure: hidden, no error shown', (tester) async {
      await pumpBanner(tester, [_ad('a')], error: StateError('offline'));
      expect(find.byKey(const Key('adBanner')), findsNothing);
    });

    testWidgets('the countdown shows only when the ad enables it', (
      tester,
    ) async {
      await pumpBanner(tester, [_ad('a')]);
      expect(find.byKey(const Key('adCountdown')), findsNothing);

      await pumpBanner(tester, [
        _ad(
          'b',
          showCountdown: true,
          endsAt: _base.add(const Duration(days: 2, hours: 5, seconds: 9)),
        ),
      ]);
      expect(find.byKey(const Key('adCountdown')), findsOneWidget);
      expect(find.text('ينتهي بعد يومان'), findsOneWidget);
      expect(find.text('05:00:09'), findsOneWidget);

      // It ticks down every second.
      await wait(tester, const Duration(seconds: 1));
      expect(find.text('05:00:08'), findsOneWidget);
    });

    testWidgets('a dashboard change to an ad shows up without a restart', (
      tester,
    ) async {
      final repository = _MutableAds([_ad('a')]);
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          locale: const Locale('ar'),
          supportedLocales: const [Locale('ar'), Locale('en')],
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          home: Scaffold(
            body: _Reloader(repository: repository, clock: () => now),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.byKey(const Key('adCountdown')), findsNothing);

      // The admin turns the countdown on: the app reloads the same ad.
      repository.ads = [_ad('a', showCountdown: true)];
      tester.state<_ReloaderState>(find.byType(_Reloader)).reload();
      await tester.pump(const Duration(milliseconds: 300));
      await tester.pump();
      expect(find.byKey(const Key('adCountdown')), findsOneWidget);
    });

    testWidgets('one ad: no indicator and no sliding', (tester) async {
      final state = await pumpBanner(tester, [_ad('a')]);
      expect(find.byKey(const Key('adBanner')), findsOneWidget);
      expect(find.byKey(const Key('adBannerDots')), findsNothing);
      expect(find.byType(PageView), findsNothing);
      await wait(tester, const Duration(seconds: 12));
      expect(state.currentIndex, 0);
    });

    testWidgets('fixed height of 168 on a regular phone', (tester) async {
      tester.view.physicalSize = const Size(1170, 2532);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      await pumpBanner(tester, [_ad('a'), _ad('b')]);
      final size = tester.getSize(
        find
            .descendant(
              of: find.byKey(const Key('adBanner')),
              matching: find.byType(SizedBox),
            )
            .first,
      );
      expect(size.height, 168);
      expect(AdBannerCarousel.heightFor(320), 160);
      expect(AdBannerCarousel.heightFor(700), 180);
    });

    testWidgets('several ads slide every 5 seconds and loop', (tester) async {
      final state = await pumpBanner(tester, [_ad('a'), _ad('b'), _ad('c')]);
      expect(find.byKey(const Key('adBannerDots')), findsOneWidget);
      expect(state.slideCount, 3);
      expect(state.currentIndex, 0);

      await wait(tester, const Duration(seconds: 4));
      expect(state.currentIndex, 0, reason: 'not before 5 seconds');
      await wait(tester, const Duration(seconds: 1));
      expect(state.currentIndex, 1);
      await wait(tester, const Duration(seconds: 5));
      expect(state.currentIndex, 2);
      await wait(tester, const Duration(seconds: 5));
      expect(state.currentIndex, 0, reason: 'wraps around forward');
    });

    testWidgets('a manual swipe moves at once, then pauses for 10 seconds', (
      tester,
    ) async {
      final state = await pumpBanner(tester, [_ad('a'), _ad('b'), _ad('c')]);
      await wait(tester, const Duration(seconds: 3));

      // Swipe to another ad (the page view follows the Arabic RTL layout).
      await tester.fling(find.byType(PageView), const Offset(400, 0), 1500);
      await tester.pumpAndSettle();
      expect(state.currentIndex, isNot(0), reason: 'moved immediately');
      final afterSwipe = state.currentIndex;

      // Auto-sliding would have moved at 5 s; it is paused.
      await wait(tester, const Duration(seconds: 6));
      expect(state.currentIndex, afterSwipe);
      await wait(tester, const Duration(seconds: 3));
      expect(state.currentIndex, afterSwipe, reason: 'still within 10 s');

      // 10 seconds after the swipe it resumes, then every 5 seconds.
      await wait(tester, const Duration(seconds: 1));
      expect(state.currentIndex, (afterSwipe + 1) % 3);
      await wait(tester, const Duration(seconds: 5));
      expect(state.currentIndex, (afterSwipe + 2) % 3);
    });

    testWidgets('an ad disappears the moment it expires', (tester) async {
      final state = await pumpBanner(tester, [
        _ad('a'),
        _ad('b', endsAt: _base.add(const Duration(seconds: 3))),
      ]);
      expect(state.slideCount, 2);
      await wait(tester, const Duration(seconds: 3));
      expect(state.slideCount, 1);
      expect(find.byKey(const Key('adBannerDots')), findsNothing);
    });

    testWidgets('each showing counts, at most once per page per 10 minutes', (
      tester,
    ) async {
      final events = _RecordingEvents();
      await pumpBanner(tester, [_ad('a'), _ad('b')], events: events);
      await wait(tester, const Duration(seconds: 5));
      await wait(tester, const Duration(seconds: 5));
      expect(events.impressions, ['a', 'b'], reason: 'a again within 10 min');

      // Left rotating for 10 minutes: each page counts once more.
      for (var i = 0; i < 120; i++) {
        await wait(tester, const Duration(seconds: 5));
      }
      expect(events.impressions.where((id) => id == 'a').length, 2);
      expect(events.impressions.where((id) => id == 'b').length, 2);
    });

    testWidgets('only ads with a deep link react to taps', (tester) async {
      final events = _RecordingEvents();
      await pumpBanner(tester, [
        _ad('a', deepLink: 'swifora://offers'),
      ], events: events);
      await tester.tap(find.byKey(const Key('adBanner')));
      expect(events.taps, ['a']);
    });

    for (final (name, theme) in [
      ('day', AppTheme.light),
      ('dark', AppTheme.dark),
    ]) {
      testWidgets('a broken image shows the branded fallback ($name mode)', (
        tester,
      ) async {
        await tester.runAsync(() async {
          await pumpBanner(tester, [
            _ad('a', title: 'عرض خاص', body: 'توصيل مجاني اليوم'),
          ], theme: theme);
          // The test network refuses every request: the image fails.
          for (var i = 0; i < 20; i++) {
            await Future<void>.delayed(const Duration(milliseconds: 50));
            await tester.pump();
            if (find
                .byKey(const Key('adImageFallback'))
                .evaluate()
                .isNotEmpty) {
              break;
            }
          }
        });
        expect(find.byKey(const Key('adImageFallback')), findsOneWidget);
        expect(find.text('عرض خاص'), findsWidgets);
        expect(find.text('إعلان'), findsOneWidget);
        expect(tester.takeException(), isNull);
      });
    }
  });

  group('ad links and tracking', () {
    test('links name an app screen or an https page', () {
      expect(AdLinkTarget.parse('app:support')!.screen, 'support');
      expect(
        AdLinkTarget.parse('https://swifora.com/offer')!.url.toString(),
        'https://swifora.com/offer',
      );
      for (final bad in ['', 'app:', 'http://swifora.com', 'javascript:x']) {
        expect(AdLinkTarget.parse(bad), isNull, reason: bad);
      }
    });

    test('a banner is tappable only when this home can open its link', () {
      final events = ApiAdEvents(
        token: 't',
        service: _FakeAdService(),
        screens: {'support': () {}},
      );
      expect(events.canOpen(_ad('a', deepLink: 'app:support')), isTrue);
      expect(events.canOpen(_ad('b', deepLink: 'https://x.test/a')), isTrue);
      expect(
        events.canOpen(_ad('c', deepLink: 'app:create_order')),
        isFalse,
        reason: 'e.g. a customer-only screen on the driver home',
      );
      expect(events.canOpen(_ad('d')), isFalse);
      expect(const NoAdEvents().canOpen(_ad('e', deepLink: 'app:x')), isFalse);
    });

    testWidgets('views are batched; a tap is sent at once and opens', (
      tester,
    ) async {
      final service = _FakeAdService();
      final opened = <String>[];
      final events = ApiAdEvents(
        token: 'token-1',
        service: service,
        screens: {'support': () => opened.add('support')},
        openUrl: (url) async {
          opened.add(url.toString());
          return true;
        },
      );

      events.onImpression(_ad('a'));
      events.onImpression(_ad('b'));
      expect(service.batches, isEmpty, reason: 'waits to batch views');
      await tester.pump(const Duration(seconds: 3));
      expect(service.batches.single, [
        {'adId': 'a', 'type': 'impression'},
        {'adId': 'b', 'type': 'impression'},
      ]);
      expect(service.tokens.single, 'token-1');

      events.onTap(_ad('c', deepLink: 'app:support'));
      expect(service.batches.last, [
        {'adId': 'c', 'type': 'tap'},
      ]);
      events.onTap(_ad('d', deepLink: 'https://swifora.com/offer'));
      await tester.pump();
      expect(opened, ['support', 'https://swifora.com/offer']);

      // Leaving the home screen sends what is still waiting.
      events.onImpression(_ad('e'));
      events.dispose();
      expect(service.batches.last, [
        {'adId': 'e', 'type': 'impression'},
      ]);
      events.onImpression(_ad('f'));
      await tester.pump(const Duration(seconds: 5));
      expect(service.batches.last.single['adId'], 'e');
    });

    testWidgets('a failed report never surfaces as an error', (tester) async {
      final events = ApiAdEvents(
        token: 't',
        service: _FakeAdService(fail: true),
        screens: const {},
      );
      events.onImpression(_ad('a'));
      await tester.pump(const Duration(seconds: 3));
      await tester.pump();
      expect(tester.takeException(), isNull);
    });

    test('the dashboard link field is read from the ads payload', () {
      final ad = AdModel.fromJson({
        '_id': 'x',
        'images': ['/a.png'],
        'endsAt': '2026-11-20T10:00:00.000Z',
        'link': 'app:my_orders',
      });
      expect(ad.deepLink, 'app:my_orders');
      expect(ad.showCountdown, isFalse, reason: 'hidden unless chosen');
      expect(
        AdModel.fromJson({'_id': 'y', 'showCountdown': true}).showCountdown,
        isTrue,
      );
    });
  });

  test('customer and driver homes use the shared banner', () {
    final customer = File('lib/screens/home_screen.dart').readAsStringSync();
    final provider = File(
      'lib/screens/provider_home_screen.dart',
    ).readAsStringSync();
    expect(customer, contains('refreshTick: _adRefreshTick'));
    expect(provider, contains('refreshTick: _adRefreshTick'));
  });
}

extension on AdModel {
  AdModel copyWithNoEnd() => AdModel(
    id: id,
    title: title,
    body: body,
    images: images,
    startsAt: startsAt,
    isActive: isActive,
    sortOrder: sortOrder,
    deepLink: deepLink,
  );
}

class _FakeAdService extends AdService {
  _FakeAdService({this.fail = false});

  final bool fail;
  final batches = <List<Map<String, String>>>[];
  final tokens = <String>[];

  @override
  Future<void> sendEvents(
    String token,
    List<Map<String, String>> events,
  ) async {
    tokens.add(token);
    batches.add(List.of(events));
    if (fail) throw StateError('offline');
  }
}

class _MutableAds implements AdRepository {
  _MutableAds(this.ads);

  List<AdModel> ads;

  @override
  Future<List<AdModel>> fetchAds() async => ads;
}

/// Bumps the banner's refreshTick like the home screen does on ads_changed.
class _Reloader extends StatefulWidget {
  const _Reloader({required this.repository, required this.clock});

  final AdRepository repository;
  final DateTime Function() clock;

  @override
  State<_Reloader> createState() => _ReloaderState();
}

class _ReloaderState extends State<_Reloader> {
  int tick = 0;

  void reload() => setState(() => tick += 1);

  @override
  Widget build(BuildContext context) => AdBannerCarousel(
    repository: widget.repository,
    refreshTick: tick,
    clock: widget.clock,
  );
}
