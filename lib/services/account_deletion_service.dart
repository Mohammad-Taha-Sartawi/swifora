import 'package:dio/dio.dart';

import 'api_config.dart';
import 'mobile_api_client.dart';

/// An open request to delete the account, waiting for the admins.
class AccountDeletionRequest {
  const AccountDeletionRequest({required this.requestedAt});

  final DateTime? requestedAt;

  static AccountDeletionRequest? fromJson(Object? json) {
    if (json is! Map || json['status'] != 'pending') return null;
    return AccountDeletionRequest(
      requestedAt: DateTime.tryParse('${json['requestedAt'] ?? ''}'),
    );
  }
}

class AccountDeletionException implements Exception {
  const AccountDeletionException(this.message);
  final String message;
}

/// The account deletion request: sent from the app, reviewed and approved
/// in the dashboard; the user can withdraw it while it waits.
class AccountDeletionService {
  AccountDeletionService({Dio? dio})
    : _dio =
          dio ??
          MobileApiClient.create(
            baseUrl: ApiConfig.apiUrl,
            connectTimeout: const Duration(seconds: 15),
            receiveTimeout: const Duration(seconds: 15),
          );

  final Dio _dio;

  static const _path = '/users/deletion-request';

  Options _auth(String token) =>
      Options(headers: {'Authorization': 'Bearer $token'});

  /// The open request, or null when there is none.
  Future<AccountDeletionRequest?> status(String token) =>
      _call(() => _dio.get(_path, options: _auth(token)));

  Future<AccountDeletionRequest?> send(String token) =>
      _call(() => _dio.post(_path, options: _auth(token)));

  /// Withdraws the open request.
  Future<void> withdraw(String token) async {
    try {
      await _dio.delete(_path, options: _auth(token));
    } on DioException catch (e) {
      // Already gone (withdrawn on another device): nothing to do.
      if (e.response?.statusCode == 404) return;
      throw AccountDeletionException(_message(e));
    }
  }

  Future<AccountDeletionRequest?> _call(
    Future<Response<dynamic>> Function() request,
  ) async {
    try {
      final response = await request();
      final data = response.data;
      return AccountDeletionRequest.fromJson(
        data is Map ? data['request'] : null,
      );
    } on DioException catch (e) {
      throw AccountDeletionException(_message(e));
    }
  }

  static String _message(DioException e) {
    final data = e.response?.data;
    final message = data is Map ? data['error'] : null;
    return message is String && message.trim().isNotEmpty ? message : '';
  }
}
