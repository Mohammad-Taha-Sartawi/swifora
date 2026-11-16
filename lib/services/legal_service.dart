import 'package:dio/dio.dart';

import 'api_config.dart';
import 'mobile_api_client.dart';

/// The privacy policy or the terms of use, as written in the dashboard.
class LegalDocument {
  final String key;
  final String content;
  final DateTime? updatedAt;

  const LegalDocument({
    required this.key,
    required this.content,
    this.updatedAt,
  });

  factory LegalDocument.fromJson(Map<String, dynamic> json) {
    return LegalDocument(
      key: json['key']?.toString() ?? '',
      content: json['content']?.toString() ?? '',
      updatedAt: DateTime.tryParse(json['updatedAt']?.toString() ?? ''),
    );
  }
}

/// Reads the public texts (no sign-in needed, so they can be read before
/// creating an account).
class LegalService {
  static const privacy = 'privacy';
  static const terms = 'terms';

  late final Dio _dio;

  LegalService() {
    _dio = MobileApiClient.create(
      baseUrl: ApiConfig.apiUrl,
      connectTimeout: const Duration(seconds: 20),
      receiveTimeout: const Duration(seconds: 20),
    );
  }

  Future<LegalDocument> fetch(String key) async {
    final response = await _dio.get('/legal/$key');
    return LegalDocument.fromJson(Map<String, dynamic>.from(response.data));
  }
}
