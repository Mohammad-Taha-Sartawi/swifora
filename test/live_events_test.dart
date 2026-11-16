import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:swifora/services/socket_service.dart';

class _QuietSocket extends SocketService {
  _QuietSocket() : super.forTest();

  @override
  void connect({required String token, String? area}) {}

  @override
  void disconnect() {}
}

void main() {
  test('each live event from the server reaches its stream', () async {
    final socket = _QuietSocket();
    final received = <String>[];
    final subs = [
      socket.onAdsChanged.listen((_) => received.add('ads')),
      socket.onDriversChanged.listen((_) => received.add('drivers')),
      socket.onAccountChanged.listen((_) => received.add('account')),
      socket.onEarningsChanged.listen((_) => received.add('earnings')),
    ];

    for (final event in [
      'ads_changed',
      'drivers_changed',
      'account_changed',
      'earnings_changed',
      'unknown_event',
    ]) {
      socket.debugReceiveLiveEvent(event);
    }
    await Future<void>.delayed(Duration.zero);
    expect(received, ['ads', 'drivers', 'account', 'earnings']);
    for (final sub in subs) {
      await sub.cancel();
    }
  });

  test('both homes react to the live events', () {
    final customer = File('lib/screens/home_screen.dart').readAsStringSync();
    final driver = File(
      'lib/screens/provider_home_screen.dart',
    ).readAsStringSync();
    final service = File('lib/services/socket_service.dart').readAsStringSync();

    // The socket listens for every live event the server sends.
    expect(service, contains("'ads_changed'"));
    expect(service, contains('_socket!.on(entry.key'));

    // Customers: banner, available drivers, own account.
    expect(customer, contains('onAdsChanged.listen'));
    expect(customer, contains('onDriversChanged.listen'));
    expect(customer, contains('onAccountChanged.listen'));

    // Drivers: banner, own account, earnings.
    expect(driver, contains('onAdsChanged.listen'));
    expect(driver, contains('onAccountChanged.listen'));
    expect(driver, contains('onEarningsChanged.listen'));
  });
}
