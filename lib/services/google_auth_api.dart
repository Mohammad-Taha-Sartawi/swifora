import 'package:dio/dio.dart';

import 'api_config.dart';
import 'auth_service.dart';
import 'mobile_api_client.dart';

/// What the server answered to "Sign in with Google".
class GoogleAuthResult {
  /// Signed in, or a driver whose sign-up waits for review: the same shape
  /// as the normal login reply (`token`/`user` or `pending`/`message`).
  final Map<String, dynamic>? session;

  /// A new person: these details must be completed first.
  final String? registrationToken;
  final String fullName;
  final String email;

  const GoogleAuthResult._({
    this.session,
    this.registrationToken,
    this.fullName = '',
    this.email = '',
  });

  bool get needsProfile => registrationToken != null;

  factory GoogleAuthResult.fromJson(Map<String, dynamic> json) {
    if (json['needsProfile'] == true) {
      final profile = json['profile'] is Map
          ? Map<String, dynamic>.from(json['profile'])
          : const <String, dynamic>{};
      return GoogleAuthResult._(
        registrationToken: json['registrationToken']?.toString(),
        fullName: profile['fullName']?.toString() ?? '',
        email: profile['email']?.toString() ?? '',
      );
    }
    return GoogleAuthResult._(session: json);
  }
}

/// Server calls for "Sign in with Google" (see swifora_backend
/// src/routes/auth.js: POST /auth/google and /auth/google/complete).
class GoogleAuthApi {
  late final Dio _dio;

  GoogleAuthApi() {
    _dio = MobileApiClient.create(
      baseUrl: ApiConfig.apiUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
    );
  }

  Future<GoogleAuthResult> signIn({
    required String idToken,
    required String role,
  }) async {
    final data = await _post('/auth/google', {
      'idToken': idToken,
      'role': role,
    });
    return GoogleAuthResult.fromJson(data);
  }

  /// Creates the account (customer: signed in) or the driver's sign-up
  /// request; returns the session-shaped reply.
  Future<Map<String, dynamic>> complete({
    required String registrationToken,
    required String fullName,
    required String phone,
    required String governorate,
    required String area,
    List<String> serviceTypes = const [],
  }) {
    return _post('/auth/google/complete', {
      'registrationToken': registrationToken,
      'fullName': fullName,
      'phone': phone,
      'governorate': governorate,
      'area': area,
      'serviceTypes': serviceTypes,
      // Asked just before this call (terms, then privacy policy).
      'privacyPolicy': true,
    });
  }

  Future<Map<String, dynamic>> _post(
    String path,
    Map<String, dynamic> body,
  ) async {
    try {
      final response = await _dio.post(path, data: body);
      final data = response.data;
      if (data is Map) return Map<String, dynamic>.from(data);
      throw const AuthRequestException(
        'Something went wrong. Please try again.',
      );
    } on DioException catch (e) {
      final data = e.response?.data;
      final message = data is Map ? data['error'] ?? data['message'] : null;
      final code = data is Map ? data['code'] : null;
      throw AuthRequestException(
        message is String && message.trim().isNotEmpty
            ? message
            : e.type == DioExceptionType.connectionError
            ? 'Cannot connect to server. Check your network.'
            : 'Something went wrong. Please try again.',
        code: code is String && code.isNotEmpty ? code : null,
      );
    }
  }
}
