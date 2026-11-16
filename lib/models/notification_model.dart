class NotificationModel {
  final String id;
  final String orderId;
  final String type;
  final String title;
  final String body;
  final bool read;
  final bool pinned;

  /// The user already confirmed this broadcast's pop-up.
  final bool acknowledged;
  final String createdAt;

  NotificationModel({
    required this.id,
    required this.orderId,
    required this.type,
    required this.title,
    required this.body,
    required this.read,
    required this.createdAt,
    this.pinned = false,
    this.acknowledged = false,
  });

  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    return NotificationModel(
      id: json['_id']?.toString() ?? '',
      orderId: json['orderId']?.toString() ?? '',
      type: json['type'] ?? '',
      title: json['title'] ?? '',
      body: json['body'] ?? '',
      read: json['read'] ?? false,
      pinned: json['pinned'] ?? false,
      acknowledged: json['acknowledgedAt'] != null,
      createdAt: json['createdAt']?.toString() ?? '',
    );
  }
}
