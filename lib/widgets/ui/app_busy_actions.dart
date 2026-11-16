import 'package:flutter/widgets.dart';

/// Runs an action at most once at a time per key and tells the screen which
/// actions are in flight, so their buttons can be disabled and show progress.
///
/// Prevents double submissions from repeated taps on irreversible steps
/// (accepting an offer, approving delivery, starting or completing a trip).
mixin AppBusyActions<T extends StatefulWidget> on State<T> {
  final Set<String> _busyActions = <String>{};

  bool isActionBusy(String key) => _busyActions.contains(key);

  bool get hasBusyAction => _busyActions.isNotEmpty;

  /// Runs [action] unless an action with the same [key] is already running.
  Future<void> runBusyAction(String key, Future<void> Function() action) async {
    if (_busyActions.contains(key)) return;
    setState(() => _busyActions.add(key));
    try {
      await action();
    } finally {
      if (mounted) {
        setState(() => _busyActions.remove(key));
      } else {
        _busyActions.remove(key);
      }
    }
  }
}
