import 'package:flutter/material.dart';

import '../../services/localization_service.dart';

/// The show/hide button for a password field (use as `suffixIcon`).
///
/// Same control as on the login screen: a 48dp icon button with a localized
/// tooltip that states what the button will do.
class AppPasswordToggle extends StatelessWidget {
  final bool obscured;
  final VoidCallback onPressed;

  const AppPasswordToggle({
    super.key,
    required this.obscured,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: AppLocalization.get(
        context,
        obscured ? 'show_password' : 'hide_password',
      ),
      icon: Icon(
        obscured ? Icons.visibility_outlined : Icons.visibility_off_outlined,
      ),
      onPressed: onPressed,
    );
  }
}
