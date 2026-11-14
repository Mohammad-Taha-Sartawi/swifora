import 'package:flutter/widgets.dart';

/// Shared behaviour of the list screens (new orders, offers, my orders, …).
///
/// * When the last item of a screen's list goes away (an offer was sent,
///   the last offer expired, the last order was delivered, …), the screen
///   closes and the app returns to the home screen. A screen that was opened
///   already empty stays open and shows its empty state, since the user
///   chose to look at it.
/// * While a list screen is the visible screen, the home screen may open
///   another screen on top of it for a live event (a new offer, a delivery
///   that started). Form screens (create order, submit offer, profile, chat)
///   never register, so the user is never pulled away from typing.
mixin ListScreenNavigation<T extends StatefulWidget> on State<T> {
  bool _listHadItems = false;
  bool _listExitScheduled = false;

  /// Identifies what this screen shows, e.g. `offers:<orderId>`, so the home
  /// screen does not open the same screen twice.
  String get listScreenTag;

  /// Call from `build` with the number of items the screen currently shows,
  /// or null while it is (re)loading and the count is not known. Depends on
  /// the route, so the check runs again when the screen comes back to the
  /// top after a dialog or a pushed screen.
  void trackListItems(int? itemCount) {
    final route = ModalRoute.of(context);
    final isCurrent = route?.isCurrent ?? false;
    VisibleListScreen._report(this, isCurrent ? listScreenTag : null);

    if (itemCount == null) return;
    if (itemCount > 0) {
      _listHadItems = true;
      return;
    }
    if (!_listHadItems || _listExitScheduled || !isCurrent) return;

    _listExitScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _listExitScheduled = false;
      if (!mounted) return;
      final current = ModalRoute.of(context);
      if (current != null && !current.isCurrent) return;
      if (current?.isFirst ?? true) return; // already the root screen
      _listHadItems = false;
      Navigator.of(context).popUntil((route) => route.isFirst);
    });
  }

  @override
  void dispose() {
    VisibleListScreen._report(this, null);
    super.dispose();
  }
}

/// Which list screen, if any, is the visible (top) screen right now.
abstract final class VisibleListScreen {
  static Object? _owner;
  static String? _tag;

  /// Tag of the visible list screen, or null when the top screen is not a
  /// list screen (home, a form, a dialog, …).
  static String? get tag => _tag;

  static void _report(Object owner, String? tag) {
    if (tag != null) {
      _owner = owner;
      _tag = tag;
    } else if (identical(_owner, owner)) {
      _owner = null;
      _tag = null;
    }
  }

  @visibleForTesting
  static void reset() {
    _owner = null;
    _tag = null;
  }
}
