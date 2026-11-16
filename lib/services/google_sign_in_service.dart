import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';

/// "Sign in with Google": gets a Google ID token for our server.
///
/// Configured at build time (no secrets; these are public client IDs):
/// - `GOOGLE_SERVER_CLIENT_ID`: the Web OAuth client ID. The ID token is
///   issued for it, and the server accepts only that audience.
/// - `GOOGLE_IOS_CLIENT_ID`: the iOS OAuth client ID (iOS only; its
///   reversed form must also be a URL scheme in ios/Runner/Info.plist).
///
/// Until these are set, [isAvailable] is false and the app shows no Google
/// button (never a button that does nothing).
class GoogleSignInService {
  static const serverClientId = String.fromEnvironment(
    'GOOGLE_SERVER_CLIENT_ID',
  );
  static const iosClientId = String.fromEnvironment('GOOGLE_IOS_CLIENT_ID');

  /// Tests switch the button on and supply the Google token.
  @visibleForTesting
  static bool? availableOverride;
  @visibleForTesting
  static Future<String?> Function()? idTokenOverride;

  static bool get isAvailable {
    if (availableOverride != null) return availableOverride!;
    if (serverClientId.isEmpty) return false;
    if (Platform.isIOS) return iosClientId.isNotEmpty;
    return Platform.isAndroid;
  }

  static bool _initialized = false;

  /// The ID token of the chosen Google account, or null if the person
  /// closed the account picker. Throws [GoogleSignInException] on errors.
  Future<String?> signInForIdToken() async {
    if (idTokenOverride != null) return idTokenOverride!();
    final google = GoogleSignIn.instance;
    if (!_initialized) {
      await google.initialize(
        serverClientId: serverClientId,
        clientId: Platform.isIOS ? iosClientId : null,
      );
      _initialized = true;
    }
    // Always offer the account picker, so another account can be chosen.
    await google.signOut();
    try {
      final account = await google.authenticate(scopeHint: const ['email']);
      return account.authentication.idToken;
    } on GoogleSignInException catch (error) {
      if (error.code == GoogleSignInExceptionCode.canceled) return null;
      rethrow;
    }
  }
}
