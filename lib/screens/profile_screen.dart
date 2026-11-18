import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:dio/dio.dart';
import 'dart:async';
import '../bloc/auth/auth_bloc.dart';
import '../bloc/auth/auth_event.dart';
import '../models/provider_stats.dart';
import '../models/user_model.dart';
import '../services/api_config.dart';
import '../services/mobile_api_client.dart';
import '../services/location_catalog.dart';
import '../services/validators.dart';
import '../services/responsive.dart';
import '../services/localization_service.dart';
import '../services/socket_service.dart';
import '../services/theme_service.dart';
import '../widgets/ui/app_confirm_dialog.dart';
import '../widgets/ui/app_feedback.dart';
import '../widgets/ui/app_password_toggle.dart';
import '../widgets/ui/app_tone.dart';

class ProfileScreen extends StatefulWidget {
  final UserModel user;
  final String token;
  final ValueChanged<UserModel>? onUserUpdated;

  /// The driver's rating (shown under the name); null for customers.
  final ProviderStats? driverStats;

  const ProfileScreen({
    super.key,
    required this.user,
    required this.token,
    this.onUserUpdated,
    this.driverStats,
  });

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _currentPassCtrl = TextEditingController();
  final _newPassCtrl = TextEditingController();
  final _confirmPassCtrl = TextEditingController();
  List<Map<String, dynamic>> _phones = [];
  final _phoneCtrl = TextEditingController();
  bool _loadingPhones = true;
  bool _hideCurrentPass = true;
  bool _hideNewPass = true;
  bool _hideConfirmPass = true;

  late UserModel _currentUser = widget.user;
  late final _cityFieldKey = GlobalKey<FormFieldState<String>>();
  List<GovernorateOption> _governorates = [];
  String? _selectedGovernorate;
  String? _selectedArea;
  bool _loadingLocation = true;
  bool _savingLocation = false;
  StreamSubscription? _profileUpdatedSub;

  @override
  void initState() {
    super.initState();
    _nameCtrl.text = widget.user.fullName;
    _emailCtrl.text = widget.user.email;
    _loadPhones();
    _loadLocationOptions();
    _profileUpdatedSub = SocketService.instance.onProviderProfileUpdated.listen(
      (data) {
        if (!mounted) return;
        final rawUser = data['user'];
        if (rawUser is! Map) return;

        final updated = UserModel.fromJson(Map<String, dynamic>.from(rawUser));
        setState(() {
          _currentUser = updated;
          _nameCtrl.text = updated.fullName;
          _emailCtrl.text = updated.email;
          _selectedGovernorate = updated.governorate;
          _selectedArea = updated.area;
        });
        _loadPhones();
        widget.onUserUpdated?.call(updated);
      },
    );
  }

  GovernorateOption? get _currentGovernorate {
    for (final governorate in _governorates) {
      if (governorate.name == _selectedGovernorate) {
        return governorate;
      }
    }
    return null;
  }

  String _governorateLabel(GovernorateOption governorate) {
    return governorate.nativeName;
  }

  Future<void> _loadLocationOptions() async {
    try {
      final governorates = await LocationCatalog.load();
      final currentGovernorate = LocationCatalog.findForUser(
        governorates,
        governorate: _currentUser.governorate,
        area: _currentUser.area,
      );

      if (!mounted) return;
      setState(() {
        _governorates = governorates;
        _selectedGovernorate = currentGovernorate?.name;
        _selectedArea = currentGovernorate == null
            ? null
            : LocationCatalog.cityForUser(
                currentGovernorate,
                _currentUser.area,
              );
        _loadingLocation = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() => _loadingLocation = false);
      }
    }
  }

  Future<void> _saveLocation() async {
    final governorate = _currentGovernorate;
    final area = _selectedArea;

    if (governorate == null || area == null) {
      AppFeedback.error(
        context,
        AppLocalization.get(context, 'profile_pick_location_first'),
      );
      return;
    }

    if (_savingLocation) return;
    setState(() => _savingLocation = true);

    try {
      final response = await _client().put(
        '/users/area',
        data: {'governorate': governorate.areaValue, 'area': area},
      );
      final updated = UserModel.fromJson(
        Map<String, dynamic>.from(response.data['user'] as Map),
      );

      if (!mounted) return;
      setState(() => _currentUser = updated);
      widget.onUserUpdated?.call(updated);
      AppFeedback.success(
        context,
        AppLocalization.get(context, 'profile_location_updated'),
      );
    } catch (e) {
      if (!mounted) return;
      AppFeedback.error(context, e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) {
        setState(() => _savingLocation = false);
      }
    }
  }

  @override
  void dispose() {
    _profileUpdatedSub?.cancel();
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _currentPassCtrl.dispose();
    _newPassCtrl.dispose();
    _confirmPassCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadPhones() async {
    try {
      final res = await _client().get('/users/phones');
      if (!mounted) return;
      final list = res.data['phones'] ?? [];
      setState(() {
        _phones = List<Map<String, dynamic>>.from(
          list.map((p) {
            if (p is Map) return p;
            return {'number': p.toString(), 'primary': false};
          }),
        );
        _loadingPhones = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loadingPhones = false);
    }
  }

  Future<void> _addPhone() async {
    final phone = Validators.normalizePhone(_phoneCtrl.text);
    if (phone.isEmpty) return;
    if (!Validators.isValidPhone(phone)) {
      AppFeedback.error(
        context,
        AppLocalization.get(context, 'phone_invalid_hint'),
      );
      return;
    }
    try {
      await _client().post('/users/phones', data: {'number': phone});
      _phoneCtrl.clear();
      _loadPhones();
    } catch (e) {
      if (mounted) AppFeedback.error(context, _requestError(e));
    }
  }

  String _requestError(Object error) {
    if (error is DioException) {
      final data = error.response?.data;
      final message = data is Map ? data['error'] ?? data['message'] : null;
      if (message is String && message.trim().isNotEmpty) return message;
    }
    return AppLocalization.get(context, 'phone_update_failed');
  }

  /// Replaces [number] with a new one; a primary number stays primary.
  Future<void> _editPhone(String number) async {
    final newNumber = await showDialog<String>(
      context: context,
      builder: (_) => _PhoneEditDialog(initial: number),
    );
    if (newNumber == null || newNumber.isEmpty || newNumber == number) return;
    if (!mounted) return;
    if (!Validators.isValidPhone(newNumber)) {
      AppFeedback.error(
        context,
        AppLocalization.get(context, 'phone_invalid_hint'),
      );
      return;
    }
    try {
      await _client().put(
        '/users/phones',
        data: {'number': number, 'newNumber': newNumber},
      );
      if (!mounted) return;
      AppFeedback.success(
        context,
        AppLocalization.get(context, 'phone_updated'),
      );
      _loadPhones();
    } catch (e) {
      if (mounted) AppFeedback.error(context, _requestError(e));
    }
  }

  Future<void> _removePhone(String number) async {
    final confirmed = await showAppConfirmDialog(
      context,
      title: AppLocalization.get(context, 'delete_phone_confirm_title'),
      message: AppLocalization.get(
        context,
        'delete_phone_confirm_message',
      ).replaceFirst('%s', number),
      confirmLabel: AppLocalization.get(context, 'delete'),
      destructive: true,
    );
    if (!confirmed || !mounted) return;
    try {
      await _client().delete('/users/phones', data: {'number': number});
      _loadPhones();
    } catch (e) {
      if (mounted) AppFeedback.error(context, _requestError(e));
    }
  }

  Future<void> _setPrimaryPhone(String number) async {
    try {
      await _client().put('/users/phones/primary', data: {'number': number});
      _loadPhones();
    } catch (e) {
      if (mounted) AppFeedback.error(context, _requestError(e));
    }
  }

  Future<void> _saveName() async {
    final name = _nameCtrl.text.trim();
    if (!Validators.isValidName(name)) {
      AppFeedback.error(context, AppLocalization.get(context, 'name_invalid'));
      return;
    }
    try {
      final dio = _client();
      await dio.put('/users/profile', data: {'fullName': name});
      if (!mounted) return;
      AppFeedback.success(
        context,
        AppLocalization.get(context, 'profile_name_updated'),
      );
    } catch (e) {
      if (!mounted) return;
      // The server's own message (e.g. name too long), never raw exception text.
      final data = e is DioException ? e.response?.data : null;
      final message = data is Map ? data['error'] : null;
      AppFeedback.error(
        context,
        message is String && message.trim().isNotEmpty
            ? message
            : AppLocalization.get(context, 'something_went_wrong'),
      );
    }
  }

  Future<String?> _promptCurrentPasswordForEmailChange() async {
    final controller = TextEditingController();

    try {
      return await showDialog<String>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: Text(
            AppLocalization.get(dialogContext, 'profile_confirm_email_change'),
          ),
          content: TextField(
            controller: controller,
            obscureText: true,
            autofocus: true,
            decoration: InputDecoration(
              labelText: AppLocalization.get(dialogContext, 'current_password'),
              border: const OutlineInputBorder(),
            ),
            onSubmitted: (value) {
              if (value.isNotEmpty) {
                Navigator.of(dialogContext).pop(value);
              }
            },
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: Text(AppLocalization.get(dialogContext, 'cancel')),
            ),
            ElevatedButton(
              onPressed: () {
                final value = controller.text;

                if (value.isNotEmpty) {
                  Navigator.of(dialogContext).pop(value);
                }
              },
              child: Text(AppLocalization.get(dialogContext, 'confirm')),
            ),
          ],
        ),
      );
    } finally {
      controller.dispose();
    }
  }

  Future<void> _saveEmail() async {
    final email = _emailCtrl.text.trim().toLowerCase();

    final validationError = Validators.email(email);

    if (validationError != null) {
      AppFeedback.error(context, validationError);
      return;
    }
    // A complete address, without a misspelled provider (the server also
    // checks the domain receives mail).
    if (!Validators.isCompleteEmail(email)) {
      AppFeedback.error(
        context,
        AppLocalization.get(context, 'email_incomplete'),
      );
      return;
    }
    final suggestion = Validators.suggestedEmail(email);
    if (suggestion != null) {
      AppFeedback.error(
        context,
        AppLocalization.get(
          context,
          'email_typo',
        ).replaceFirst('%s', suggestion),
      );
      return;
    }

    if (email == _currentUser.email.trim().toLowerCase()) {
      AppFeedback.info(
        context,
        AppLocalization.get(context, 'profile_email_unchanged'),
      );
      return;
    }

    final currentPassword = await _promptCurrentPasswordForEmailChange();

    if (!mounted || currentPassword == null) {
      return;
    }

    try {
      final dio = _client();

      await dio.put(
        '/users/email',
        data: {
          'currentPassword': currentPassword,
          'newEmail': email,
          'confirmEmail': email,
        },
      );

      // The server rotates sessionVersion and may disconnect
      // this screen before the HTTP response returns.
      if (!mounted) return;

      AppFeedback.success(
        context,
        AppLocalization.get(context, 'profile_email_updated'),
      );

      context.read<AuthBloc>().add(LogoutEvent());
    } catch (e) {
      if (!mounted) return;

      AppFeedback.error(context, e.toString());
    }
  }

  Future<void> _changePassword() async {
    final currentPassword = _currentPassCtrl.text;
    final newPassword = _newPassCtrl.text;
    final confirmPassword = _confirmPassCtrl.text;

    if (currentPassword.isEmpty) {
      AppFeedback.error(
        context,
        AppLocalization.get(context, 'profile_enter_current_password'),
      );
      return;
    }

    final validationError = Validators.password(newPassword);

    if (validationError != null) {
      AppFeedback.error(context, validationError);
      return;
    }

    if (newPassword != confirmPassword) {
      AppFeedback.error(
        context,
        AppLocalization.get(context, 'password_mismatch'),
      );
      return;
    }

    try {
      final dio = _client();

      await dio.put(
        '/users/password',
        data: {
          'currentPassword': currentPassword,
          'newPassword': newPassword,
          'confirmPassword': confirmPassword,
        },
      );

      // Socket revocation may remove this screen before
      // the HTTP password-change request returns.
      if (!mounted) return;

      _currentPassCtrl.clear();
      _newPassCtrl.clear();
      _confirmPassCtrl.clear();

      if (!mounted) return;

      AppFeedback.success(
        context,
        AppLocalization.get(context, 'profile_password_changed'),
      );
    } catch (e) {
      if (!mounted) return;

      AppFeedback.error(context, e.toString());
    }
  }

  Dio _client() => MobileApiClient.create(
    baseUrl: ApiConfig.apiUrl,
    headers: {
      'Authorization': 'Bearer ${widget.token}',
      'Content-Type': 'application/json',
    },
    connectTimeout: const Duration(seconds: 8),
    receiveTimeout: null,
  );

  @override
  Widget build(BuildContext context) {
    final isProvider = widget.user.role == 'provider';
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: Text(AppLocalization.get(context, 'profile_title')),
        centerTitle: true,
      ),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: EdgeInsets.symmetric(
            horizontal: Responsive.paddingHorizontal(context),
            vertical: 20,
          ),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 500),
            child: Column(
              children: [
                Text(
                  _currentUser.fullName,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  _currentUser.email,
                  textDirection: TextDirection.ltr,
                  style: TextStyle(color: scheme.onSurfaceVariant),
                ),
                Text(
                  'ID ${_currentUser.publicId}',
                  textDirection: TextDirection.ltr,
                  style: TextStyle(
                    color: scheme.onSurfaceVariant,
                    fontSize: 13,
                  ),
                ),
                if (isProvider && widget.driverStats != null) ...[
                  const SizedBox(height: 12),
                  _buildDriverRating(context, widget.driverStats!),
                ],
                const SizedBox(height: 24),
                _buildSection(
                  AppLocalization.get(context, 'profile_name'),
                  _nameCtrl,
                  onSave: _saveName,
                  maxLength: Validators.maxNameLength,
                ),
                _buildSection(
                  AppLocalization.get(context, 'email'),
                  _emailCtrl,
                  onSave: _saveEmail,
                  latin: true,
                ),
                const SizedBox(height: 12),
                _buildLocationSection(context),
                const SizedBox(height: 12),
                Text(
                  AppLocalization.get(context, 'profile_phones'),
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _phoneCtrl,
                        textDirection: TextDirection.ltr,
                        decoration: InputDecoration(
                          hintText: AppLocalization.get(
                            context,
                            'profile_add_phone_hint',
                          ),
                          border: const OutlineInputBorder(),
                        ),
                        keyboardType: TextInputType.phone,
                        onSubmitted: (_) => _addPhone(),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton(
                      tooltip: AppLocalization.get(context, 'add_phone'),
                      onPressed: _addPhone,
                      icon: Icon(Icons.add_circle, color: scheme.primary),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                if (_loadingPhones)
                  const Padding(
                    padding: EdgeInsetsDirectional.symmetric(vertical: 16),
                    child: Center(
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                else
                  ..._phones.map((p) {
                    final number = (p['number'] ?? '').toString();
                    final isPrimary = p['primary'] == true;
                    return ListTile(
                      dense: true,
                      leading: isPrimary
                          ? Icon(
                              Icons.star,
                              color: Theme.of(context).colorScheme.primary,
                              size: 20,
                            )
                          : const SizedBox(width: 20),
                      title: Text(number, textDirection: TextDirection.ltr),
                      subtitle: isPrimary
                          ? Text(
                              AppLocalization.get(
                                context,
                                'profile_primary_phone',
                              ),
                            )
                          : null,
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            tooltip: AppLocalization.get(context, 'edit_phone'),
                            icon: const Icon(Icons.edit_outlined, size: 18),
                            onPressed: () => _editPhone(number),
                          ),
                          if (!isPrimary)
                            TextButton(
                              onPressed: () => _setPrimaryPhone(number),
                              child: Text(
                                AppLocalization.get(
                                  context,
                                  'profile_make_primary',
                                ),
                              ),
                            ),
                          if (!isPrimary)
                            IconButton(
                              tooltip: AppLocalization.get(context, 'delete'),
                              icon: Icon(
                                Icons.delete_outline,
                                size: 18,
                                color: scheme.error,
                              ),
                              onPressed: () => _removePhone(number),
                            ),
                        ],
                      ),
                    );
                  }),
                const SizedBox(height: 12),
                Text(
                  AppLocalization.get(context, 'change_password'),
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _currentPassCtrl,
                  obscureText: _hideCurrentPass,
                  autofillHints: const [AutofillHints.password],
                  decoration: InputDecoration(
                    labelText: AppLocalization.get(context, 'current_password'),
                    border: const OutlineInputBorder(),
                    suffixIcon: AppPasswordToggle(
                      obscured: _hideCurrentPass,
                      onPressed: () =>
                          setState(() => _hideCurrentPass = !_hideCurrentPass),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _newPassCtrl,
                  obscureText: _hideNewPass,
                  autofillHints: const [AutofillHints.newPassword],
                  decoration: InputDecoration(
                    labelText: AppLocalization.get(context, 'new_password'),
                    border: const OutlineInputBorder(),
                    suffixIcon: AppPasswordToggle(
                      obscured: _hideNewPass,
                      onPressed: () =>
                          setState(() => _hideNewPass = !_hideNewPass),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _confirmPassCtrl,
                  obscureText: _hideConfirmPass,
                  autofillHints: const [AutofillHints.newPassword],
                  decoration: InputDecoration(
                    labelText: AppLocalization.get(context, 'confirm_password'),
                    border: const OutlineInputBorder(),
                    suffixIcon: AppPasswordToggle(
                      obscured: _hideConfirmPass,
                      onPressed: () =>
                          setState(() => _hideConfirmPass = !_hideConfirmPass),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _changePassword,
                    child: Text(
                      AppLocalization.get(context, 'change_password'),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLocationSection(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final governorate = _currentGovernorate;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerLow,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: scheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Icons.location_on_outlined, color: scheme.primary),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  AppLocalization.get(context, 'profile_location_title'),
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            AppLocalization.get(context, 'profile_location_hint'),
            style: TextStyle(
              color: scheme.onSurfaceVariant,
              fontSize: 12,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 12),
          if (_loadingLocation)
            const Center(
              child: Padding(
                padding: EdgeInsetsDirectional.symmetric(vertical: 12),
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            )
          else if (_governorates.isEmpty)
            Text(
              AppLocalization.get(context, 'profile_areas_failed'),
              style: TextStyle(color: scheme.error, fontSize: 13),
            )
          else ...[
            DropdownButtonFormField<String>(
              key: const Key('profileGovernorateDropdown'),
              initialValue: _selectedGovernorate,
              isExpanded: true,
              decoration: InputDecoration(
                labelText: AppLocalization.get(context, 'governorate'),
                border: const OutlineInputBorder(),
              ),
              items: _governorates
                  .map(
                    (option) => DropdownMenuItem(
                      value: option.name,
                      child: Text(_governorateLabel(option)),
                    ),
                  )
                  .toList(),
              onChanged: _savingLocation
                  ? null
                  : (value) {
                      _cityFieldKey.currentState?.didChange(null);
                      setState(() {
                        _selectedGovernorate = value;
                        _selectedArea = null;
                      });
                    },
            ),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              key: _cityFieldKey,
              initialValue: _selectedArea,
              isExpanded: true,
              decoration: InputDecoration(
                labelText: AppLocalization.get(context, 'town_city'),
                border: const OutlineInputBorder(),
              ),
              items: governorate == null
                  ? const <DropdownMenuItem<String>>[]
                  : [
                      DropdownMenuItem(
                        value: governorate.areaValue,
                        child: Text(
                          AppLocalization.get(
                            context,
                            'profile_whole_governorate',
                          ).replaceFirst('%s', governorate.nativeName),
                        ),
                      ),
                      ...governorate
                          .citiesSortedFor(
                            arabic: LocationCatalog.isArabic(context),
                          )
                          .map(
                            (city) => DropdownMenuItem(
                              value: city,
                              child: Text(
                                governorate.cityLabel(
                                  city,
                                  arabic: LocationCatalog.isArabic(context),
                                ),
                              ),
                            ),
                          ),
                    ],
              onChanged: governorate == null || _savingLocation
                  ? null
                  : (value) => setState(() => _selectedArea = value),
            ),
            if (_currentUser.governorateLevel &&
                _currentUser.role == 'provider') ...[
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: scheme.secondaryContainer,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      Icons.public,
                      size: 18,
                      color: scheme.onSecondaryContainer,
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        AppLocalization.get(context, 'profile_scope_carried'),
                        style: TextStyle(
                          color: scheme.onSecondaryContainer,
                          fontSize: 12,
                          height: 1.4,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 8),
            Text(
              AppLocalization.get(context, 'profile_location_note'),
              style: TextStyle(
                color: scheme.onSurfaceVariant,
                fontSize: 11.5,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 10),
            ElevatedButton.icon(
              key: const Key('profileSaveLocation'),
              onPressed: _savingLocation ? null : _saveLocation,
              icon: const Icon(Icons.save_outlined, size: 18),
              label: Text(
                _savingLocation
                    ? AppLocalization.get(context, 'saving')
                    : AppLocalization.get(context, 'profile_save_location'),
              ),
            ),
          ],
        ],
      ),
    );
  }

  /// The driver's rating as a small chip under the name (moved here from
  /// the home screen).
  Widget _buildDriverRating(BuildContext context, ProviderStats stats) {
    final theme = Theme.of(context);
    final tone = appToneStyle(context, AppTone.accent);
    final String label;
    if (stats.ratingCount == 0) {
      label = AppLocalization.get(context, 'no_ratings_yet');
    } else {
      final average = (stats.ratingStars / stats.ratingCount).toStringAsFixed(
        1,
      );
      label =
          '${AppLocalization.get(context, 'rating_average').replaceAll('%s', average)}'
          ' · '
          '${AppLocalization.get(context, 'rating_count').replaceAll('%d', '${stats.ratingCount}')}';
    }
    return Semantics(
      key: const Key('profileDriverRating'),
      label: '${AppLocalization.get(context, 'driver_rating')}: $label',
      excludeSemantics: true,
      child: Container(
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.xs,
        ),
        decoration: BoxDecoration(
          color: tone.background,
          borderRadius: BorderRadius.circular(AppRadius.pill),
          border: Border.all(color: tone.border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.star_rounded, size: AppSizes.iconSm, color: tone.solid),
            const SizedBox(width: AppSpacing.xs),
            Text(
              label,
              style: theme.textTheme.labelLarge?.copyWith(
                color: tone.foreground,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSection(
    String label,
    TextEditingController ctrl, {
    VoidCallback? onSave,
    bool latin = false,
    int? maxLength,
  }) {
    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: 12),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: ctrl,
              maxLength: maxLength,
              textDirection: latin ? TextDirection.ltr : null,
              decoration: InputDecoration(
                labelText: label,
                border: const OutlineInputBorder(),
              ),
            ),
          ),
          if (onSave != null) ...[
            const SizedBox(width: 8),
            IconButton(
              tooltip: AppLocalization.get(context, 'save'),
              onPressed: onSave,
              icon: Icon(
                Icons.check_circle,
                color: Theme.of(context).colorScheme.primary,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Asks for a replacement phone number. The dialog owns its controller so it
/// is disposed only after the closing animation has finished.
class _PhoneEditDialog extends StatefulWidget {
  final String initial;

  const _PhoneEditDialog({required this.initial});

  @override
  State<_PhoneEditDialog> createState() => _PhoneEditDialogState();
}

class _PhoneEditDialogState extends State<_PhoneEditDialog> {
  late final TextEditingController _controller = TextEditingController(
    text: widget.initial,
  );

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _save() =>
      Navigator.pop(context, Validators.normalizePhone(_controller.text));

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(AppLocalization.get(context, 'edit_phone')),
      content: TextField(
        controller: _controller,
        autofocus: true,
        keyboardType: TextInputType.phone,
        textDirection: TextDirection.ltr,
        decoration: InputDecoration(
          labelText: AppLocalization.get(context, 'new_phone_number'),
          border: const OutlineInputBorder(),
        ),
        onSubmitted: (_) => _save(),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(AppLocalization.get(context, 'cancel')),
        ),
        FilledButton(
          onPressed: _save,
          child: Text(AppLocalization.get(context, 'save')),
        ),
      ],
    );
  }
}
