import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/app/app_bloc.dart';
import '../bloc/auth/auth_bloc.dart';
import '../bloc/auth/auth_event.dart';
import '../bloc/order/order_bloc.dart';
import '../bloc/offer/offer_bloc.dart';
import '../bloc/notification/notification_bloc.dart';
import '../bloc/notification/notification_event.dart';
import '../bloc/notification/notification_state.dart';
import '../models/user_model.dart';
import '../services/auth_service.dart';
import '../services/responsive.dart';
import '../services/theme_service.dart';
import '../services/localization_service.dart';
import '../services/location_catalog.dart';
import '../services/location_service.dart';
import '../services/order_service.dart';
import '../services/notification_router.dart';
import '../services/push_notification_service.dart';
import '../services/support_chat_service.dart';
import '../widgets/ui/ad_banner_carousel.dart';
import '../widgets/ui/app_confirm_dialog.dart';
import '../widgets/ui/app_feedback.dart';
import '../widgets/ui/app_tone.dart';
import '../widgets/brand/swifora_brand.dart';
import '../widgets/ui/broadcast_popup.dart';
import '../widgets/brand/swifora_home_chrome.dart';
import '../services/ad_repository.dart';
import 'create_order_screen.dart';
import 'my_orders_screen.dart';
import 'order_offers_screen.dart';
import 'login_screen.dart';
import 'report_screen.dart';
import 'profile_screen.dart';
import 'support_chat_screen.dart';
import '../services/socket_service.dart';
import '../services/mobile_session_failure.dart';
import '../services/list_screen_navigation.dart';
import 'account_deletion_screen.dart';

class HomeScreen extends StatefulWidget {
  final UserModel user;
  final String role;
  final String token;
  const HomeScreen({
    super.key,
    required this.user,
    required this.role,
    required this.token,
  });
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen>
    with WidgetsBindingObserver, BroadcastPopupHost {
  final OrderService _orderService = OrderService();
  Timer? _notifTimer;

  /// Orders not taken by a driver yet (waiting for or with offers).
  int _openOrdersCount = 0;

  /// Orders with at least one driver's price waiting for an answer.
  int _ordersWithOffersCount = 0;
  int _inProgressOrdersCount = 0;
  int _onTheWayCount = 0;
  int? _availableDriversCount;
  int _supportUnreadCount = 0;
  int _adRefreshTick = 0;
  late final ApiAdEvents _adEvents;
  late ChatService _supportChatService;
  StreamSubscription? _newOfferSub;
  StreamSubscription? _deliveryConfirmationSub;
  StreamSubscription? _offerCancelledSub;
  StreamSubscription? _socketConnectedSub;
  StreamSubscription? _orderStatusSub;
  StreamSubscription? _offerAcceptedSub;
  StreamSubscription? _broadcastSub;
  final List<StreamSubscription> _liveSubs = [];
  StreamSubscription? _accountDeletedSub;
  StreamSubscription? _sessionRevokedSub;
  StreamSubscription? _httpSessionRejectedSub;
  StreamSubscription? _supportReplySub;
  bool _sessionExitStarted = false;
  late UserModel _user = widget.user;
  final Set<String> _openingOffersOrderIds = {};
  bool _openingInProgressOrders = false;

  @override
  void initState() {
    super.initState();
    // Messages sent from the dashboard while the app was closed.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) unawaited(showPendingBroadcasts(widget.token));
    });
    // Ad banner: views/taps go to the dashboard's tracking tab; a tap opens
    // the screen or web page chosen in the dashboard.
    _adEvents = ApiAdEvents(
      token: widget.token,
      screens: {
        'create_order': _openCreateOrder,
        'my_orders': _openOrdersReport,
        'support': () => unawaited(_openSupport()),
        'notifications': () =>
            unawaited(openSwiforaNotifications(context, widget.token)),
      },
    );
    WidgetsBinding.instance.addObserver(this);

    _httpSessionRejectedSub = MobileSessionFailure.instance.onRejected.listen((
      event,
    ) {
      if (!event.belongsTo(widget.token)) {
        return;
      }

      _endSession();
    });

    LocationCatalog.warmUp();
    LocationService.syncToBackend(widget.token);

    SocketService.instance.connect(token: widget.token);
    unawaited(PushNotificationService.instance.start(widget.token));
    _listenToPushNotifications();

    _socketConnectedSub = SocketService.instance.onConnected.listen((_) {
      if (!mounted) return;
      _loadOrderCounts();
      context.read<NotificationBloc>().add(
        LoadNotifications(token: widget.token),
      );
    });

    context.read<NotificationBloc>().add(
      LoadNotifications(token: widget.token),
    );

    _loadOrderCounts();
    _loadAvailableDriversCount();
    _supportChatService = ChatService(widget.token);
    _loadSupportUnreadCount();
    _supportReplySub = SocketService.instance.onSupportReply.listen((_) {
      _loadSupportUnreadCount();
    });

    _notifTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      context.read<NotificationBloc>().add(
        LoadNotifications(token: widget.token),
      );
      _loadSupportUnreadCount();
      _loadOrderCounts();
      _loadAvailableDriversCount();
    });

    _newOfferSub = SocketService.instance.onNewOffer.listen((data) {
      if (!mounted) return;
      _loadOrderCounts();

      final orderId = data['orderId']?.toString();
      if (orderId != null && orderId.isNotEmpty) {
        unawaited(_openOffersForIncomingOffer(orderId));
      }
    });

    _deliveryConfirmationSub = SocketService
        .instance
        .onDeliveryConfirmationRequested
        .listen((_) {
          if (!mounted) return;
          _loadOrderCounts();
          context.read<NotificationBloc>().add(
            LoadNotifications(token: widget.token),
          );
          unawaited(_openDeliveryConfirmation());
        });

    _offerCancelledSub = SocketService.instance.onOfferCancelled.listen((data) {
      if (!mounted) return;
      _loadOrderCounts();
      context.read<NotificationBloc>().add(
        LoadNotifications(token: widget.token),
      );
      // The driver took another order: show that order's offers, where the
      // customer can resend it to another available driver. When the offers
      // screen cannot open here (a form is on top), say it in a message.
      final orderId = data['orderId']?.toString() ?? '';
      if (orderId.isNotEmpty && _canOpenForLiveEvent({'offers:$orderId'})) {
        unawaited(_openOffersForIncomingOffer(orderId));
      } else if (VisibleListScreen.tag != 'offers:$orderId') {
        AppFeedback.warning(
          context,
          AppLocalization.get(context, 'driver_taken_notification_body'),
        );
      }
    });

    _orderStatusSub = SocketService.instance.onOrderStatusChanged.listen((
      data,
    ) {
      if (!mounted) return;
      _loadOrderCounts();
      // The driver pressed "start delivery": show the in-progress orders.
      if (data['status']?.toString() == 'fulfilling') {
        unawaited(_openInProgressForLiveEvent());
      }
    });

    _offerAcceptedSub = SocketService.instance.onOfferAccepted.listen((data) {
      if (!mounted) return;
      _loadOrderCounts();
    });

    // Live changes made elsewhere (mostly in the dashboard).
    _liveSubs.addAll([
      SocketService.instance.onAdsChanged.listen((_) {
        if (mounted) setState(() => _adRefreshTick += 1);
      }),
      SocketService.instance.onDriversChanged.listen((_) {
        if (mounted) _loadAvailableDriversCount();
      }),
      SocketService.instance.onAccountChanged.listen((_) {
        if (mounted) unawaited(_refreshCurrentUser());
      }),
    ]);

    _broadcastSub = SocketService.instance.onBroadcast.listen((_) {
      if (!mounted) return;
      // A message from the dashboard: refresh the list and show it as a
      // pop-up (it stays pinned in the notifications for 72 hours). It does
      // not touch the support-chat unread counter.
      context.read<NotificationBloc>().add(
        LoadNotifications(token: widget.token),
      );
      unawaited(showPendingBroadcasts(widget.token));
    });

    _accountDeletedSub = SocketService.instance.onAccountDeleted.listen((_) {
      _endSession();
    });

    _sessionRevokedSub = SocketService.instance.onSessionRevoked.listen((_) {
      _endSession();
    });
  }

  /// Live events open a screen only while the customer is on the home
  /// screen or looking at a list screen, never over a form (create order,
  /// profile, chat) or a dialog, and never when that screen is already the
  /// one on top ([alreadyShowing]).
  bool _canOpenForLiveEvent(Set<String> alreadyShowing) {
    // A dashboard message is on screen: do not cover it.
    if (isBroadcastDialogShowing) return false;
    if (!mounted) return false;
    final visibleList = VisibleListScreen.tag;
    if (visibleList != null && alreadyShowing.contains(visibleList)) {
      return false;
    }
    final route = ModalRoute.of(context);
    final onHome = route == null || route.isCurrent;
    return onHome || visibleList != null;
  }

  Future<void> _openOffersForIncomingOffer(String orderId) async {
    if (!mounted ||
        orderId.isEmpty ||
        _openingOffersOrderIds.contains(orderId)) {
      return;
    }

    // The offers screen of this order live-refreshes when it is already open.
    if (!_canOpenForLiveEvent({'offers:$orderId'})) return;

    _openingOffersOrderIds.add(orderId);
    try {
      await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => BlocProvider(
            create: (_) => OfferBloc(),
            child: OrderOffersScreen(token: widget.token, orderId: orderId),
          ),
        ),
      );
    } finally {
      _openingOffersOrderIds.remove(orderId);
      if (mounted) {
        _loadOrderCounts();
      }
    }
  }

  /// Delivery started, or the driver asks the customer to confirm delivery:
  /// open the in-progress orders (where the confirmation button is).
  Future<void> _openDeliveryConfirmation() => _openInProgressForLiveEvent();

  Future<void> _openInProgressForLiveEvent() async {
    if (!mounted || _openingInProgressOrders) return;
    if (!_canOpenForLiveEvent(const {
      'orders:accepted,fulfilling',
      'orders:fulfilling',
    })) {
      return;
    }

    _openingInProgressOrders = true;
    try {
      await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => MyOrdersScreen(
            token: widget.token,
            statuses: const {'accepted', 'fulfilling'},
            titleKey: 'in_progress_orders_btn',
          ),
        ),
      );
    } finally {
      _openingInProgressOrders = false;
      if (mounted) {
        _loadOrderCounts();
      }
    }
  }

  Future<void> _loadOrderCounts() async {
    try {
      final orders = await _orderService.getMyOrders(widget.token);

      if (!mounted) {
        return;
      }

      var open = 0;
      var withOffers = 0;
      var inProgress = 0;
      var onTheWay = 0;

      for (final order in orders) {
        final status = order['status']?.toString();

        if (status == 'pending' || status == 'offered') {
          open += 1;
          // At least one driver's price is waiting for the customer.
          if (status == 'offered') withOffers += 1;
        } else if (status == 'accepted' || status == 'fulfilling') {
          inProgress += 1;
          if (status == 'fulfilling') onTheWay += 1;
        }
      }

      setState(() {
        _openOrdersCount = open;
        _ordersWithOffersCount = withOffers;
        _inProgressOrdersCount = inProgress;
        _onTheWayCount = onTheWay;
      });
    } catch (_) {}
  }

  Future<void> _loadSupportUnreadCount() async {
    try {
      final count = await _supportChatService.getUnreadCount();

      if (!mounted) {
        return;
      }

      setState(() => _supportUnreadCount = count);
    } catch (_) {}
  }

  Future<void> _loadAvailableDriversCount() async {
    try {
      final count = await _orderService.getAvailableDriversCount(widget.token);

      if (!mounted) {
        return;
      }

      setState(() => _availableDriversCount = count);
    } catch (_) {}
  }

  Future<void> _openMyOrders() async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => MyOrdersScreen(
          token: widget.token,
          statuses: const {'pending', 'offered'},
          titleKey: 'offers_title',
        ),
      ),
    );

    if (mounted) {
      _loadOrderCounts();
    }
  }

  Future<void> _openInProgressOrders() async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => MyOrdersScreen(
          token: widget.token,
          statuses: const {'accepted', 'fulfilling'},
          titleKey: 'in_progress_orders_btn',
        ),
      ),
    );

    if (mounted) {
      _loadOrderCounts();
    }
  }

  void _endSession() {
    if (!mounted || _sessionExitStarted) {
      return;
    }

    _sessionExitStarted = true;

    SocketService.instance.disconnect();
    context.read<AuthBloc>().add(LogoutEvent());

    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState st) {
    if (st == AppLifecycleState.resumed) {
      if (!SocketService.instance.isConnected) {
        SocketService.instance.connect(token: widget.token);
      }
      LocationService.syncToBackend(widget.token);
      _loadOrderCounts();
      _loadAvailableDriversCount();
      _loadSupportUnreadCount();
      unawaited(showPendingBroadcasts(widget.token));

      Future.delayed(const Duration(seconds: 3), () {
        if (!mounted) return;
        _loadOrderCounts();
      });
    }
  }

  void _reloadSupportAfterChat() {
    if (mounted) {
      _loadSupportUnreadCount();
    }
  }

  StreamSubscription<Map<String, dynamic>>? _pushOpenedSub;
  StreamSubscription<ForegroundPush>? _pushForegroundSub;

  /// Push notifications: a tap opens the related screen; a push that arrives
  /// while the app is open is shown as a short message.
  void _listenToPushNotifications() {
    final push = PushNotificationService.instance;
    _pushOpenedSub = push.onOpened.listen(_openFromPush);
    _pushForegroundSub = push.onForeground.listen((message) {
      if (!mounted) return;
      final text = [
        message.title,
        message.body,
      ].where((part) => part.trim().isNotEmpty).join(' — ');
      if (text.isNotEmpty) AppFeedback.info(context, text);
    });
    final pending = push.takePendingOpen();
    if (pending != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _openFromPush(pending);
      });
    }
  }

  void _openFromPush(Map<String, dynamic> data) {
    if (!mounted) return;
    NotificationRouter.openFromPush(context, data: data, token: widget.token);
  }

  @override
  void dispose() {
    _adEvents.dispose();
    WidgetsBinding.instance.removeObserver(this);
    _pushOpenedSub?.cancel();
    _pushForegroundSub?.cancel();
    _notifTimer?.cancel();
    _newOfferSub?.cancel();
    _deliveryConfirmationSub?.cancel();
    _offerCancelledSub?.cancel();
    _socketConnectedSub?.cancel();
    _orderStatusSub?.cancel();
    _offerAcceptedSub?.cancel();
    _broadcastSub?.cancel();
    for (final subscription in _liveSubs) {
      subscription.cancel();
    }
    _accountDeletedSub?.cancel();
    _sessionRevokedSub?.cancel();
    _httpSessionRejectedSub?.cancel();
    _supportReplySub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppBloc>().state;
    final isAr = appState.locale.languageCode == 'ar';
    final theme = Theme.of(context);

    return Directionality(
      textDirection: isAr ? TextDirection.rtl : TextDirection.ltr,
      child: Scaffold(
        bottomNavigationBar: SwiforaBottomNav(
          items: [
            const SwiforaNavItem(
              icon: Icons.home_outlined,
              selectedIcon: Icons.home_rounded,
              labelKey: 'nav_home',
            ),
            SwiforaNavItem(
              icon: Icons.inventory_2_outlined,
              selectedIcon: Icons.inventory_2,
              labelKey: 'nav_orders',
              onTap: _openOrdersReport,
            ),
            SwiforaNavItem(
              icon: Icons.notifications_none_rounded,
              selectedIcon: Icons.notifications,
              labelKey: 'nav_notifications',
              onTap: () => openSwiforaNotifications(context, widget.token),
            ),
            SwiforaNavItem(
              icon: Icons.person_outline,
              selectedIcon: Icons.person,
              labelKey: 'nav_account',
              onTap: _openAccountMenu,
            ),
          ],
        ),
        body: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(
                maxWidth: Responsive.maxReadableContentWidth,
              ),
              child: RefreshIndicator(
                onRefresh: () async {
                  if (mounted) {
                    setState(() => _adRefreshTick += 1);
                  }
                  final bloc = context.read<NotificationBloc>();
                  bloc.add(LoadNotifications(token: widget.token));
                  await bloc.stream.firstWhere(
                    (s) => s is! NotificationLoading,
                  );
                  await _loadOrderCounts();
                  await _loadAvailableDriversCount();
                  await _loadSupportUnreadCount();
                },
                child: SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: Responsive.pageInsets(context),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      SwiforaHeader(
                        actions: [
                          SwiforaNotificationButton(token: widget.token),
                          SwiforaHeaderAction(
                            key: const Key('headerSupportButton'),
                            icon: Icons.headset_mic_outlined,
                            tooltip: AppLocalization.get(
                              context,
                              'contact_support',
                            ),
                            badgeCount: _supportUnreadCount,
                            onPressed: _openSupport,
                          ),
                          SwiforaHeaderAction(
                            key: const Key('headerReportButton'),
                            icon: Icons.report_outlined,
                            tooltip: AppLocalization.get(
                              context,
                              'report_driver',
                            ),
                            onPressed: _openReportDriver,
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.xl),
                      Text.rich(
                        TextSpan(
                          text: AppLocalization.get(context, 'home_greeting'),
                          children: const [TextSpan(text: ' 👋')],
                        ),
                        style: theme.textTheme.displaySmall?.copyWith(
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      // The full name, as on the driver's home.
                      Text(
                        _user.fullName,
                        key: const Key('homeFullName'),
                        style: theme.textTheme.titleMedium?.copyWith(
                          color: theme.colorScheme.primary,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      Text(
                        AppLocalization.get(context, 'home_subtitle'),
                        style: theme.textTheme.bodyLarge?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xl),
                      _buildPrimaryOrderCard(context),
                      if (_availableDriversCount != null) ...[
                        const SizedBox(height: AppSpacing.md),
                        _buildAvailableDriversBanner(context),
                      ],
                      // Advertisements: right after the main card and before
                      // the orders (same place on the driver's home).
                      AdBannerCarousel(
                        token: widget.token,
                        refreshTick: _adRefreshTick,
                        events: _adEvents,
                      ),
                      // Only what is under way: the section while the
                      // customer has orders not finished yet, each row only
                      // while it has something in it.
                      if (_openOrdersCount + _inProgressOrdersCount > 0) ...[
                        const SizedBox(height: AppSpacing.lg),
                        SwiforaSectionTitle(
                          title: AppLocalization.get(
                            context,
                            'my_orders_section',
                          ),
                          actionLabel: AppLocalization.get(
                            context,
                            'view_all_orders',
                          ),
                          onAction: _openOrdersReport,
                        ),
                      ],
                      if (_ordersWithOffersCount > 0)
                        SwiforaActionRow(
                          tapKey: const Key('offersRow'),
                          icon: Icons.sell_outlined,
                          tone: AppTone.warning,
                          title: AppLocalization.get(context, 'offers_title'),
                          subtitle: AppLocalization.get(
                            context,
                            'pending_items_alert',
                          ).replaceAll('%d', '$_ordersWithOffersCount'),
                          count: _ordersWithOffersCount,
                          emphasized: true,
                          onTap: _openMyOrders,
                        ),
                      if (_ordersWithOffersCount > 0 &&
                          _inProgressOrdersCount > 0)
                        const SizedBox(height: AppSpacing.md),
                      if (_inProgressOrdersCount > 0)
                        SwiforaActionRow(
                          tapKey: const Key('inProgressRow'),
                          icon: Icons.local_shipping_outlined,
                          tone: AppTone.success,
                          title: AppLocalization.get(
                            context,
                            'in_progress_orders_btn',
                          ),
                          subtitle: AppLocalization.get(
                            context,
                            'track_orders_live',
                          ),
                          count: _inProgressOrdersCount,
                          onTap: _openInProgressOrders,
                        ),
                      if (_onTheWayCount > 0) ...[
                        const SizedBox(height: AppSpacing.md),
                        SwiforaActionRow(
                          tapKey: const Key('onTheWayRow'),
                          icon: Icons.map_outlined,
                          tone: AppTone.success,
                          title: AppLocalization.get(
                            context,
                            'order_on_the_way',
                          ),
                          subtitle: AppLocalization.get(
                            context,
                            'view_details',
                          ),
                          emphasized: true,
                          onTap: _openOnTheWay,
                        ),
                      ],
                      const SizedBox(height: AppSpacing.xl),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// Reloads the signed-in account (e.g. after an admin edited it).
  Future<void> _refreshCurrentUser() async {
    try {
      final data = await AuthService().validateSession(widget.token);
      final rawUser = data['user'];
      if (rawUser is! Map) return;
      final updated = UserModel.fromJson(Map<String, dynamic>.from(rawUser));
      if (!mounted) return;
      setState(() => _user = updated);
      _loadAvailableDriversCount();
    } catch (_) {
      // Session failures are handled by the session listeners.
    }
  }

  void _openReportDriver() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ReportScreen(
          token: widget.token,
          reportType: 'driver',
          title: AppLocalization.get(context, 'report_driver'),
        ),
      ),
    );
  }

  Future<void> _openSupport() async {
    await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => SupportChatScreen(token: widget.token)),
    );
    _reloadSupportAfterChat();
  }

  void _openCreateOrder() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => BlocProvider(
          create: (_) => OrderBloc(),
          child: CreateOrderScreen(user: _user, token: widget.token),
        ),
      ),
    ).then((_) {
      _loadOrderCounts();
      // The first order saves the place and the phone on the account.
      if (_user.governorate.trim().isEmpty || _user.phone.trim().isEmpty) {
        _refreshCurrentUser();
      }
    });
  }

  void _openOrdersReport() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => MyOrdersScreen(
          token: widget.token,
          titleKey: 'orders_report',
          readOnlyReport: true,
        ),
      ),
    );
  }

  Future<void> _openOnTheWay() async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => MyOrdersScreen(
          token: widget.token,
          statuses: const {'fulfilling'},
          titleKey: 'in_progress_orders_btn',
        ),
      ),
    );
    if (mounted) _loadOrderCounts();
  }

  void _openProfile() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ProfileScreen(
          user: _user,
          token: widget.token,
          onUserUpdated: (updated) {
            setState(() {
              _user = updated;
            });
            _loadAvailableDriversCount();
          },
        ),
      ),
    );
  }

  @override
  void onBroadcastsConfirmed() {
    context.read<NotificationBloc>().add(
      LoadNotifications(token: widget.token),
    );
  }

  void _openAccountMenu() {
    showSwiforaAccountSheet(
      context,
      fullName: _user.fullName,
      onProfile: _openProfile,
      onLogout: _logout,
      onDeleteAccount: () => Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) =>
              AccountDeletionScreen(token: widget.token, role: 'customer'),
        ),
      ),
    );
  }

  Future<void> _logout() async {
    final confirmed = await showLogoutConfirmation(context);
    if (!confirmed || !mounted) {
      return;
    }

    // Remove this device's push token while the session is still
    // valid; revoking first made the removal fail with 401.
    await PushNotificationService.instance.stop().timeout(
      const Duration(seconds: 5),
      onTimeout: () {},
    );
    if (!mounted) return;
    unawaited(AuthService().revokeSession(widget.token));
    SocketService.instance.disconnect();
    context.read<AuthBloc>().add(LogoutEvent());
    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  /// The single main action: create a new order (approved hero card).
  Widget _buildPrimaryOrderCard(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final dark = theme.brightness == Brightness.dark;

    return SwiforaCard(
      // The whole card opens the order form (a larger target than the button).
      onTap: _openCreateOrder,
      padding: EdgeInsets.zero,
      borderColor: scheme.primary.withValues(alpha: 0.35),
      gradient: LinearGradient(
        begin: AlignmentDirectional.topStart,
        end: AlignmentDirectional.bottomEnd,
        colors: dark
            ? [scheme.surfaceContainerHigh, scheme.surfaceContainerLow]
            : [scheme.surfaceContainerLowest, scheme.primaryContainer],
      ),
      child: Stack(
        children: [
          PositionedDirectional(
            end: 0,
            top: 0,
            bottom: 0,
            width: 170,
            child: ExcludeSemantics(
              child: CustomPaint(
                painter: SwiforaRoutePainter(
                  routeColor: scheme.primary,
                  accentColor: dark ? scheme.secondary : AppColors.accent,
                  ringColor: scheme.primary.withValues(alpha: 0.18),
                ),
              ),
            ),
          ),
          PositionedDirectional(
            end: 40,
            top: 92,
            child: ExcludeSemantics(
              child: Icon(
                Icons.inventory_2_outlined,
                size: 52,
                color: dark ? scheme.secondary : AppColors.accent,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsetsDirectional.all(AppSpacing.xl),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  AppLocalization.get(context, 'hero_tag'),
                  style: theme.textTheme.labelLarge?.copyWith(
                    color: scheme.secondary,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                FractionallySizedBox(
                  widthFactor: 0.62,
                  alignment: AlignmentDirectional.centerStart,
                  child: Text(
                    AppLocalization.get(context, 'hero_title'),
                    style: theme.textTheme.headlineLarge?.copyWith(
                      fontWeight: FontWeight.w900,
                      height: 1.25,
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                FractionallySizedBox(
                  widthFactor: 0.66,
                  alignment: AlignmentDirectional.centerStart,
                  child: Text(
                    AppLocalization.get(context, 'hero_body'),
                    style: theme.textTheme.bodyMedium,
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                Semantics(
                  button: true,
                  label: AppLocalization.get(context, 'new_order'),
                  excludeSemantics: true,
                  onTap: _openCreateOrder,
                  child: ElevatedButton.icon(
                    key: const Key('createOrderCta'),
                    onPressed: _openCreateOrder,
                    icon: const Icon(Icons.add_rounded),
                    label: Text(AppLocalization.get(context, 'new_order')),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Nearby drivers: the count, or why there is none (with a next step).
  Widget _buildAvailableDriversBanner(BuildContext context) {
    final theme = Theme.of(context);
    final noDrivers = _availableDriversCount == 0;
    final hint = AppLocalization.get(context, 'recommend_driver_share_hint');
    final area = LocationCatalog.localize(
      context,
      _user.governorate.trim().isNotEmpty ? _user.governorate : _user.area,
    );
    final message = noDrivers
        ? AppLocalization.get(context, 'no_available_drivers')
        : AppLocalization.get(context, 'drivers_nearby_title');
    final detail = noDrivers
        ? hint
        : [
            if (area.trim().isNotEmpty) area,
            AppLocalization.get(context, 'drivers_available_now'),
          ].join(' • ');
    final countLabel = AppLocalization.get(
      context,
      'available_drivers_count',
    ).replaceAll('%d', '${_availableDriversCount!}');

    return Semantics(
      container: true,
      label: noDrivers ? '$message $hint' : '$countLabel. $detail',
      excludeSemantics: true,
      child: SwiforaCard(
        color: appToneStyle(
          context,
          noDrivers ? AppTone.warning : AppTone.info,
        ).background.withValues(alpha: 0.55),
        child: Row(
          children: [
            SwiforaIconTile(
              icon: noDrivers
                  ? Icons.person_search_outlined
                  : Icons.location_on_outlined,
              tone: noDrivers ? AppTone.warning : AppTone.info,
              size: 52,
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    message,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xxs),
                  Text(detail, style: theme.textTheme.bodySmall),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            SwiforaCountChip(
              count: _availableDriversCount!,
              tone: noDrivers ? AppTone.warning : AppTone.success,
            ),
          ],
        ),
      ),
    );
  }
}
