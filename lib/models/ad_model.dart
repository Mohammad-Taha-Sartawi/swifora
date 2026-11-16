/// An advertisement managed from the admin dashboard (`GET /api/ads`).
///
/// The server already returns only active, started and not-yet-expired ads
/// for the caller's audience, sorted by `sortOrder`. The app checks the same
/// rules again ([isVisibleAt]) because the list stays on screen for a while
/// and an ad may expire while the customer is looking at the home screen.
class AdModel {
  final String id;
  final String title;

  /// Short supporting text (the dashboard calls it "body"; shown as the
  /// subtitle).
  final String body;

  /// Image URLs as stored by the dashboard (relative `/uploads/...` paths or
  /// absolute URLs). One ad may carry several images.
  final List<String> images;
  final DateTime? startsAt;

  /// Expiry; null means the dashboard set no end date.
  final DateTime? endsAt;
  final bool isActive;
  final int sortOrder;

  /// Where a tap should take the user. Not sent by the server yet; when it
  /// is, banners become tappable without further changes here.
  final String deepLink;

  /// Show the "ends in" countdown on the banner (set per ad in the
  /// dashboard; hidden by default).
  final bool showCountdown;

  const AdModel({
    required this.id,
    required this.title,
    required this.body,
    required this.images,
    this.startsAt,
    this.endsAt,
    this.isActive = true,
    this.sortOrder = 0,
    this.deepLink = '',
    this.showCountdown = false,
  });

  factory AdModel.fromJson(Map<String, dynamic> json) {
    final rawImages = json['images'] ?? json['imageUrl'];
    final images = rawImages is List
        ? rawImages
              .map((image) => image.toString().trim())
              .where((image) => image.isNotEmpty)
              .toList()
        : rawImages is String && rawImages.trim().isNotEmpty
        ? [rawImages.trim()]
        : <String>[];
    final rawSort = json['sortOrder'];

    return AdModel(
      id: (json['_id'] ?? json['id'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      body: (json['body'] ?? json['subtitle'] ?? '').toString(),
      images: images,
      startsAt: DateTime.tryParse(
        (json['startsAt'] ?? json['startAt'])?.toString() ?? '',
      ),
      endsAt: DateTime.tryParse(
        (json['endsAt'] ?? json['expiresAt'])?.toString() ?? '',
      ),
      // Absent means active: the public endpoint only returns active ads.
      isActive: json['isActive'] != false,
      sortOrder: rawSort is num
          ? rawSort.toInt()
          : int.tryParse(rawSort?.toString() ?? '') ?? 0,
      deepLink: (json['deepLink'] ?? json['targetRoute'] ?? json['link'] ?? '')
          .toString()
          .trim(),
      showCountdown: json['showCountdown'] == true,
    );
  }

  String get imageUrl => images.isEmpty ? '' : images.first;

  bool isExpiredAt(DateTime now) {
    return endsAt != null && !endsAt!.isAfter(now);
  }

  bool isActiveAt(DateTime now) {
    final starts = startsAt;
    return (starts == null || !starts.isAfter(now)) && !isExpiredAt(now);
  }

  /// Shown only when active, started (if a start is set) and not expired.
  bool isVisibleAt(DateTime now) => isActive && isActiveAt(now);
}

/// One page of the home banner: an ad image (an ad with several images gives
/// several pages), or the ad's text on a branded panel when it has none.
class AdSlide {
  final AdModel ad;

  /// Empty for an ad without images.
  final String imageUrl;

  const AdSlide({required this.ad, required this.imageUrl});

  String get key => '${ad.id}|$imageUrl';
}

/// The banner pages to show at [now]: visible ads only, by `sortOrder` and
/// otherwise in the order received.
List<AdSlide> adSlidesAt(List<AdModel> ads, DateTime now) {
  final visible = <(int, AdModel)>[
    for (var i = 0; i < ads.length; i++)
      if (ads[i].isVisibleAt(now)) (i, ads[i]),
  ];
  visible.sort((a, b) {
    final bySort = a.$2.sortOrder.compareTo(b.$2.sortOrder);
    return bySort != 0 ? bySort : a.$1.compareTo(b.$1);
  });

  return [
    for (final (_, ad) in visible)
      if (ad.images.isEmpty)
        if (ad.title.trim().isNotEmpty || ad.body.trim().isNotEmpty)
          AdSlide(ad: ad, imageUrl: '')
        else
          ...const <AdSlide>[]
      else
        for (final image in ad.images) AdSlide(ad: ad, imageUrl: image),
  ];
}

/// The next moment at which the set of visible ads changes (an ad starts or
/// expires), so the banner can refresh exactly then instead of polling.
DateTime? nextAdChangeAfter(List<AdModel> ads, DateTime now) {
  DateTime? next;
  for (final ad in ads) {
    if (!ad.isActive) continue;
    for (final moment in [ad.startsAt, ad.endsAt]) {
      if (moment != null &&
          moment.isAfter(now) &&
          (next == null || moment.isBefore(next))) {
        next = moment;
      }
    }
  }
  return next;
}
