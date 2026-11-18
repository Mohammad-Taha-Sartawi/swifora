import 'package:dio/dio.dart';
import 'api_config.dart';
import 'mobile_api_client.dart';

/// A report the server refused; [message] is the server's own text, or
/// empty when there is none (no connection, timeout).
class ReportException implements Exception {
  const ReportException(this.message);
  final String message;
}

class ReportService {
  late final Dio _dio;

  ReportService() {
    _dio = MobileApiClient.create(
      baseUrl: ApiConfig.apiUrl,
      headers: {'Content-Type': 'application/json'},
      connectTimeout: const Duration(seconds: 8),
      receiveTimeout: const Duration(seconds: 8),
    );
  }

  Future<Map<String, dynamic>> submitReport({
    required String token,
    required String reportedPublicId,
    required String reportType,
    required String content,
  }) async {
    try {
      final res = await _dio.post('/reports',
        data: {
          'reportedPublicId': reportedPublicId,
          'reportType': reportType,
          'content': content,
        },
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );
      return res.data;
    } on DioException catch (e) {
      // The server explains the problem in Arabic (unknown ID, text too
      // long, ...); show that rather than Dio's technical text.
      final data = e.response?.data;
      final message = data is Map ? data['error'] : null;
      throw ReportException(message is String ? message.trim() : '');
    }
  }

  Future<List<Map<String, dynamic>>> getMyReports(String token) async {
    final res = await _dio.get('/reports/my',
      options: Options(headers: {'Authorization': 'Bearer $token'}),
    );
    return List<Map<String, dynamic>>.from(res.data);
  }
}
