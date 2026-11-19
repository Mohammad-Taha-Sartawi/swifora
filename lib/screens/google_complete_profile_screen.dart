import 'package:flutter/material.dart';

import '../services/validators.dart';
import '../services/auth_service.dart';
import '../services/google_auth_api.dart';
import '../services/localization_service.dart';
import '../services/location_catalog.dart';
import '../services/responsive.dart';
import '../services/theme_service.dart';
import '../widgets/ui/app_button_loading_indicator.dart';
import '../widgets/ui/app_feedback.dart';
import '../widgets/ui/legal_consent_dialog.dart';

/// After "Continue with Google" for a new driver: the details the admin
/// review needs and Google does not give us (phone, governorate, city and
/// service types). A new customer does not see this screen: they go
/// straight in and give phone and place with their first order. The name
/// comes from Google and can be corrected; the email is the Google
/// account's.
///
/// Pops with the server's session-shaped reply (signed in, or pending).
class GoogleCompleteProfileScreen extends StatefulWidget {
  final String role;
  final String registrationToken;
  final String fullName;
  final String email;
  final GoogleAuthApi? api;

  const GoogleCompleteProfileScreen({
    super.key,
    required this.role,
    required this.registrationToken,
    required this.fullName,
    required this.email,
    this.api,
  });

  @override
  State<GoogleCompleteProfileScreen> createState() =>
      _GoogleCompleteProfileScreenState();
}

class _GoogleCompleteProfileScreenState
    extends State<GoogleCompleteProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _cityFieldKey = GlobalKey<FormFieldState<String>>();
  late final _nameController = TextEditingController(text: widget.fullName);
  final _phoneController = TextEditingController();
  late final GoogleAuthApi _api = widget.api ?? GoogleAuthApi();

  List<GovernorateOption> _governorates = [];
  bool _areasLoading = true;
  bool _areasFailed = false;
  String? _governorate;
  String? _area;
  final Set<String> _serviceTypes = {};
  bool _submitting = false;

  bool get _isDriver => widget.role == 'provider';

  GovernorateOption? get _currentGovernorate {
    for (final option in _governorates) {
      if (option.name == _governorate) return option;
    }
    return null;
  }

  @override
  void initState() {
    super.initState();
    _loadAreas();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _loadAreas() async {
    setState(() {
      _areasLoading = true;
      _areasFailed = false;
    });
    try {
      final governorates = await LocationCatalog.load();
      if (!mounted) return;
      setState(() {
        _governorates = governorates;
        _areasLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _areasLoading = false;
        _areasFailed = true;
      });
    }
  }

  Future<void> _submit() async {
    if (_submitting || !_formKey.currentState!.validate()) return;
    if (_isDriver && _serviceTypes.isEmpty) {
      AppFeedback.error(
        context,
        AppLocalization.get(context, 'service_type_required'),
      );
      return;
    }

    // The same agreements as the email sign-up, in the same order.
    if (!await confirmSignUpAgreements(context) || !mounted) return;

    setState(() => _submitting = true);
    try {
      final result = await _api.complete(
        registrationToken: widget.registrationToken,
        fullName: _nameController.text.trim(),
        phone: Validators.normalizePhone(_phoneController.text),
        governorate: _governorate ?? '',
        area: _area ?? '',
        serviceTypes: _serviceTypes.toList(),
      );
      if (!mounted) return;
      Navigator.of(context).pop(result);
    } on AuthRequestException catch (error) {
      if (!mounted) return;
      AppFeedback.error(context, error.message);
      if (error.code == 'GOOGLE_REGISTRATION_EXPIRED' ||
          error.code == 'ACCOUNT_EXISTS') {
        Navigator.of(context).pop();
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  InputDecoration _decoration(String label, IconData icon) =>
      InputDecoration(labelText: label, prefixIcon: Icon(icon));

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isAr = AppLocalization.isArabic(context);
    final required = AppLocalization.get(context, 'required');
    final governorate = _currentGovernorate;

    return Scaffold(
      appBar: AppBar(
        title: Text(AppLocalization.get(context, 'google_complete_title')),
        centerTitle: true,
      ),
      body: SafeArea(
        top: false,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: AppSizes.authMaxWidth),
            child: SingleChildScrollView(
              padding: Responsive.pageInsets(context),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      AppLocalization.get(
                        context,
                        _isDriver
                            ? 'google_complete_hint_driver'
                            : 'google_complete_hint_customer',
                      ),
                      style: theme.textTheme.bodyLarge?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    TextFormField(
                      key: const Key('googleNameField'),
                      controller: _nameController,
                      textInputAction: TextInputAction.next,
                      autofillHints: const [AutofillHints.name],
                      decoration: _decoration(
                        AppLocalization.get(context, 'full_name'),
                        Icons.person_outline,
                      ),
                      validator: (v) =>
                          (v ?? '').trim().length < 2 ? required : null,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextFormField(
                      initialValue: widget.email,
                      enabled: false,
                      textDirection: TextDirection.ltr,
                      decoration: _decoration(
                        AppLocalization.get(context, 'email'),
                        Icons.email_outlined,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextFormField(
                      key: const Key('googlePhoneField'),
                      controller: _phoneController,
                      keyboardType: TextInputType.phone,
                      textDirection: TextDirection.ltr,
                      textInputAction: TextInputAction.next,
                      autofillHints: const [AutofillHints.telephoneNumber],
                      decoration: _decoration(
                        AppLocalization.get(context, 'phone_number'),
                        Icons.phone_outlined,
                      ).copyWith(errorMaxLines: 3),
                      validator: (v) {
                        if ((v ?? '').trim().isEmpty) return required;
                        return Validators.isValidPhone(v!)
                            ? null
                            : AppLocalization.get(
                                context,
                                'phone_invalid_hint',
                              );
                      },
                    ),
                    const SizedBox(height: AppSpacing.md),
                    DropdownButtonFormField<String>(
                      key: const Key('googleGovernorateField'),
                      initialValue: _governorate,
                      isExpanded: true,
                      decoration: _decoration(
                        AppLocalization.get(context, 'governorate'),
                        Icons.map_outlined,
                      ),
                      items: _governorates
                          .map(
                            (option) => DropdownMenuItem(
                              value: option.name,
                              child: Text(
                                isAr ? option.nativeName : option.displayName,
                              ),
                            ),
                          )
                          .toList(),
                      onChanged: (value) {
                        _cityFieldKey.currentState?.didChange(null);
                        setState(() {
                          _governorate = value;
                          _area = null;
                        });
                      },
                      validator: (value) => value == null ? required : null,
                    ),
                    if (_governorates.isEmpty &&
                        (_areasLoading || _areasFailed))
                      Padding(
                        padding: const EdgeInsetsDirectional.only(
                          top: AppSpacing.xs,
                        ),
                        child: _areasFailed
                            ? TextButton.icon(
                                onPressed: _loadAreas,
                                icon: const Icon(Icons.refresh),
                                label: Text(
                                  AppLocalization.get(
                                    context,
                                    'profile_areas_failed',
                                  ),
                                ),
                              )
                            : const LinearProgressIndicator(),
                      ),
                    const SizedBox(height: AppSpacing.md),
                    DropdownButtonFormField<String>(
                      key: _cityFieldKey,
                      initialValue: _area,
                      isExpanded: true,
                      decoration: _decoration(
                        AppLocalization.get(context, 'city_village'),
                        Icons.location_city_outlined,
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
                                  ).replaceFirst(
                                    '%s',
                                    isAr
                                        ? governorate.nativeName
                                        : governorate.displayName,
                                  ),
                                ),
                              ),
                              ...governorate
                                  .citiesSortedFor(arabic: isAr)
                                  .map(
                                    (city) => DropdownMenuItem(
                                      value: city,
                                      child: Text(
                                        governorate.cityLabel(
                                          city,
                                          arabic: isAr,
                                        ),
                                      ),
                                    ),
                                  ),
                            ],
                      onChanged: governorate == null
                          ? null
                          : (value) => setState(() => _area = value),
                      validator: (value) => value == null ? required : null,
                    ),
                    if (_isDriver) ...[
                      const SizedBox(height: AppSpacing.lg),
                      Text(
                        AppLocalization.get(context, 'service_types'),
                        style: theme.textTheme.titleSmall,
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Wrap(
                        spacing: AppSpacing.sm,
                        runSpacing: AppSpacing.sm,
                        children: ['product', 'people', 'goods']
                            .map(
                              (type) => FilterChip(
                                key: Key('googleServiceType_$type'),
                                label: Text(AppLocalization.get(context, type)),
                                selected: _serviceTypes.contains(type),
                                onSelected: (selected) => setState(() {
                                  selected
                                      ? _serviceTypes.add(type)
                                      : _serviceTypes.remove(type);
                                }),
                              ),
                            )
                            .toList(),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.xl),
                    SizedBox(
                      height: AppSizes.buttonHeight,
                      child: ElevatedButton(
                        key: const Key('googleCompleteSubmit'),
                        onPressed: _submitting ? null : _submit,
                        child: _submitting
                            ? const AppButtonLoadingIndicator()
                            : Text(
                                AppLocalization.get(
                                  context,
                                  _isDriver
                                      ? 'google_complete_submit_driver'
                                      : 'google_complete_submit_customer',
                                ),
                              ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
