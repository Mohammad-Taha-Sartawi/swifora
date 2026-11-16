import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/auth/auth_bloc.dart';
import '../bloc/auth/auth_event.dart';
import '../bloc/auth/auth_state.dart';
import '../bloc/app/app_bloc.dart';
import '../bloc/app/app_event.dart';
import '../bloc/provider/provider_bloc.dart';
import '../services/responsive.dart';
import '../services/guest_support_service.dart';
import '../services/auth_service.dart';
import '../services/google_auth_api.dart';
import '../services/google_sign_in_service.dart';
import '../services/legal_defaults.dart';
import '../services/legal_service.dart';
import '../services/localization_service.dart';
import '../services/location_catalog.dart';
import '../services/validators.dart';
import '../services/theme_service.dart';
import '../widgets/ui/app_button_loading_indicator.dart';
import '../widgets/ui/app_feedback.dart';
import '../widgets/ui/google_sign_in_button.dart';
import '../widgets/ui/legal_consent_dialog.dart';
import '../widgets/brand/swifora_brand.dart';
import 'home_screen.dart';
import 'provider_home_screen.dart';
import 'forgot_password_screen.dart';
import 'google_complete_profile_screen.dart';
import 'legal_document_screen.dart';
import 'force_change_password_screen.dart';
import 'guest_support_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  final Set<String> _serviceTypes = {'product', 'people', 'goods'};

  final GuestSupportService _guestSupport = GuestSupportService();
  final GoogleSignInService _googleSignIn = GoogleSignInService();
  // Created on first use (the server address is ready by then).
  late final GoogleAuthApi _googleAuthApi = GoogleAuthApi();
  bool _googleLoading = false;
  bool _isLogin = true;
  bool _obscurePassword = true;
  String _selectedRole = 'customer';
  List<GovernorateOption> _governorates = [];
  // The governorate list comes from the server. While it loads, or when it
  // could not be loaded, the dropdowns have no items (and Flutter disables
  // them), so the form says why and offers a retry instead of looking frozen.
  bool _areasLoading = false;
  bool _areasFailed = false;
  final _cityFieldKey = GlobalKey<FormFieldState<String>>();

  String? _selectedGovernorate;
  String? _selectedArea; // City/village value sent as the account area.

  GovernorateOption? get _currentGovernorate {
    for (final governorate in _governorates) {
      if (governorate.name == _selectedGovernorate) {
        return governorate;
      }
    }
    return null;
  }

  String _governorateLabel(GovernorateOption governorate, bool isAr) {
    if (isAr) {
      return governorate.nativeName;
    }
    return governorate.displayName;
  }

  @override
  void initState() {
    super.initState();
    _loadAreas();
  }

  Future<void> _loadAreas() async {
    if (_areasLoading) return;
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

  /// Shown under the governorate field until the list has loaded.
  Widget _areasStatus(BuildContext context) {
    final theme = Theme.of(context);
    if (_areasLoading) {
      return Padding(
        key: const Key('governorateLoading'),
        padding: const EdgeInsets.only(top: AppSpacing.sm),
        child: Row(
          children: [
            const SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            const SizedBox(width: AppSpacing.sm),
            Text(
              AppLocalization.get(context, 'governoratesLoading'),
              style: theme.textTheme.bodySmall,
            ),
          ],
        ),
      );
    }
    return Padding(
      key: const Key('governorateLoadFailed'),
      padding: const EdgeInsets.only(top: AppSpacing.sm),
      child: Row(
        children: [
          Icon(
            Icons.cloud_off_outlined,
            size: 18,
            color: theme.colorScheme.error,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              AppLocalization.get(context, 'governoratesLoadFailed'),
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.error,
              ),
            ),
          ),
          TextButton(
            key: const Key('governorateRetry'),
            onPressed: _loadAreas,
            child: Text(AppLocalization.get(context, 'retry')),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isAr = context.watch<AppBloc>().state.locale.languageCode == 'ar';
    final isMobile = Responsive.isMobile(context);

    final dark = theme.brightness == Brightness.dark;
    final scheme = theme.colorScheme;

    return Scaffold(
      backgroundColor: scheme.surface,
      body: Stack(
        children: [
          // Decorative, painted once: a quiet skyline and delivery route
          // behind the brand (approved Dark/Day login backdrop).
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: 300,
            child: ExcludeSemantics(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: const Alignment(0.9, -0.9),
                    radius: 1.2,
                    colors: [
                      (dark ? scheme.primary : scheme.secondary).withValues(
                        alpha: dark ? 0.16 : 0.10,
                      ),
                      scheme.surface.withValues(alpha: 0),
                    ],
                  ),
                ),
                child: CustomPaint(
                  painter: SwiforaSkylinePainter(
                    buildingColor: dark
                        ? scheme.surfaceContainerHigh.withValues(alpha: 0.7)
                        : scheme.secondaryContainer.withValues(alpha: 0.55),
                    windowColor: (dark ? scheme.secondary : scheme.surface)
                        .withValues(alpha: dark ? 0.55 : 0.9),
                    routeColor: (dark ? scheme.primary : scheme.secondary)
                        .withValues(alpha: 0.7),
                    pinColor: dark ? scheme.secondary : AppColors.accent,
                  ),
                ),
              ),
            ),
          ),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: Responsive.pageInsets(context),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(
                    maxWidth: Responsive.maxAuthWidth,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _buildLanguageBar(context, isAr),
                      SizedBox(
                        height: isMobile ? AppSpacing.sm : AppSpacing.lg,
                      ),
                      _buildBrandHeader(context),
                      const SizedBox(height: AppSpacing.xl),
                      _buildRoleSelection(context),
                      const SizedBox(height: AppSpacing.lg),
                      _buildFormCard(context),
                      const SizedBox(height: AppSpacing.xxl),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLanguageBar(BuildContext context, bool isAr) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final dark = theme.brightness == Brightness.dark;
    final activeFill = dark ? scheme.primary : scheme.secondaryContainer;
    final activeText = dark ? scheme.onPrimary : scheme.onSecondaryContainer;

    Widget option(String label, bool active, String semantic) {
      return Semantics(
        button: true,
        selected: active,
        label: semantic,
        excludeSemantics: true,
        child: InkWell(
          onTap: active
              ? null
              : () => context.read<AppBloc>().add(ToggleLocale()),
          borderRadius: BorderRadius.circular(AppRadius.pill),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 160),
            constraints: const BoxConstraints(minWidth: 56, minHeight: 44),
            alignment: Alignment.center,
            padding: const EdgeInsetsDirectional.symmetric(
              horizontal: AppSpacing.md,
            ),
            decoration: BoxDecoration(
              color: active ? activeFill : null,
              borderRadius: BorderRadius.circular(AppRadius.pill),
            ),
            child: Text(
              label,
              style: theme.textTheme.labelLarge?.copyWith(
                color: active ? activeText : scheme.onSurfaceVariant,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ),
      );
    }

    return Row(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        Tooltip(
          message: AppLocalization.get(context, 'language'),
          child: Container(
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              color: scheme.surfaceContainerLow.withValues(alpha: 0.85),
              borderRadius: BorderRadius.circular(AppRadius.pill),
              border: Border.all(color: scheme.outlineVariant),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              textDirection: TextDirection.ltr,
              children: [
                option('AR', isAr, 'العربية'),
                option('EN', !isAr, 'English'),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildBrandHeader(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;

    final dark = theme.brightness == Brightness.dark;

    return Column(
      children: [
        SwiforaMark(size: dark ? 88 : 72, tile: !dark),
        const SizedBox(height: AppSpacing.md),
        const SwiforaWordmark(),
        const SizedBox(height: AppSpacing.sm),
        Text(
          _isLogin
              ? AppLocalization.get(context, 'app_tagline')
              : AppLocalization.get(context, 'create_account_hint'),
          style: theme.textTheme.bodyLarge?.copyWith(
            color: scheme.onSurfaceVariant,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildRoleSelection(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.xs),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerLow.withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(AppRadius.xxl),
        border: Border.all(color: scheme.outlineVariant),
      ),
      child: Row(
        children: [
          Expanded(
            child: _RoleCard(
              icon: Icons.person_outline,
              title: AppLocalization.get(context, 'customer'),
              subtitle: AppLocalization.get(context, 'customer_subtitle'),
              isSelected: _selectedRole == 'customer',
              onTap: () => _selectRole('customer'),
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          Expanded(
            child: _RoleCard(
              icon: Icons.delivery_dining_outlined,
              title: AppLocalization.get(context, 'provider'),
              subtitle: AppLocalization.get(context, 'provider_subtitle'),
              isSelected: _selectedRole == 'provider',
              onTap: () => _selectRole('provider'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFormCard(BuildContext context) {
    final theme = Theme.of(context);
    final isAr = context.watch<AppBloc>().state.locale.languageCode == 'ar';

    return Card(
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.xl),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (!_isLogin) ...[
                TextFormField(
                  controller: _nameController,
                  textInputAction: TextInputAction.next,
                  autofillHints: const [AutofillHints.name],
                  decoration: _inputDecoration(
                    AppLocalization.get(context, 'full_name'),
                    Icons.person_outline,
                  ),
                  validator: (v) => v == null || v.trim().isEmpty
                      ? AppLocalization.get(context, 'required')
                      : null,
                ),
                const SizedBox(height: AppSpacing.md),
                TextFormField(
                  key: const Key('registerPhoneField'),
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  textDirection: TextDirection.ltr,
                  textInputAction: TextInputAction.next,
                  autofillHints: const [AutofillHints.telephoneNumber],
                  decoration: _inputDecoration(
                    AppLocalization.get(context, 'phone_number'),
                    Icons.phone_outlined,
                  ).copyWith(hintText: '05XXXXXXXX', errorMaxLines: 3),
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) {
                      return AppLocalization.get(context, 'required');
                    }
                    return Validators.isValidPhone(v)
                        ? null
                        : AppLocalization.get(context, 'phone_invalid_hint');
                  },
                ),
                const SizedBox(height: AppSpacing.md),
                DropdownButtonFormField<String>(
                  key: const Key('governorateDropdown'),
                  initialValue: _selectedGovernorate,
                  isExpanded: true,
                  decoration: _inputDecoration(
                    AppLocalization.get(context, 'governorate'),
                    Icons.map_outlined,
                  ),
                  items: _governorates
                      .map(
                        (governorate) => DropdownMenuItem(
                          value: governorate.name,
                          child: Text(_governorateLabel(governorate, isAr)),
                        ),
                      )
                      .toList(),
                  onChanged: (value) {
                    // The previous city belongs to another governorate and
                    // must never remain selected after changing it.
                    _cityFieldKey.currentState?.didChange(null);
                    setState(() {
                      _selectedGovernorate = value;
                      _selectedArea = null;
                    });
                  },
                  validator: (value) => value == null
                      ? AppLocalization.get(context, 'required')
                      : null,
                ),
                if (_governorates.isEmpty && (_areasLoading || _areasFailed))
                  _areasStatus(context),
                const SizedBox(height: AppSpacing.md),
                DropdownButtonFormField<String>(
                  key: _cityFieldKey,
                  initialValue: _selectedArea,
                  isExpanded: true,
                  decoration: _inputDecoration(
                    AppLocalization.get(context, 'city_village'),
                    Icons.location_city_outlined,
                  ),
                  items: _currentGovernorate == null
                      ? const <DropdownMenuItem<String>>[]
                      : [
                          DropdownMenuItem(
                            value: _currentGovernorate!.areaValue,
                            child: Text(
                              isAr
                                  ? 'من ${_currentGovernorate!.nativeName} نفسها'
                                  : 'From '
                                        '${_governorateLabel(_currentGovernorate!, false)}'
                                        ' itself',
                            ),
                          ),
                          ..._currentGovernorate!
                              .citiesSortedFor(arabic: isAr)
                              .map(
                                (city) => DropdownMenuItem(
                                  value: city,
                                  child: Text(
                                    _currentGovernorate!.cityLabel(
                                      city,
                                      arabic: isAr,
                                    ),
                                  ),
                                ),
                              ),
                        ],
                  onChanged: _currentGovernorate == null
                      ? null
                      : (value) => setState(() => _selectedArea = value),
                  validator: (value) => value == null
                      ? AppLocalization.get(context, 'required')
                      : null,
                ),
                const SizedBox(height: AppSpacing.lg),
                if (_selectedRole == 'provider') ...[
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
                            label: Text(AppLocalization.get(context, type)),
                            selected: _serviceTypes.contains(type),
                            onSelected: (selected) {
                              setState(() {
                                if (selected) {
                                  _serviceTypes.add(type);
                                } else {
                                  _serviceTypes.remove(type);
                                }
                              });
                            },
                          ),
                        )
                        .toList(),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                ],
              ],
              TextFormField(
                key: const Key('emailField'),
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                textDirection: TextDirection.ltr,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.email],
                decoration: _inputDecoration(
                  AppLocalization.get(context, 'email'),
                  Icons.email_outlined,
                ).copyWith(errorMaxLines: 3),
                validator: (v) {
                  if (v == null || v.trim().isEmpty) {
                    return AppLocalization.get(context, 'required');
                  }
                  // Sign-in only needs a well-formed address (existing
                  // accounts are never locked out); sign-up needs a
                  // complete one, without a misspelled provider.
                  if (_isLogin) {
                    return Validators.email(v) == null
                        ? null
                        : AppLocalization.get(context, 'invalid_email');
                  }
                  if (!Validators.isCompleteEmail(v)) {
                    return AppLocalization.get(context, 'email_incomplete');
                  }
                  final suggestion = Validators.suggestedEmail(v);
                  if (suggestion != null) {
                    return AppLocalization.get(
                      context,
                      'email_typo',
                    ).replaceFirst('%s', suggestion);
                  }
                  return null;
                },
              ),
              const SizedBox(height: AppSpacing.md),
              TextFormField(
                key: const Key('passwordField'),
                controller: _passwordController,
                obscureText: _obscurePassword,
                textInputAction: _isLogin
                    ? TextInputAction.done
                    : TextInputAction.next,
                // "Done" on the keyboard signs in, like the main button.
                onFieldSubmitted: _isLogin ? (_) => _submit() : null,
                autofillHints: [
                  _isLogin ? AutofillHints.password : AutofillHints.newPassword,
                ],
                decoration:
                    _inputDecoration(
                      AppLocalization.get(context, 'password'),
                      Icons.lock_outline,
                    ).copyWith(
                      suffixIcon: IconButton(
                        key: const Key('passwordVisibilityToggle'),
                        tooltip: AppLocalization.get(
                          context,
                          _obscurePassword ? 'show_password' : 'hide_password',
                        ),
                        icon: Icon(
                          _obscurePassword
                              ? Icons.visibility_outlined
                              : Icons.visibility_off_outlined,
                        ),
                        onPressed: () => setState(
                          () => _obscurePassword = !_obscurePassword,
                        ),
                      ),
                    ),
                validator: (v) {
                  if (v == null || v.isEmpty) {
                    return AppLocalization.get(context, 'required');
                  }

                  if (!_isLogin) {
                    final passwordError = Validators.password(v);

                    if (passwordError != null) {
                      return passwordError;
                    }
                  }

                  return null;
                },
              ),
              if (_isLogin)
                Align(
                  alignment: AlignmentDirectional.centerEnd,
                  child: TextButton(
                    key: const Key('forgotPasswordButton'),
                    style: TextButton.styleFrom(
                      foregroundColor: theme.colorScheme.secondary,
                    ),
                    onPressed: _openPasswordRecovery,
                    child: Text(
                      AppLocalization.get(context, 'forgot_password'),
                    ),
                  ),
                ),
              if (!_isLogin) ...[
                const SizedBox(height: AppSpacing.md),
                TextFormField(
                  controller: _confirmPasswordController,
                  obscureText: true,
                  textInputAction: TextInputAction.done,
                  autofillHints: const [AutofillHints.newPassword],
                  decoration: _inputDecoration(
                    AppLocalization.get(context, 'confirm_password'),
                    Icons.lock_outline,
                  ),
                  validator: (v) {
                    if (v == null || v.isEmpty) {
                      return AppLocalization.get(context, 'required');
                    }
                    if (v != _passwordController.text) {
                      return AppLocalization.get(context, 'password_mismatch');
                    }
                    return null;
                  },
                ),
              ],
              const SizedBox(height: AppSpacing.xl),
              BlocConsumer<AuthBloc, AuthState>(
                listener: (context, state) {
                  if (state is AuthSuccess) {
                    if (state.user.mustChangePassword) {
                      Navigator.pushAndRemoveUntil(
                        context,
                        MaterialPageRoute(
                          builder: (_) => ForceChangePasswordScreen(
                            user: state.user,
                            token: state.token,
                          ),
                        ),
                        (route) => false,
                      );
                      return;
                    }
                    final home = state.user.role == 'provider'
                        ? BlocProvider(
                            create: (_) => ProviderBloc(),
                            child: ProviderHomeScreen(
                              user: state.user,
                              token: state.token,
                            ),
                          )
                        : HomeScreen(
                            user: state.user,
                            role: state.user.role,
                            token: state.token,
                          );
                    Navigator.pushReplacement(
                      context,
                      MaterialPageRoute(builder: (_) => home),
                    );
                  }
                  if (state is AuthPendingApproval) {
                    _showPendingApproval(state.message);
                  }
                  if (state is AuthError) {
                    AppFeedback.error(
                      context,
                      state.code == 'INVALID_CREDENTIALS'
                          ? AppLocalization.get(context, 'invalid_credentials')
                          : state.message,
                    );
                  }
                },
                builder: (context, state) {
                  final isLoading = state is AuthLoading;
                  return ElevatedButton(
                    onPressed: isLoading ? null : _submit,
                    child: isLoading
                        // Disabled button paints onSurface@12% over the card,
                        // so onPrimary would disappear; onSurface keeps the
                        // indicator legible in both themes (UX01-001).
                        ? const AppButtonLoadingIndicator()
                        : Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Flexible(
                                child: Text(
                                  _isLogin
                                      ? AppLocalization.get(context, 'sign_in')
                                      : AppLocalization.get(
                                          context,
                                          'create_account',
                                        ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              const SizedBox(width: AppSpacing.sm),
                              // Forward arrow, mirrored by Flutter in RTL: left in Arabic,
                              // right in English (same as the row chevrons).
                              const Icon(
                                Icons.arrow_forward_rounded,
                                size: AppSizes.iconMd,
                              ),
                            ],
                          ),
                  );
                },
              ),
              // Sign in / sign up with Google (shown once it is configured).
              if (GoogleSignInService.isAvailable) ...[
                const SizedBox(height: AppSpacing.md),
                _buildOrDivider(context),
                const SizedBox(height: AppSpacing.md),
                GoogleSignInButton(
                  onPressed: _continueWithGoogle,
                  loading: _googleLoading,
                ),
              ],
              const SizedBox(height: AppSpacing.sm),
              TextButton(
                onPressed: _toggleAuthMode,
                child: RichText(
                  textAlign: TextAlign.center,
                  text: TextSpan(
                    style: theme.textTheme.bodyMedium,
                    children: [
                      TextSpan(
                        text: _isLogin
                            ? AppLocalization.get(context, 'no_account')
                            : AppLocalization.get(context, 'have_account'),
                      ),
                      TextSpan(
                        text: _isLogin
                            ? AppLocalization.get(context, 'sign_up')
                            : AppLocalization.get(context, 'sign_in'),
                        style: TextStyle(
                          color: theme.colorScheme.primary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Center(
                child: theme.brightness == Brightness.dark
                    ? OutlinedButton.icon(
                        onPressed: _openSupport,
                        style: OutlinedButton.styleFrom(
                          foregroundColor: theme.colorScheme.secondary,
                          side: BorderSide(
                            color: theme.colorScheme.outlineVariant,
                          ),
                          shape: const StadiumBorder(),
                        ),
                        icon: const Icon(
                          Icons.headset_mic_outlined,
                          size: AppSizes.iconSm,
                        ),
                        label: Text(
                          AppLocalization.get(context, 'contact_support'),
                        ),
                      )
                    : TextButton.icon(
                        onPressed: _openSupport,
                        icon: const Icon(
                          Icons.headset_mic_outlined,
                          size: AppSizes.iconSm,
                        ),
                        label: Text(
                          AppLocalization.get(context, 'contact_support'),
                        ),
                      ),
              ),
              const SizedBox(height: AppSpacing.sm),
              _buildLegalLinks(context),
            ],
          ),
        ),
      ),
    );
  }

  /// Privacy policy and terms of use, readable before signing in (creating
  /// an account still asks to agree to each one).
  Widget _buildLegalLinks(BuildContext context) {
    final theme = Theme.of(context);
    final linkStyle = TextButton.styleFrom(
      minimumSize: const Size(48, 48),
      padding: const EdgeInsetsDirectional.symmetric(horizontal: AppSpacing.sm),
      textStyle: theme.textTheme.bodySmall?.copyWith(
        fontWeight: FontWeight.w600,
        decoration: TextDecoration.underline,
      ),
    );
    return Column(
      children: [
        Wrap(
          alignment: WrapAlignment.center,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            TextButton(
              key: const Key('loginPrivacyPolicy'),
              style: linkStyle,
              onPressed: () =>
                  LegalDocumentScreen.open(context, LegalService.privacy),
              child: Text(AppLocalization.get(context, 'privacy_policy')),
            ),
            Text(
              '·',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            TextButton(
              key: const Key('loginTermsOfUse'),
              style: linkStyle,
              onPressed: () =>
                  LegalDocumentScreen.open(context, LegalService.terms),
              child: Text(AppLocalization.get(context, 'terms_of_use')),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildOrDivider(BuildContext context) {
    final theme = Theme.of(context);
    final line = Expanded(
      child: Divider(color: theme.colorScheme.outlineVariant),
    );
    return Row(
      children: [
        line,
        Padding(
          padding: const EdgeInsetsDirectional.symmetric(
            horizontal: AppSpacing.md,
          ),
          child: Text(
            AppLocalization.get(context, 'or_divider'),
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ),
        line,
      ],
    );
  }

  /// Google for the selected role (customer or driver). Existing accounts
  /// sign in; someone new completes phone, governorate, city (and, for a
  /// driver, the services) first.
  Future<void> _continueWithGoogle() async {
    if (_googleLoading) return;
    setState(() => _googleLoading = true);
    try {
      final idToken = await _googleSignIn.signInForIdToken();
      if (idToken == null || !mounted) return;
      final role = _selectedRole;
      final result = await _googleAuthApi.signIn(idToken: idToken, role: role);
      if (!mounted) return;
      var session = result.session;
      if (result.needsProfile) {
        session = await Navigator.of(context).push<Map<String, dynamic>>(
          MaterialPageRoute(
            builder: (_) => GoogleCompleteProfileScreen(
              role: role,
              registrationToken: result.registrationToken!,
              fullName: result.fullName,
              email: result.email,
              api: _googleAuthApi,
            ),
          ),
        );
        if (session == null || !mounted) return;
      }
      // The same path as the email sign-in: home, or "under review".
      context.read<AuthBloc>().add(AuthResponseReceivedEvent(session!));
    } on AuthRequestException catch (error) {
      if (mounted) AppFeedback.error(context, error.message);
    } catch (_) {
      if (mounted) {
        AppFeedback.error(
          context,
          AppLocalization.get(context, 'google_sign_in_failed'),
        );
      }
    } finally {
      if (mounted) setState(() => _googleLoading = false);
    }
  }

  String get selectedRole => _selectedRole;

  InputDecoration _inputDecoration(String label, IconData icon) {
    return InputDecoration(labelText: label, prefixIcon: Icon(icon));
  }

  Future<void> _openPasswordRecovery() async {
    final recoveredEmail = await Navigator.of(context).push<String>(
      MaterialPageRoute(
        builder: (_) =>
            ForgotPasswordScreen(initialEmail: _emailController.text.trim()),
      ),
    );

    if (!mounted || recoveredEmail == null) {
      return;
    }

    _emailController.text = recoveredEmail;
  }

  /// Opens the guest's support conversation if this device has one,
  /// otherwise the form for a new message.
  Future<void> _openSupport() async {
    final thread = await _guestSupport.savedThread();
    if (!mounted) return;
    if (thread == null) {
      _showContactDialog();
      return;
    }
    await _openGuestThread(thread);
  }

  Future<void> _openGuestThread(GuestSupportThread thread) async {
    final startNew = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) =>
            GuestSupportScreen(thread: thread, service: _guestSupport),
      ),
    );
    if (startNew == true && mounted) _showContactDialog();
  }

  void _showContactDialog() {
    final nameCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final msgCtrl = TextEditingController();
    final formKey = GlobalKey<FormState>();
    bool sending = false;

    showDialog(
      context: context,
      builder: (_) => StatefulBuilder(
        builder: (ctx, setDialogState) {
          final theme = Theme.of(ctx);
          final scheme = theme.colorScheme;

          return AlertDialog(
            title: Row(
              children: [
                Icon(Icons.headset_mic_outlined, color: scheme.secondary),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    AppLocalization.get(ctx, 'support_contact_title'),
                  ),
                ),
              ],
            ),
            content: Form(
              key: formKey,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextFormField(
                      controller: nameCtrl,
                      textInputAction: TextInputAction.next,
                      autofillHints: const [AutofillHints.name],
                      decoration: InputDecoration(
                        labelText: AppLocalization.get(ctx, 'name_field'),
                      ),
                      validator: (v) => v == null || v.trim().isEmpty
                          ? AppLocalization.get(ctx, 'required')
                          : null,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextFormField(
                      controller: emailCtrl,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      autofillHints: const [AutofillHints.email],
                      decoration: InputDecoration(
                        labelText: AppLocalization.get(ctx, 'email_field'),
                      ),
                      validator: (v) => v == null || v.trim().isEmpty
                          ? AppLocalization.get(ctx, 'required')
                          : null,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextFormField(
                      controller: phoneCtrl,
                      keyboardType: TextInputType.phone,
                      textInputAction: TextInputAction.next,
                      autofillHints: const [AutofillHints.telephoneNumber],
                      decoration: InputDecoration(
                        labelText: AppLocalization.get(ctx, 'phone_field'),
                      ),
                      validator: (v) => v == null || v.trim().isEmpty
                          ? AppLocalization.get(ctx, 'required')
                          : null,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextFormField(
                      controller: msgCtrl,
                      maxLines: 3,
                      decoration: InputDecoration(
                        labelText: AppLocalization.get(ctx, 'message_field'),
                        hintText: AppLocalization.get(ctx, 'message_hint'),
                      ),
                      validator: (v) => v == null || v.trim().isEmpty
                          ? AppLocalization.get(ctx, 'required')
                          : null,
                    ),
                  ],
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: sending ? null : () => Navigator.pop(ctx),
                child: Text(AppLocalization.get(ctx, 'cancel')),
              ),
              ElevatedButton(
                onPressed: sending
                    ? null
                    : () async {
                        if (!formKey.currentState!.validate()) {
                          return;
                        }

                        setDialogState(() => sending = true);

                        try {
                          final thread = await _guestSupport.start(
                            name: nameCtrl.text.trim(),
                            email: emailCtrl.text.trim(),
                            phone: phoneCtrl.text.trim(),
                            text: msgCtrl.text.trim(),
                          );

                          if (!ctx.mounted) {
                            return;
                          }
                          Navigator.pop(ctx);
                          if (mounted) {
                            AppFeedback.success(
                              context,
                              AppLocalization.get(context, 'contact_success'),
                            );
                            // Our replies from the dashboard show up here.
                            if (thread != null) _openGuestThread(thread);
                          }
                        } catch (_) {
                          if (!ctx.mounted) {
                            return;
                          }
                          setDialogState(() => sending = false);
                          if (mounted) {
                            AppFeedback.error(
                              context,
                              AppLocalization.get(context, 'contact_failed'),
                            );
                          }
                        }
                      },
                child: sending
                    // Same disabled-button pattern as the submit button; onSurface
                    // stays visible against the disabled background (UX01-001).
                    ? const AppButtonLoadingIndicator()
                    : Text(AppLocalization.get(ctx, 'send')),
              ),
            ],
          );
        },
      ),
    );
  }

  void _selectRole(String role) {
    if (_selectedRole == role) {
      return;
    }

    setState(() {
      _selectedRole = role;
    });
  }

  /// A driver's sign-up waits for admin approval. Move to the sign-in form
  /// with the email and password kept, so signing in after approval is one
  /// tap, and say clearly that this is not an error.
  void _showPendingApproval(String message) {
    if (!_isLogin) {
      setState(() {
        _isLogin = true;
        _selectedRole = 'provider';
      });
      _confirmPasswordController.clear();
    }
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        icon: const Icon(Icons.hourglass_top_rounded),
        title: Text(AppLocalization.get(dialogContext, 'account_under_review')),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: Text(AppLocalization.get(dialogContext, 'ok')),
          ),
        ],
      ),
    );
  }

  void _toggleAuthMode() {
    setState(() {
      _isLogin = !_isLogin;
    });

    // The governorate list comes from the server; if the first load failed
    // (e.g. offline at launch), try again when the sign-up form opens.
    if (!_isLogin && _governorates.isEmpty) {
      _loadAreas();
    }

    context.read<AuthBloc>().add(ToggleAuthModeEvent(isLogin: _isLogin));
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;

    final email = _emailController.text.trim();
    final password = _passwordController.text;

    if (_isLogin) {
      context.read<AuthBloc>().add(
        LoginEvent(email: email, password: password, role: _selectedRole),
      );
    } else {
      // Check password match
      if (_confirmPasswordController.text != password) {
        AppFeedback.error(
          context,
          AppLocalization.get(context, 'password_mismatch'),
        );
        return;
      }

      if (_selectedRole == 'provider' && _serviceTypes.isEmpty) {
        AppFeedback.error(
          context,
          AppLocalization.get(context, 'service_type_required'),
        );

        return;
      }

      _showTermsOfService();
    }
  }

  /// Terms of service, then the privacy policy: both must be agreed to
  /// before the account is created. The texts are the ones written in the
  /// dashboard settings (the shipped texts when offline).
  Future<void> _showTermsOfService() async {
    final agreed = await showLegalConsentDialog(
      context,
      // Title is ordinary UI: localized. The body is the legal document.
      title: AppLocalization.get(context, 'legal_terms_title'),
      documentKey: LegalService.terms,
      fallbackText: LegalDefaults.terms,
    );
    if (!mounted) return;
    if (agreed) {
      await _showPrivacyPolicy();
    } else {
      _showRejectDialog();
    }
  }

  Future<void> _showPrivacyPolicy() async {
    final agreed = await showLegalConsentDialog(
      context,
      title: AppLocalization.get(context, 'legal_privacy_title'),
      documentKey: LegalService.privacy,
      fallbackText: LegalDefaults.privacy,
    );
    if (!mounted) return;
    if (agreed) {
      _doRegister();
    } else {
      _showRejectDialog();
    }
  }

  void _showRejectDialog() {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(
          // Ordinary UI text: localized and following the app direction.
          // Only the Arabic legal document bodies above keep static RTL.
          AppLocalization.get(dialogContext, 'reject_terms_title'),
          style: Theme.of(dialogContext).textTheme.titleLarge,
        ),
        content: Text(
          AppLocalization.get(dialogContext, 'reject_terms_body'),
          style: Theme.of(
            dialogContext,
          ).textTheme.bodyMedium?.copyWith(height: 1.5),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: Text(AppLocalization.get(dialogContext, 'ok')),
          ),
        ],
      ),
    );
  }

  void _doRegister() {
    final email = _emailController.text.trim();

    final password = _passwordController.text;

    context.read<AuthBloc>().add(
      RegisterEvent(
        fullName: _nameController.text.trim(),
        email: email,
        phone: Validators.normalizePhone(_phoneController.text),
        password: password,
        role: _selectedRole,
        area: _selectedArea ?? '',
        governorate: _currentGovernorate?.areaValue ?? '',
        serviceTypes: _serviceTypes.toList(),
      ),
    );
  }
}

class _RoleCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final bool isSelected;
  final VoidCallback onTap;

  const _RoleCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final dark = theme.brightness == Brightness.dark;
    // Dark: teal selection; Day: soft gold selection (approved references).
    final background = isSelected
        ? (dark ? scheme.primaryContainer : scheme.secondaryContainer)
        : Colors.transparent;
    final foreground = isSelected
        ? (dark ? scheme.onPrimaryContainer : scheme.onSecondaryContainer)
        : scheme.onSurface;
    final accent = dark ? scheme.primary : scheme.secondary;

    return Semantics(
      selected: isSelected,
      button: true,
      label: '$title. $subtitle',
      onTap: onTap,
      excludeSemantics: true,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(AppRadius.xl),
          border: Border.all(
            color: isSelected ? accent : Colors.transparent,
            width: 1.5,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: accent.withValues(alpha: dark ? 0.25 : 0.18),
                    blurRadius: 16,
                    offset: const Offset(0, 4),
                  ),
                ]
              : null,
        ),
        child: Material(
          type: MaterialType.transparency,
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(AppRadius.xl),
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 64),
              child: Padding(
                padding: const EdgeInsetsDirectional.symmetric(
                  horizontal: AppSpacing.md,
                  vertical: AppSpacing.md,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(icon, size: 26, color: foreground),
                    const SizedBox(width: AppSpacing.sm),
                    Flexible(
                      child: Text(
                        title,
                        style: theme.textTheme.titleMedium?.copyWith(
                          color: foreground,
                          fontWeight: FontWeight.w800,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    // Non-color selection cue (UX01-004).
                    if (isSelected) ...[
                      const SizedBox(width: AppSpacing.sm),
                      Icon(Icons.check_circle, size: 20, color: accent),
                    ],
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
