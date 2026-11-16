import 'dart:async';

import 'package:flutter/material.dart';

import '../../models/notification_model.dart';
import '../../services/localization_service.dart';
import '../../services/notification_service.dart';
import '../../services/theme_service.dart';
import 'app_tone.dart';

/// How long the confirm button of a broadcast pop-up stays locked, so the
/// message is read before it can be dismissed.
const broadcastConfirmDelay = Duration(seconds: 5);

/// Shows a message sent from the dashboard (to all drivers or customers) as a
/// pop-up on the home screen. It cannot be dismissed by tapping outside or
/// with the back button; the confirm button unlocks after
/// [broadcastConfirmDelay]. Returns once the user confirmed.
Future<void> showBroadcastPopup(
  BuildContext context, {
  required String title,
  required String body,
}) {
  return showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (_) => _BroadcastDialog(title: title, body: body),
  );
}

class _BroadcastDialog extends StatefulWidget {
  final String title;
  final String body;

  const _BroadcastDialog({required this.title, required this.body});

  @override
  State<_BroadcastDialog> createState() => _BroadcastDialogState();
}

class _BroadcastDialogState extends State<_BroadcastDialog> {
  late int _secondsLeft = broadcastConfirmDelay.inSeconds;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      setState(() => _secondsLeft -= 1);
      if (_secondsLeft <= 0) timer.cancel();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tone = appToneStyle(context, AppTone.primary);
    final locked = _secondsLeft > 0;
    final confirm = AppLocalization.get(context, 'broadcast_confirm');

    return PopScope(
      canPop: false,
      child: AlertDialog(
        icon: Center(
          child: Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: tone.background,
              borderRadius: BorderRadius.circular(AppRadius.lg),
            ),
            child: Icon(Icons.campaign_outlined, color: tone.foreground),
          ),
        ),
        title: Text(
          widget.title,
          textAlign: TextAlign.center,
          style: theme.textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.w800,
          ),
        ),
        content: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.sizeOf(context).height * 0.45,
          ),
          child: SingleChildScrollView(
            child: Text(
              widget.body,
              style: theme.textTheme.bodyLarge?.copyWith(height: 1.6),
            ),
          ),
        ),
        actions: [
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              key: const Key('broadcastConfirmButton'),
              onPressed: locked ? null : () => Navigator.of(context).pop(),
              child: Text(
                locked
                    ? AppLocalization.get(context, 'broadcast_confirm_in')
                          .replaceFirst('%s', confirm)
                          .replaceFirst('%d', '$_secondsLeft')
                    : confirm,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Shows unconfirmed broadcast messages one after another on a home screen:
/// when the screen opens (messages sent while the app was closed) and when a
/// new one arrives live. Confirming stops the pop-up; the message stays
/// pinned in the notifications list until it expires (72 hours).
mixin BroadcastPopupHost<T extends StatefulWidget> on State<T> {
  final NotificationService _broadcastService = NotificationService();
  final Set<String> _confirmedBroadcasts = <String>{};
  bool _broadcastPopupOpen = false;
  bool _broadcastCheckAgain = false;
  bool _broadcastDialogShowing = false;

  /// A message pop-up is on screen: screens that open by themselves must
  /// wait, or they would cover it (the home calls them after
  /// [onBroadcastsConfirmed]).
  bool get isBroadcastDialogShowing => _broadcastDialogShowing;

  /// Called after the user confirmed one or more pop-ups (e.g. to refresh
  /// the notifications badge).
  void onBroadcastsConfirmed() {}

  Future<void> showPendingBroadcasts(String token) async {
    if (_broadcastPopupOpen) {
      _broadcastCheckAgain = true;
      return;
    }
    _broadcastPopupOpen = true;
    var confirmedAny = false;
    try {
      do {
        _broadcastCheckAgain = false;
        List<NotificationModel> notifications;
        try {
          notifications = await _broadcastService.getNotifications(token);
        } catch (_) {
          return; // Shown next time the home screen checks.
        }
        final pending =
            notifications
                .where(
                  (n) =>
                      n.type == 'broadcast' &&
                      !n.acknowledged &&
                      n.id.isNotEmpty &&
                      !_confirmedBroadcasts.contains(n.id),
                )
                .toList()
              // Oldest first, so messages read in the order they were sent.
              ..sort((a, b) => a.createdAt.compareTo(b.createdAt));

        for (final message in pending) {
          if (!mounted) return;
          _broadcastDialogShowing = true;
          try {
            await showBroadcastPopup(
              context,
              title: message.title,
              body: message.body,
            );
          } finally {
            _broadcastDialogShowing = false;
          }
          _confirmedBroadcasts.add(message.id);
          confirmedAny = true;
          try {
            await _broadcastService.acknowledge(token, message.id);
          } catch (_) {
            // Not shown again in this session; the server will offer it
            // again next session if the confirmation did not reach it.
          }
        }
      } while (_broadcastCheckAgain && mounted);
    } finally {
      _broadcastPopupOpen = false;
      if (confirmedAny && mounted) onBroadcastsConfirmed();
    }
  }
}
