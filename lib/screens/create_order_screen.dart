import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/order/order_bloc.dart';
import '../bloc/order/order_event.dart';
import '../bloc/order/order_state.dart';
import '../models/user_model.dart';
import '../services/responsive.dart';
import '../services/localization_service.dart';
import '../services/api_config.dart';
import '../services/theme_service.dart';
import '../services/validators.dart';
import '../widgets/brand/swifora_brand.dart';
import '../widgets/ui/app_button_loading_indicator.dart';
import '../widgets/ui/app_feedback.dart';

/// M-CREATE-ORDER (owner-approved layout). Submission is unchanged: one
/// step, the same fields and the same API call. The approved image also
/// shows a review step and photo attachments; those need separate feature
/// approval and are not part of this screen yet.
class CreateOrderScreen extends StatefulWidget {
  final UserModel user;
  final String token;

  const CreateOrderScreen({super.key, required this.user, required this.token});

  @override
  State<CreateOrderScreen> createState() => _CreateOrderScreenState();
}

class _CreateOrderScreenState extends State<CreateOrderScreen> {
  String? _selectedType;
  bool _typeMissing = false;
  final _descController = TextEditingController();
  late final _phoneController = TextEditingController(text: widget.user.phone);
  final _locationController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _descController.dispose();
    _phoneController.dispose();
    _locationController.dispose();
    super.dispose();
  }

  void _selectType(String type) {
    setState(() {
      _selectedType = type;
      _typeMissing = false;
    });
  }

  String get _descriptionLabel => switch (_selectedType) {
    'product' => AppLocalization.get(context, 'product_label'),
    'people' => AppLocalization.get(context, 'people_label'),
    'goods' => AppLocalization.get(context, 'goods_label'),
    _ => AppLocalization.get(context, 'order_description_label'),
  };

  void _showInfo() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) {
        final theme = Theme.of(sheetContext);
        return SafeArea(
          child: Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(
              AppSpacing.xl,
              0,
              AppSpacing.xl,
              AppSpacing.xl,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  AppLocalization.get(sheetContext, 'new_order'),
                  style: theme.textTheme.titleLarge,
                ),
                const SizedBox(height: AppSpacing.md),
                for (final key in const [
                  'order_reaches_drivers',
                  'clearer_description_helper',
                  'phone_hint',
                ])
                  Padding(
                    padding: const EdgeInsetsDirectional.only(
                      bottom: AppSpacing.sm,
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          Icons.check_circle_outline,
                          size: AppSizes.iconSm,
                          color: theme.colorScheme.primary,
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: Text(
                            AppLocalization.get(sheetContext, key),
                            style: theme.textTheme.bodyLarge,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _fieldLabel(BuildContext context, String text) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsetsDirectional.only(
        bottom: AppSpacing.sm,
        top: AppSpacing.lg,
      ),
      child: Text.rich(
        TextSpan(
          text: text,
          children: [
            TextSpan(
              text: ' *',
              style: TextStyle(color: theme.colorScheme.secondary),
            ),
          ],
        ),
        style: theme.textTheme.titleSmall?.copyWith(
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;

    return Scaffold(
      // No AppBar: the top inset is handled here, the bottom inset (gesture
      // bar) by the inner SafeArea.
      body: SafeArea(
        bottom: false,
        child: SafeArea(
          top: false,
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 600),
              child: SingleChildScrollView(
                padding: EdgeInsets.symmetric(
                  horizontal: Responsive.paddingHorizontal(context),
                  vertical: Responsive.paddingVertical(context),
                ),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          SwiforaRoundButton(
                            tooltip: MaterialLocalizations.of(
                              context,
                            ).backButtonTooltip,
                            onPressed: () => Navigator.maybePop(context),
                            child: const Icon(Icons.arrow_back_rounded),
                          ),
                          Expanded(
                            child: Semantics(
                              header: true,
                              child: Text(
                                AppLocalization.get(context, 'new_order'),
                                textAlign: TextAlign.center,
                                style: theme.textTheme.headlineSmall?.copyWith(
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ),
                          ),
                          SwiforaRoundButton(
                            tooltip: AppLocalization.get(
                              context,
                              'order_reaches_drivers',
                            ),
                            onPressed: _showInfo,
                            child: Icon(
                              Icons.info_outline_rounded,
                              color: scheme.primary,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.xl),
                      Text(
                        AppLocalization.get(context, 'what_to_deliver'),
                        style: theme.textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: _OptionCard(
                              icon: Icons.inventory_2_outlined,
                              label: AppLocalization.get(context, 'product'),
                              isSelected: _selectedType == 'product',
                              onTap: () => _selectType('product'),
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: _OptionCard(
                              icon: Icons.people_outline,
                              label: AppLocalization.get(context, 'people'),
                              isSelected: _selectedType == 'people',
                              onTap: () => _selectType('people'),
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: _OptionCard(
                              icon: Icons.local_shipping_outlined,
                              label: AppLocalization.get(context, 'goods'),
                              isSelected: _selectedType == 'goods',
                              onTap: () => _selectType('goods'),
                            ),
                          ),
                        ],
                      ),
                      if (_typeMissing)
                        Padding(
                          padding: const EdgeInsetsDirectional.only(
                            top: AppSpacing.sm,
                          ),
                          child: Text(
                            AppLocalization.get(context, 'what_to_deliver'),
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: scheme.error,
                            ),
                          ),
                        ),
                      _fieldLabel(context, _descriptionLabel),
                      TextFormField(
                        controller: _descController,
                        minLines: 3,
                        maxLines: 5,
                        // Same limit as the server (orders.js).
                        maxLength: 2000,
                        decoration: InputDecoration(
                          alignLabelWithHint: true,
                          hintText: AppLocalization.get(
                            context,
                            'order_description_hint',
                          ),
                          hintMaxLines: 3,
                          prefixIcon: const Padding(
                            padding: EdgeInsetsDirectional.only(bottom: 48),
                            child: Icon(Icons.assignment_outlined),
                          ),
                        ),
                        validator: (v) => v == null || v.trim().isEmpty
                            ? AppLocalization.get(context, 'required')
                            : null,
                      ),
                      _fieldLabel(
                        context,
                        AppLocalization.get(context, 'delivery_location_label'),
                      ),
                      TextFormField(
                        controller: _locationController,
                        decoration: InputDecoration(
                          hintText: AppLocalization.get(
                            context,
                            'delivery_location_hint',
                          ),
                          prefixIcon: const Icon(Icons.location_on_outlined),
                        ),
                        maxLines: 2,
                        minLines: 1,
                        maxLength: 500,
                        validator: (v) => v == null || v.trim().isEmpty
                            ? AppLocalization.get(context, 'required')
                            : null,
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        AppLocalization.get(
                          context,
                          'clearer_description_helper',
                        ),
                        style: theme.textTheme.bodySmall,
                      ),
                      _fieldLabel(
                        context,
                        AppLocalization.get(context, 'contact_phone_label'),
                      ),
                      TextFormField(
                        controller: _phoneController,
                        decoration: InputDecoration(
                          hintText: '05x xxx xxxx',
                          helperText: AppLocalization.get(
                            context,
                            'phone_hint',
                          ),
                          helperMaxLines: 2,
                          errorMaxLines: 3,
                          prefixIcon: const Icon(Icons.phone_outlined),
                        ),
                        keyboardType: TextInputType.phone,
                        textDirection: TextDirection.ltr,
                        autofillHints: const [AutofillHints.telephoneNumber],
                        maxLength: 20,
                        // The driver calls this number: a real mobile only.
                        validator: (v) {
                          if (v == null || v.trim().isEmpty) {
                            return AppLocalization.get(context, 'required');
                          }
                          return Validators.isValidPhone(v)
                              ? null
                              : AppLocalization.get(
                                  context,
                                  'phone_invalid_hint',
                                );
                        },
                      ),
                      const SizedBox(height: AppSpacing.xl),
                      BlocConsumer<OrderBloc, OrderState>(
                        listener: (context, state) {
                          if (state is OrderSuccess) {
                            AppFeedback.success(
                              context,
                              AppLocalization.get(context, 'order_sent'),
                            );
                            Navigator.pop(context);
                          }
                          if (state is OrderError) {
                            AppFeedback.error(context, state.message);
                          }
                        },
                        builder: (context, state) {
                          final isLoading = state is OrderLoading;
                          return ElevatedButton(
                            key: const Key('submitOrderButton'),
                            onPressed: isLoading ? null : _submit,
                            child: isLoading
                                ? const AppButtonLoadingIndicator()
                                : Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Flexible(
                                        child: Text(
                                          AppLocalization.get(
                                            context,
                                            'submit_order',
                                          ),
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      const SizedBox(width: AppSpacing.sm),
                                      const Icon(
                                        Icons.send_rounded,
                                        size: AppSizes.iconMd,
                                      ),
                                    ],
                                  ),
                          );
                        },
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        AppLocalization.get(context, 'order_reaches_drivers'),
                        textAlign: TextAlign.center,
                        style: theme.textTheme.bodySmall,
                      ),
                      const SizedBox(height: AppSpacing.lg),
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

  Future<void> _submit() async {
    final typeChosen = _selectedType != null;
    final formValid = _formKey.currentState!.validate();
    if (!typeChosen) {
      setState(() => _typeMissing = true);
    }
    if (!typeChosen || !formValid) return;

    context.read<OrderBloc>().add(
      CreateOrderEvent(
        token: widget.token,
        type: _selectedType!,
        description: _descController.text.trim(),
        phone: Validators.normalizePhone(_phoneController.text),
        area: ApiConfig.detectedArea,
        location: _locationController.text.trim(),
      ),
    );
  }
}

/// One order type: icon, text and a check when selected (not colour only).
class _OptionCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _OptionCard({
    required this.icon,
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final foreground = isSelected ? scheme.primary : scheme.onSurface;

    return Semantics(
      button: true,
      selected: isSelected,
      label: label,
      excludeSemantics: true,
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        decoration: BoxDecoration(
          color: isSelected
              ? scheme.primaryContainer.withValues(alpha: 0.7)
              : scheme.surfaceContainerLow,
          borderRadius: BorderRadius.circular(AppRadius.xl),
          border: Border.all(
            color: isSelected ? scheme.primary : scheme.outlineVariant,
            width: isSelected ? 2 : 1,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: scheme.primary.withValues(alpha: 0.18),
                    blurRadius: 14,
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
              constraints: const BoxConstraints(minHeight: 112),
              child: Stack(
                children: [
                  if (isSelected)
                    PositionedDirectional(
                      top: AppSpacing.sm,
                      end: AppSpacing.sm,
                      child: Icon(
                        Icons.check_circle,
                        size: AppSizes.iconSm,
                        color: scheme.primary,
                      ),
                    ),
                  Padding(
                    padding: const EdgeInsetsDirectional.symmetric(
                      vertical: AppSpacing.lg,
                      horizontal: AppSpacing.sm,
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(icon, color: foreground, size: 30),
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          label,
                          textAlign: TextAlign.center,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.labelLarge?.copyWith(
                            color: foreground,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
