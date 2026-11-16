import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../bloc/app/app_bloc.dart';
import '../../bloc/app/app_event.dart';
import '../../bloc/notification/notification_bloc.dart';
import '../../bloc/notification/notification_state.dart';
import '../../screens/notifications_screen.dart';
import '../../screens/legal_document_screen.dart';
import '../../screens/settings_screen.dart';
import '../../services/legal_service.dart';
import '../../services/localization_service.dart';
import '../../services/theme_service.dart';
import 'swifora_brand.dart';

/// Header pieces and the account menu shared by the approved Customer Home
/// and Driver Dashboard. Everything that used to sit in the AppBar (profile,
/// theme, language, settings, logout) stays one tap away in [showSwiforaAccountSheet].

Future<void> openSwiforaNotifications(BuildContext context, String token) {
  return Navigator.push(
    context,
    MaterialPageRoute(
      builder: (_) => BlocProvider.value(
        value: context.read<NotificationBloc>(),
        child: NotificationsScreen(token: token),
      ),
    ),
  );
}

/// Notifications bell with the unread count.
class SwiforaNotificationButton extends StatelessWidget {
  final String token;
  final double size;

  const SwiforaNotificationButton({
    super.key,
    required this.token,
    this.size = SwiforaHeaderAction.size,
  });

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<NotificationBloc, NotificationState>(
      builder: (context, state) {
        final unread = state is NotificationsLoaded ? state.unreadCount : 0;
        final tooltip = AppLocalization.get(context, 'notifications');
        return SwiforaRoundButton(
          tooltip: tooltip,
          badgeCount: unread,
          badgeLabel:
              '$tooltip. ${AppLocalization.get(context, 'unread_notifications').replaceAll('%d', '$unread')}',
          onPressed: () => openSwiforaNotifications(context, token),
          size: size,
          child: const Icon(Icons.notifications_none_rounded),
        );
      },
    );
  }
}

/// A header action next to the notifications (support, report). The account
/// menu is in the bottom bar ("Account"), so the header has no initial-letter
/// button.
class SwiforaHeaderAction extends StatelessWidget {
  static const double size = 48;

  final IconData icon;
  final String tooltip;
  final VoidCallback onPressed;
  final int badgeCount;
  final String? badgeLabel;

  const SwiforaHeaderAction({
    super.key,
    required this.icon,
    required this.tooltip,
    required this.onPressed,
    this.badgeCount = 0,
    this.badgeLabel,
  });

  @override
  Widget build(BuildContext context) {
    return SwiforaRoundButton(
      tooltip: tooltip,
      badgeCount: badgeCount,
      badgeLabel: badgeLabel,
      onPressed: onPressed,
      size: size,
      child: Icon(icon),
    );
  }
}

Future<void> showSwiforaAccountSheet(
  BuildContext context, {
  required String fullName,
  required VoidCallback onProfile,
  required Future<void> Function() onLogout,
  List<Widget> extraTiles = const [],
}) {
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (sheetContext) {
      final theme = Theme.of(sheetContext);
      final scheme = theme.colorScheme;
      final appBloc = context.read<AppBloc>();
      final isDark = theme.brightness == Brightness.dark;
      final isAr = Localizations.localeOf(sheetContext).languageCode == 'ar';

      Widget tile({
        required IconData icon,
        required String label,
        required VoidCallback onTap,
        Color? color,
        Key? key,
        String? trailing,
      }) {
        return ListTile(
          key: key,
          leading: Icon(icon, color: color ?? scheme.onSurfaceVariant),
          title: Text(
            label,
            style: theme.textTheme.titleMedium?.copyWith(color: color),
          ),
          trailing: trailing == null
              ? null
              : Text(trailing, style: theme.textTheme.labelLarge),
          onTap: onTap,
        );
      }

      return SafeArea(
        child: Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(
            AppSpacing.sm,
            0,
            AppSpacing.sm,
            AppSpacing.lg,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsetsDirectional.symmetric(
                  horizontal: AppSpacing.lg,
                  vertical: AppSpacing.sm,
                ),
                child: Text(
                  fullName,
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              tile(
                icon: Icons.person_outline,
                label: AppLocalization.get(sheetContext, 'profile'),
                onTap: () {
                  Navigator.pop(sheetContext);
                  onProfile();
                },
              ),
              ...extraTiles,
              tile(
                icon: isDark
                    ? Icons.light_mode_outlined
                    : Icons.dark_mode_outlined,
                label: AppLocalization.get(sheetContext, 'theme'),
                trailing: AppLocalization.get(
                  sheetContext,
                  isDark ? 'theme_day' : 'theme_dark',
                ),
                onTap: () => appBloc.add(ToggleTheme()),
              ),
              tile(
                icon: Icons.translate,
                label: AppLocalization.get(sheetContext, 'language'),
                trailing: isAr ? 'English' : 'العربية',
                onTap: () => appBloc.add(ToggleLocale()),
              ),
              tile(
                icon: Icons.settings_outlined,
                label: AppLocalization.get(sheetContext, 'settings'),
                onTap: () {
                  Navigator.pop(sheetContext);
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const SettingsScreen()),
                  );
                },
              ),
              tile(
                key: const Key('accountPrivacyPolicy'),
                icon: Icons.privacy_tip_outlined,
                label: AppLocalization.get(sheetContext, 'privacy_policy'),
                onTap: () {
                  Navigator.pop(sheetContext);
                  LegalDocumentScreen.open(context, LegalService.privacy);
                },
              ),
              tile(
                key: const Key('accountTermsOfUse'),
                icon: Icons.description_outlined,
                label: AppLocalization.get(sheetContext, 'terms_of_use'),
                onTap: () {
                  Navigator.pop(sheetContext);
                  LegalDocumentScreen.open(context, LegalService.terms);
                },
              ),
              const Divider(),
              Tooltip(
                message: AppLocalization.get(sheetContext, 'logout'),
                child: tile(
                  key: const Key('accountLogout'),
                  icon: Icons.logout,
                  color: scheme.error,
                  label: AppLocalization.get(sheetContext, 'logout'),
                  onTap: () async {
                    Navigator.pop(sheetContext);
                    await onLogout();
                  },
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}

/// One destination of the approved bottom navigation.
class SwiforaNavItem {
  final IconData icon;
  final IconData selectedIcon;
  final String labelKey;
  final VoidCallback? onTap;

  const SwiforaNavItem({
    required this.icon,
    required this.selectedIcon,
    required this.labelKey,
    this.onTap,
  });
}

/// Bottom navigation. The first item is the current home screen; the others
/// open their existing screens (or the account menu), so routes and back
/// behaviour stay as they were.
class SwiforaBottomNav extends StatelessWidget {
  final List<SwiforaNavItem> items;

  const SwiforaBottomNav({super.key, required this.items});

  @override
  Widget build(BuildContext context) {
    return NavigationBar(
      selectedIndex: 0,
      onDestinationSelected: (index) => items[index].onTap?.call(),
      destinations: [
        for (final item in items)
          NavigationDestination(
            icon: Icon(item.icon),
            selectedIcon: Icon(item.selectedIcon),
            label: AppLocalization.get(context, item.labelKey),
          ),
      ],
    );
  }
}
