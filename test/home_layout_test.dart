import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
    'customer home prioritizes the new-order action and groups the rest',
    () {
      final home = File('lib/screens/home_screen.dart').readAsStringSync();

      expect(home, contains('createOrderCta'));
      expect(home, contains('_buildPrimaryOrderCard'));
      expect(home, contains("'my_orders_section'"));
      // Help and report moved to the header (owner request, 2026-11-16).
      expect(home, isNot(contains("'help_and_report_section'")));
      // Customers have no order-scope setting any more (the governorate
      // choice belongs to drivers), so the order settings section is gone.
      expect(home, isNot(contains("'order_settings_section'")));

      final ctaIndex = home.indexOf('_buildPrimaryOrderCard(context)');
      final adIndex = home.indexOf('AdBannerCarousel(');
      final ordersIndex = home.indexOf("'my_orders_section'");

      expect(ctaIndex, greaterThanOrEqualTo(0));
      // The ad sits after the main card and before the orders.
      expect(adIndex, greaterThan(ctaIndex));
      expect(ordersIndex, greaterThan(adIndex));
    },
  );

  test('provider home: availability, ad, orders, finance, settings', () {
    final home = File(
      'lib/screens/provider_home_screen.dart',
    ).readAsStringSync();

    final availabilityIndex = home.indexOf(
      '_buildAvailabilityCard(context, s)',
    );
    final adIndex = home.indexOf('AdBannerCarousel(');
    final ordersIndex = home.indexOf("'driver_orders_section'");
    final financeIndex = home.indexOf("'financial_summary_section'");
    final settingsIndex = home.indexOf("'work_settings_section'");

    expect(availabilityIndex, greaterThanOrEqualTo(0));
    // Same place as on the customer's home: after the main card.
    expect(adIndex, greaterThan(availabilityIndex));
    expect(ordersIndex, greaterThan(adIndex));
    expect(financeIndex, greaterThan(ordersIndex));
    expect(settingsIndex, greaterThan(financeIndex));
    // Help and report moved to the header.
    expect(home, isNot(contains("'help_and_report_section'")));
  });

  test('both headers: notifications, support and report; no initial', () {
    for (final path in [
      'lib/screens/home_screen.dart',
      'lib/screens/provider_home_screen.dart',
    ]) {
      final home = File(path).readAsStringSync();
      expect(home, contains('SwiforaNotificationButton('), reason: path);
      expect(home, contains("Key('headerSupportButton')"), reason: path);
      expect(home, contains("Key('headerReportButton')"), reason: path);
      expect(home, isNot(contains('SwiforaAccountButton')), reason: path);
    }
  });
}
