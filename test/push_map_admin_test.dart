import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('Firebase push registration is wired into both home roles', () {
    final customer = File('lib/screens/home_screen.dart').readAsStringSync();
    final provider = File(
      'lib/screens/provider_home_screen.dart',
    ).readAsStringSync();
    final service = File(
      'lib/services/push_notification_service.dart',
    ).readAsStringSync();
    final bootstrap = File(
      'lib/services/firebase_bootstrap.dart',
    ).readAsStringSync();

    expect(customer, contains('PushNotificationService.instance.start'));
    expect(provider, contains('PushNotificationService.instance.start'));
    expect(service, contains("'/users/push-token'"));
    expect(service, contains('FirebaseMessaging'));
    expect(service, contains('onBackgroundMessage'));
    expect(bootstrap, contains('FIREBASE_ANDROID_APP_ID'));
    expect(bootstrap, contains('FIREBASE_IOS_APP_ID'));
    expect(bootstrap, contains('Firebase.initializeApp'));
  });

  test('backend push tokens, FCM sender, and new-order pushes exist', () {
    final model = File(
      'swifora_backend/src/models/PushToken.js',
    ).readAsStringSync();
    final sender = File(
      'swifora_backend/src/services/pushNotifications.js',
    ).readAsStringSync();
    final notifications = File(
      'swifora_backend/src/services/mobileNotifications.js',
    ).readAsStringSync();
    final orders = File(
      'swifora_backend/src/routes/orders.js',
    ).readAsStringSync();
    final users = File(
      'swifora_backend/src/routes/users.js',
    ).readAsStringSync();

    expect(model, contains('token'));
    expect(model, contains('unique: true'));
    expect(sender, contains('sendEachForMulticast'));
    expect(sender, contains('FIREBASE_SERVICE_ACCOUNT_JSON'));
    expect(notifications, contains('sendPushToUser'));
    // New and resent orders go through one announcer (live event + push).
    final announcement = File(
      'swifora_backend/src/services/orderAnnouncement.js',
    ).readAsStringSync();
    expect(orders, contains('announceOrderToDrivers'));
    expect(announcement, contains('sendPushToUsers'));
    expect(users, contains("router.post('/push-token'"));
    expect(users, contains("router.delete('/push-token'"));
  });

  test('customer tracking screen and provider location updates exist', () {
    final tracking = File(
      'lib/screens/order_tracking_screen.dart',
    ).readAsStringSync();
    final myOrders = File(
      'lib/screens/my_orders_screen.dart',
    ).readAsStringSync();
    final active = File(
      'lib/screens/provider_active_orders_screen.dart',
    ).readAsStringSync();

    expect(tracking, contains('FlutterMap'));
    expect(tracking, contains('TileLayer'));
    expect(tracking, contains('MarkerLayer'));
    expect(tracking, contains('providerLocation'));
    expect(myOrders, contains('OrderTrackingScreen'));
    expect(myOrders, contains("'track_driver'"));
    expect(active, contains('LocationService.syncToBackend'));
    expect(active, contains('Timer.periodic'));
  });

  test('Android and iOS push/location configuration is present', () {
    final manifest = File(
      'android/app/src/main/AndroidManifest.xml',
    ).readAsStringSync();
    final plist = File('ios/Runner/Info.plist').readAsStringSync();

    expect(manifest, contains('POST_NOTIFICATIONS'));
    expect(
      manifest,
      contains('com.google.firebase.messaging.default_notification_channel_id'),
    );
    expect(plist, contains('NSLocationWhenInUseUsageDescription'));
    expect(plist, contains('remote-notification'));
  });

  testWidgets('push notifications show the Swifora logo as their icon', (
    tester,
  ) async {
    final manifest = File(
      'android/app/src/main/AndroidManifest.xml',
    ).readAsStringSync().replaceAll('\r\n', '\n');
    final colors = File(
      'android/app/src/main/res/values/colors.xml',
    ).readAsStringSync();

    expect(
      manifest,
      contains(
        'android:name="com.google.firebase.messaging.default_notification_icon"\n'
        '            android:resource="@drawable/ic_stat_swifora"',
      ),
    );
    expect(manifest, contains('@color/notification_color'));
    expect(colors, contains('<color name="notification_color">#00838F'));

    // Android draws the icon as a single-color shape: every density must be
    // a white silhouette on a transparent background (not the color logo).
    const sizes = {
      'mdpi': 24,
      'hdpi': 36,
      'xhdpi': 48,
      'xxhdpi': 72,
      'xxxhdpi': 96,
    };
    for (final entry in sizes.entries) {
      final file = File(
        'android/app/src/main/res/drawable-${entry.key}/ic_stat_swifora.png',
      );
      expect(file.existsSync(), isTrue, reason: entry.key);
      final decoded = await tester.runAsync(() async {
        final codec = await ui.instantiateImageCodec(file.readAsBytesSync());
        final frame = await codec.getNextFrame();
        final bytes = await frame.image.toByteData(
          format: ui.ImageByteFormat.rawStraightRgba,
        );
        return (frame.image.width, frame.image.height, bytes!);
      });
      final (width, height, rgba) = decoded!;
      expect(width, entry.value, reason: entry.key);
      expect(height, entry.value, reason: entry.key);
      var visible = 0;
      var transparent = 0;
      var colored = 0;
      for (var i = 0; i < rgba.lengthInBytes; i += 4) {
        if (rgba.getUint8(i + 3) == 0) {
          transparent++;
          continue;
        }
        visible++;
        if (rgba.getUint8(i) != 255 ||
            rgba.getUint8(i + 1) != 255 ||
            rgba.getUint8(i + 2) != 255) {
          colored++;
        }
      }
      expect(colored, 0, reason: '${entry.key} must be white only');
      expect(visible, greaterThan(0), reason: entry.key);
      expect(transparent, greaterThan(0), reason: entry.key);
    }
  });

  test('iOS push configuration is present', () {
    final plist = File('ios/Runner/Info.plist').readAsStringSync();
    final podfile = File('ios/Podfile').readAsStringSync();
    final debugEntitlements = File(
      'ios/Runner/DebugProfile.entitlements',
    ).readAsStringSync();
    expect(plist, contains('remote-notification'));
    expect(podfile, contains("platform :ios, '15.0'"));
    expect(debugEntitlements, contains('aps-environment'));
  });

  test('commission settings are editable from the admin dashboard', () {
    final view = File(
      'swifora_backend/src/views/admin/index.ejs',
    ).readAsStringSync();
    final script = File(
      'swifora_backend/src/public/js/main.js',
    ).readAsStringSync();

    expect(view, contains('commissionSettingsForm'));
    expect(view, contains('commissionType'));
    expect(view, contains('commissionValue'));
    expect(script, contains('loadCommissionSettings'));
    expect(script, contains('saveCommissionSettings'));
    expect(script, contains("'/admin/api/commission-settings'"));
  });
}
