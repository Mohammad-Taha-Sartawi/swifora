import 'dart:async';

import 'package:url_launcher/url_launcher.dart';

import '../models/ad_model.dart';
import 'ad_service.dart';

/// Source of the home-screen ads. The app uses [ApiAdRepository] (the
/// dashboard-managed `GET /api/ads`); tests and design previews use
/// [MockAdRepository].
abstract interface class AdRepository {
  Future<List<AdModel>> fetchAds();
}

/// Ads managed in the admin dashboard (Ads page).
class ApiAdRepository implements AdRepository {
  ApiAdRepository(this.token, {AdService? service})
    : _service = service ?? AdService();

  final String token;
  final AdService _service;

  @override
  Future<List<AdModel>> fetchAds() => _service.getAds(token);
}

/// Fixed ads, for tests and design previews.
class MockAdRepository implements AdRepository {
  MockAdRepository(this.ads, {this.error});

  final List<AdModel> ads;

  /// When set, [fetchAds] fails with it (to exercise the failure path).
  final Object? error;
  int calls = 0;

  @override
  Future<List<AdModel>> fetchAds() async {
    calls += 1;
    if (error != null) throw error!;
    return ads;
  }
}

/// What a tap on an ad opens, as set in the dashboard: a screen of the app
/// (`app:<screen>`) or a web page (`https://...`).
class AdLinkTarget {
  const AdLinkTarget._({this.screen, this.url});

  /// One of `create_order`, `my_orders`, `support`, `notifications`.
  final String? screen;
  final Uri? url;

  /// Null for an empty or unsupported link.
  static AdLinkTarget? parse(String link) {
    final value = link.trim();
    if (value.isEmpty) return null;
    if (value.startsWith('app:')) {
      final screen = value.substring(4);
      return screen.isEmpty ? null : AdLinkTarget._(screen: screen);
    }
    final uri = Uri.tryParse(value);
    if (uri == null || uri.scheme != 'https' || uri.host.isEmpty) return null;
    return AdLinkTarget._(url: uri);
  }
}

/// Impression/tap hooks used by the banner.
abstract class AdEvents {
  const AdEvents();

  /// An ad page became visible (reported once per ad and image per load).
  void onImpression(AdModel ad) {}

  /// Whether a tap on [ad] does something here (the banner is only
  /// tappable then).
  bool canOpen(AdModel ad) => ad.deepLink.isNotEmpty;

  /// The user tapped an ad for which [canOpen] is true.
  void onTap(AdModel ad) {}
}

class NoAdEvents extends AdEvents {
  const NoAdEvents();

  @override
  bool canOpen(AdModel ad) => false;
}

/// Reports views and taps to the dashboard (`POST /api/ads/events`) and
/// opens what an ad links to.
///
/// Views are sent in small batches a moment after they happen; a tap is sent
/// at once. Reporting is best effort: a failed request is dropped rather
/// than retried, so tracking never slows the app or fills its memory.
class ApiAdEvents extends AdEvents {
  ApiAdEvents({
    required this.token,
    required this.screens,
    AdService? service,
    Future<bool> Function(Uri url)? openUrl,
    this.flushDelay = const Duration(seconds: 3),
  }) : _service = service ?? AdService(),
       _openUrl = openUrl ?? _launchExternal;

  final String token;

  /// The app screens this home can open, by dashboard name.
  final Map<String, void Function()> screens;
  final Duration flushDelay;
  final AdService _service;
  final Future<bool> Function(Uri url) _openUrl;
  final List<Map<String, String>> _pending = [];
  Timer? _flushTimer;
  bool _disposed = false;

  static const _maxBatch = 20;

  static Future<bool> _launchExternal(Uri url) =>
      launchUrl(url, mode: LaunchMode.externalApplication);

  @override
  bool canOpen(AdModel ad) {
    final target = AdLinkTarget.parse(ad.deepLink);
    if (target == null) return false;
    if (target.url != null) return true;
    return screens.containsKey(target.screen);
  }

  @override
  void onImpression(AdModel ad) => _queue(ad.id, 'impression');

  @override
  void onTap(AdModel ad) {
    _queue(ad.id, 'tap');
    flush();
    final target = AdLinkTarget.parse(ad.deepLink);
    if (target == null) return;
    if (target.url != null) {
      unawaited(_openUrl(target.url!).catchError((Object _) => false));
    } else {
      screens[target.screen]?.call();
    }
  }

  void _queue(String adId, String type) {
    if (_disposed || adId.isEmpty) return;
    _pending.add({'adId': adId, 'type': type});
    if (_pending.length >= _maxBatch) {
      flush();
    } else {
      _flushTimer ??= Timer(flushDelay, flush);
    }
  }

  /// Sends what is waiting now.
  void flush() {
    _flushTimer?.cancel();
    _flushTimer = null;
    while (_pending.isNotEmpty) {
      final batch = _pending.take(_maxBatch).toList();
      _pending.removeRange(0, batch.length);
      unawaited(_service.sendEvents(token, batch).catchError((Object _) {}));
    }
  }

  /// Sends what is left and stops collecting (the home screen is closing).
  void dispose() {
    flush();
    _disposed = true;
  }
}
