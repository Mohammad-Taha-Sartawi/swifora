import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:swifora/models/provider_stats.dart';

void main() {
  test('provider stats parse rating summary fields', () {
    final stats = ProviderStats.fromJson({
      'dailyEarnings': 10,
      'monthlyEarnings': 20,
      'totalSuccessful': 2,
      'dailyOrderCount': 1,
      'dailyCommission': 1,
      'monthlyCommission': 2,
      'pendingOrdersCount': 0,
      'offeredOrdersCount': 0,
      'activeOrdersCount': 0,
      'averageRating': 4.6,
      'ratingCount': 7,
      'ratingStars': 32,
    });

    expect(stats.averageRating, 4.6);
    expect(stats.ratingCount, 7);
    expect(stats.ratingStars, 32);
  });

  test(
    'customer is prompted to rate immediately after delivery confirmation',
    () {
      final source = File(
        'lib/screens/my_orders_screen.dart',
      ).readAsStringSync();

      expect(source, contains('_showRatingPrompt'));

      expect(source, contains("'rating_prompt_title'"));

      expect(source, contains("'rating_prompt_body'"));

      expect(source, contains('_submitRating'));

      expect(source, contains('_orderService.rateOrder'));

      expect(source, contains('await _showRatingPrompt()'));
    },
  );

  test('the driver rating is in the profile, not on the home screen', () {
    final home = File(
      'lib/screens/provider_home_screen.dart',
    ).readAsStringSync();
    final profile = File('lib/screens/profile_screen.dart').readAsStringSync();

    // Moved off the home screen (owner request, 2026-11-16).
    expect(home, isNot(contains('_buildRatingCard')));
    expect(home, contains('driverStats:'));

    expect(profile, contains('_buildDriverRating'));
    expect(profile, contains("'driver_rating'"));
    expect(profile, contains('ratingStars'));
    expect(profile, contains('ratingCount'));
    expect(profile, contains("'rating_count'"));
    expect(profile, contains("'rating_average'"));
  });

  test('the driver is asked to rate the customer right after approval', () {
    final home = File(
      'lib/screens/provider_home_screen.dart',
    ).readAsStringSync();

    expect(home, contains('_promptCustomerRating(orderId)'));
    expect(home, contains("'rate_customer_title'"));
    expect(home, contains('rateCustomer(widget.token, orderId, rating)'));
  });

  test('rating notifications use a dedicated icon and order route', () {
    final source = File(
      'lib/screens/notifications_screen.dart',
    ).readAsStringSync();

    expect(source, contains("'new_rating'"));

    expect(source, contains('Icons.star_outline_rounded'));
  });

  test('backend supports rating endpoints and notifications', () {
    final orders = File(
      'swifora_backend/src/routes/orders.js',
    ).readAsStringSync();
    final model = File(
      'swifora_backend/src/models/Rating.js',
    ).readAsStringSync();

    expect(orders, contains("router.post('/:id/rating'"));

    expect(orders, contains("type: 'new_rating'"));

    expect(model, contains('unique: true'));
  });
}
