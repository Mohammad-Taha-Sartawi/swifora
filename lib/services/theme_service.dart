import 'package:flutter/material.dart';

/// Core brand and semantic colors.
///
/// Owner-approved Swifora Delivery language (2026-11-14): Dark Mode is a
/// midnight navy with teal/cyan actions and restrained warm gold; Day Mode is
/// a warm off-white with navy text, teal actions and soft gold highlights.
/// Values follow `.claude/skills/swifora-ui-ux/references/design-system.md`,
/// adjusted where needed for WCAG AA contrast (Day primary is a deeper teal
/// so white labels stay readable).
///
/// Components should prefer semantic [ColorScheme] roles or
/// [AppSemanticColors] instead of referencing these constants directly.
abstract final class AppColors {
  static const primary = Color(0xFF00838F);
  static const primaryLight = Color(0xFF00A8B8);
  static const primaryDark = Color(0xFF10273B);
  static const accent = Color(0xFFC8872C);
  static const accentStrong = Color(0xFF9A6416);

  static const lightBackground = Color(0xFFF8F8F5);
  static const lightSurface = Color(0xFFFFFFFF);
  static const lightSurfaceMuted = Color(0xFFF1F5F5);
  static const lightOutline = Color(0xFFD7E2E6);
  static const lightTextPrimary = Color(0xFF10273B);
  static const lightTextSecondary = Color(0xFF526B7B);

  static const darkBackground = Color(0xFF061624);
  static const darkSurface = Color(0xFF102838);
  static const darkSurfaceMuted = Color(0xFF173342);
  static const darkOutline = Color(0xFF345366);
  static const darkTextPrimary = Color(0xFFF5FAFC);
  static const darkTextSecondary = Color(0xFFB3C8D2);
  static const darkPrimary = Color(0xFF0BCBD0);
  static const darkAccent = Color(0xFFE9B35B);

  static const success = Color(0xFF17704C);
  static const successContainer = Color(0xFFDDF4E9);
  static const onSuccessContainer = Color(0xFF00301D);
  static const warning = Color(0xFF8A5A10);
  static const warningContainer = Color(0xFFFCEFD6);
  static const onWarningContainer = Color(0xFF3D2600);
  static const error = Color(0xFFB3261E);
  static const errorContainer = Color(0xFFFFDAD6);
  static const onErrorContainer = Color(0xFF410002);
  static const info = Color(0xFF00727D);
  static const infoContainer = Color(0xFFDDF4F6);
  static const onInfoContainer = Color(0xFF00363C);
  static const neutral = Color(0xFF526B7B);
  static const neutralContainer = Color(0xFFEDF2F3);
  static const onNeutralContainer = Color(0xFF10273B);

  static const darkSuccess = Color(0xFF4FD9A0);
  static const darkSuccessContainer = Color(0xFF0E3A2B);
  static const darkOnSuccessContainer = Color(0xFFC2F5DE);
  static const darkWarning = Color(0xFFF2C06E);
  static const darkWarningContainer = Color(0xFF3B2C14);
  static const darkOnWarningContainer = Color(0xFFFFE2B0);
  static const darkError = Color(0xFFFFB4AB);
  static const darkErrorContainer = Color(0xFF5C1714);
  static const darkOnErrorContainer = Color(0xFFFFDAD6);
  static const darkInfo = Color(0xFF6FE3E6);
  static const darkInfoContainer = Color(0xFF0B3F4B);
  static const darkOnInfoContainer = Color(0xFFC4F5F6);
  static const darkNeutral = Color(0xFFB3C8D2);
  static const darkNeutralContainer = Color(0xFF1D3B4C);
  static const darkOnNeutralContainer = Color(0xFFE3EEF2);

  // Compatibility aliases for older code.
  static const surface = lightBackground;
  static const cardLight = lightSurface;
  static const textPrimary = lightTextPrimary;
  static const textSecondary = lightTextSecondary;
  static const divider = lightOutline;
  static const darkBg = darkBackground;
  static const darkCard = darkSurfaceMuted;
  static const darkText = darkTextPrimary;
}

/// A compact, reusable spacing scale (logical pixels).
abstract final class AppSpacing {
  static const double xxs = 2;
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
  static const double xxl = 32;
  static const double xxxl = 40;
  static const double huge = 48;

  static const gapXs = SizedBox(width: xs, height: xs);
  static const gapSm = SizedBox(width: sm, height: sm);
  static const gapMd = SizedBox(width: md, height: md);
  static const gapLg = SizedBox(width: lg, height: lg);
  static const gapXl = SizedBox(width: xl, height: xl);
}

/// Shared corner radii.
abstract final class AppRadius {
  static const double xs = 8;
  static const double sm = 10;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 24;
  static const double pill = 999;

  static const borderRadiusSm = BorderRadius.all(Radius.circular(sm));
  static const borderRadiusMd = BorderRadius.all(Radius.circular(md));
  static const borderRadiusLg = BorderRadius.all(Radius.circular(lg));
  static const borderRadiusXl = BorderRadius.all(Radius.circular(xl));
  static const borderRadiusPill = BorderRadius.all(Radius.circular(pill));
}

/// Standard component dimensions.
abstract final class AppSizes {
  static const double minTouchTarget = 48;
  static const double buttonHeight = 56;
  static const double inputHeight = 56;
  static const double iconSm = 18;
  static const double iconMd = 22;
  static const double iconLg = 28;
  static const double avatarSm = 36;
  static const double avatarMd = 44;

  static const double authMaxWidth = 560;
  static const double contentMaxWidth = 1040;
  static const double wideBreakpoint = 840;
}

abstract final class AppElevation {
  static const double none = 0;
  static const double low = 1;
  static const double medium = 2;
}

/// Theme-aware semantic colors that are not covered by Material's ColorScheme.
@immutable
class AppSemanticColors extends ThemeExtension<AppSemanticColors> {
  const AppSemanticColors({
    required this.success,
    required this.onSuccess,
    required this.successContainer,
    required this.onSuccessContainer,
    required this.warning,
    required this.onWarning,
    required this.warningContainer,
    required this.onWarningContainer,
    required this.info,
    required this.onInfo,
    required this.infoContainer,
    required this.onInfoContainer,
    required this.neutral,
    required this.onNeutral,
    required this.neutralContainer,
    required this.onNeutralContainer,
  });

  final Color success;
  final Color onSuccess;
  final Color successContainer;
  final Color onSuccessContainer;
  final Color warning;
  final Color onWarning;
  final Color warningContainer;
  final Color onWarningContainer;
  final Color info;
  final Color onInfo;
  final Color infoContainer;
  final Color onInfoContainer;
  final Color neutral;
  final Color onNeutral;
  final Color neutralContainer;
  final Color onNeutralContainer;

  static AppSemanticColors of(BuildContext context) {
    final semantics = Theme.of(context).extension<AppSemanticColors>();
    if (semantics != null) {
      return semantics;
    }

    return Theme.of(context).brightness == Brightness.dark
        ? AppSemanticColors.dark
        : AppSemanticColors.light;
  }

  static const light = AppSemanticColors(
    success: AppColors.success,
    onSuccess: Colors.white,
    successContainer: AppColors.successContainer,
    onSuccessContainer: AppColors.onSuccessContainer,
    warning: AppColors.warning,
    onWarning: Colors.white,
    warningContainer: AppColors.warningContainer,
    onWarningContainer: AppColors.onWarningContainer,
    info: AppColors.info,
    onInfo: Colors.white,
    infoContainer: AppColors.infoContainer,
    onInfoContainer: AppColors.onInfoContainer,
    neutral: AppColors.neutral,
    onNeutral: Colors.white,
    neutralContainer: AppColors.neutralContainer,
    onNeutralContainer: AppColors.onNeutralContainer,
  );

  static const dark = AppSemanticColors(
    success: AppColors.darkSuccess,
    onSuccess: Color(0xFF00391F),
    successContainer: AppColors.darkSuccessContainer,
    onSuccessContainer: AppColors.darkOnSuccessContainer,
    warning: AppColors.darkWarning,
    onWarning: Color(0xFF3A2600),
    warningContainer: AppColors.darkWarningContainer,
    onWarningContainer: AppColors.darkOnWarningContainer,
    info: AppColors.darkInfo,
    onInfo: Color(0xFF002530),
    infoContainer: AppColors.darkInfoContainer,
    onInfoContainer: AppColors.darkOnInfoContainer,
    neutral: AppColors.darkNeutral,
    onNeutral: Color(0xFF061624),
    neutralContainer: AppColors.darkNeutralContainer,
    onNeutralContainer: AppColors.darkOnNeutralContainer,
  );

  @override
  AppSemanticColors copyWith({
    Color? success,
    Color? onSuccess,
    Color? successContainer,
    Color? onSuccessContainer,
    Color? warning,
    Color? onWarning,
    Color? warningContainer,
    Color? onWarningContainer,
    Color? info,
    Color? onInfo,
    Color? infoContainer,
    Color? onInfoContainer,
    Color? neutral,
    Color? onNeutral,
    Color? neutralContainer,
    Color? onNeutralContainer,
  }) {
    return AppSemanticColors(
      success: success ?? this.success,
      onSuccess: onSuccess ?? this.onSuccess,
      successContainer: successContainer ?? this.successContainer,
      onSuccessContainer: onSuccessContainer ?? this.onSuccessContainer,
      warning: warning ?? this.warning,
      onWarning: onWarning ?? this.onWarning,
      warningContainer: warningContainer ?? this.warningContainer,
      onWarningContainer: onWarningContainer ?? this.onWarningContainer,
      info: info ?? this.info,
      onInfo: onInfo ?? this.onInfo,
      infoContainer: infoContainer ?? this.infoContainer,
      onInfoContainer: onInfoContainer ?? this.onInfoContainer,
      neutral: neutral ?? this.neutral,
      onNeutral: onNeutral ?? this.onNeutral,
      neutralContainer: neutralContainer ?? this.neutralContainer,
      onNeutralContainer: onNeutralContainer ?? this.onNeutralContainer,
    );
  }

  @override
  AppSemanticColors lerp(AppSemanticColors? other, double t) {
    if (other == null) {
      return this;
    }

    return AppSemanticColors(
      success: Color.lerp(success, other.success, t)!,
      onSuccess: Color.lerp(onSuccess, other.onSuccess, t)!,
      successContainer: Color.lerp(
        successContainer,
        other.successContainer,
        t,
      )!,
      onSuccessContainer: Color.lerp(
        onSuccessContainer,
        other.onSuccessContainer,
        t,
      )!,
      warning: Color.lerp(warning, other.warning, t)!,
      onWarning: Color.lerp(onWarning, other.onWarning, t)!,
      warningContainer: Color.lerp(
        warningContainer,
        other.warningContainer,
        t,
      )!,
      onWarningContainer: Color.lerp(
        onWarningContainer,
        other.onWarningContainer,
        t,
      )!,
      info: Color.lerp(info, other.info, t)!,
      onInfo: Color.lerp(onInfo, other.onInfo, t)!,
      infoContainer: Color.lerp(infoContainer, other.infoContainer, t)!,
      onInfoContainer: Color.lerp(onInfoContainer, other.onInfoContainer, t)!,
      neutral: Color.lerp(neutral, other.neutral, t)!,
      onNeutral: Color.lerp(onNeutral, other.onNeutral, t)!,
      neutralContainer: Color.lerp(
        neutralContainer,
        other.neutralContainer,
        t,
      )!,
      onNeutralContainer: Color.lerp(
        onNeutralContainer,
        other.onNeutralContainer,
        t,
      )!,
    );
  }
}

class AppTheme {
  static final ThemeData light = _build(Brightness.light);
  static final ThemeData dark = _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final isDark = brightness == Brightness.dark;
    final scheme = _scheme(brightness);
    final textTheme = _textTheme(scheme);
    final semantics = isDark ? AppSemanticColors.dark : AppSemanticColors.light;

    final base = ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor: scheme.surface,
      canvasColor: scheme.surface,
      cardColor: scheme.surfaceContainerLow,
      dividerColor: scheme.outlineVariant,
      textTheme: textTheme,
      extensions: [semantics],
    );

    return base.copyWith(
      primaryColor: scheme.primary,
      appBarTheme: AppBarTheme(
        backgroundColor: scheme.surface,
        foregroundColor: scheme.onSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 1,
        centerTitle: true,
        titleTextStyle: textTheme.titleLarge?.copyWith(color: scheme.onSurface),
        iconTheme: IconThemeData(color: scheme.onSurfaceVariant),
        actionsIconTheme: IconThemeData(color: scheme.onSurfaceVariant),
      ),
      cardTheme: CardThemeData(
        elevation: AppElevation.low,
        color: scheme.surfaceContainerLow,
        surfaceTintColor: Colors.transparent,
        shadowColor: scheme.shadow.withValues(alpha: isDark ? 0.35 : 0.08),
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadiusDirectional.all(
            const Radius.circular(AppRadius.xxl),
          ),
          side: BorderSide(color: scheme.outlineVariant),
        ),
        clipBehavior: Clip.antiAlias,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          minimumSize: const Size(0, AppSizes.buttonHeight),
          foregroundColor: scheme.onPrimary,
          backgroundColor: scheme.primary,
          disabledForegroundColor: scheme.onSurface.withValues(alpha: 0.38),
          disabledBackgroundColor: scheme.onSurface.withValues(alpha: 0.12),
          elevation: AppElevation.none,
          padding: const EdgeInsetsDirectional.symmetric(
            horizontal: AppSpacing.xl,
            vertical: AppSpacing.md,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.xl),
          ),
          textStyle: textTheme.labelLarge?.copyWith(
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(0, AppSizes.buttonHeight),
          foregroundColor: scheme.primary,
          side: BorderSide(color: scheme.outline),
          padding: const EdgeInsetsDirectional.symmetric(
            horizontal: AppSpacing.xl,
            vertical: AppSpacing.md,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.xl),
          ),
          textStyle: textTheme.labelLarge?.copyWith(fontSize: 15),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          minimumSize: const Size(0, AppSizes.minTouchTarget),
          foregroundColor: scheme.primary,
          padding: const EdgeInsetsDirectional.symmetric(
            horizontal: AppSpacing.lg,
            vertical: AppSpacing.sm,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadiusDirectional.circular(AppRadius.sm),
          ),
          textStyle: textTheme.labelLarge,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: scheme.surfaceContainerLowest,
        contentPadding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.lg,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          borderSide: BorderSide(color: scheme.outlineVariant),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          borderSide: BorderSide(color: scheme.outlineVariant),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          borderSide: BorderSide(color: scheme.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          borderSide: BorderSide(color: scheme.error, width: 1.5),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          borderSide: BorderSide(color: scheme.error, width: 2),
        ),
        labelStyle: textTheme.bodyMedium?.copyWith(
          color: scheme.onSurfaceVariant,
        ),
        floatingLabelStyle: textTheme.bodySmall?.copyWith(
          color: scheme.primary,
        ),
        hintStyle: textTheme.bodyMedium?.copyWith(
          color: scheme.onSurfaceVariant,
        ),
        prefixIconColor: scheme.onSurfaceVariant,
        suffixIconColor: scheme.onSurfaceVariant,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: scheme.surfaceContainerHigh,
        surfaceTintColor: Colors.transparent,
        elevation: AppElevation.medium,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadiusDirectional.circular(AppRadius.xxl),
        ),
        titleTextStyle: textTheme.titleLarge,
        contentTextStyle: textTheme.bodyLarge,
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: scheme.surfaceContainerLow,
        modalBackgroundColor: scheme.surfaceContainerLow,
        surfaceTintColor: Colors.transparent,
        showDragHandle: true,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadiusDirectional.vertical(
            top: Radius.circular(AppRadius.xxl),
          ),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: scheme.inverseSurface,
        contentTextStyle: textTheme.bodyMedium?.copyWith(
          color: scheme.onInverseSurface,
        ),
        actionTextColor: scheme.inversePrimary,
        elevation: AppElevation.medium,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
        ),
        insetPadding: const EdgeInsets.all(AppSpacing.lg),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: scheme.surfaceContainer,
        selectedColor: scheme.primaryContainer,
        secondarySelectedColor: scheme.secondaryContainer,
        disabledColor: scheme.onSurface.withValues(alpha: 0.08),
        side: BorderSide(color: scheme.outlineVariant),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadiusDirectional.circular(AppRadius.pill),
        ),
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        labelStyle: textTheme.bodyMedium?.copyWith(color: scheme.onSurface),
        secondaryLabelStyle: textTheme.bodyMedium?.copyWith(
          color: scheme.onPrimaryContainer,
        ),
        showCheckmark: true,
        checkmarkColor: scheme.primary,
      ),
      dividerTheme: DividerThemeData(
        color: scheme.outlineVariant,
        thickness: 1,
        space: 1,
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: scheme.primary,
        linearTrackColor: scheme.surfaceContainerHighest,
        circularTrackColor: scheme.surfaceContainerHighest,
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: scheme.primaryContainer,
        foregroundColor: scheme.onPrimaryContainer,
        elevation: AppElevation.low,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadiusDirectional.circular(AppRadius.lg),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 72,
        backgroundColor: scheme.surfaceContainerLow,
        surfaceTintColor: Colors.transparent,
        indicatorColor: scheme.primaryContainer,
        indicatorShape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
        ),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return textTheme.labelMedium?.copyWith(
            color: selected ? scheme.primary : scheme.onSurfaceVariant,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          return IconThemeData(
            color: states.contains(WidgetState.selected)
                ? scheme.primary
                : scheme.onSurfaceVariant,
          );
        }),
      ),
      iconTheme: IconThemeData(color: scheme.onSurfaceVariant),
      listTileTheme: ListTileThemeData(
        iconColor: scheme.onSurfaceVariant,
        textColor: scheme.onSurface,
        contentPadding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.xs,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
        ),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return scheme.onPrimary;
          }
          return scheme.outline;
        }),
        trackColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return scheme.primary;
          }
          return scheme.surfaceContainerHighest;
        }),
        trackOutlineColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return scheme.primary;
          }
          return scheme.outline;
        }),
      ),
      tooltipTheme: TooltipThemeData(
        waitDuration: const Duration(milliseconds: 400),
        decoration: BoxDecoration(
          color: scheme.inverseSurface,
          borderRadius: BorderRadiusDirectional.circular(AppRadius.sm),
        ),
        textStyle: textTheme.bodySmall?.copyWith(
          color: scheme.onInverseSurface,
        ),
      ),
      textSelectionTheme: TextSelectionThemeData(
        cursorColor: scheme.primary,
        selectionColor: scheme.primary.withValues(alpha: 0.22),
        selectionHandleColor: scheme.primary,
      ),
      focusColor: scheme.primary.withValues(alpha: 0.12),
      splashColor: scheme.primary.withValues(alpha: 0.08),
      highlightColor: scheme.primary.withValues(alpha: 0.06),
    );
  }

  static ColorScheme _scheme(Brightness brightness) {
    final isDark = brightness == Brightness.dark;

    if (isDark) {
      return ColorScheme.fromSeed(
        seedColor: AppColors.darkPrimary,
        brightness: Brightness.dark,
      ).copyWith(
        primary: AppColors.darkPrimary,
        onPrimary: const Color(0xFF002530),
        primaryContainer: const Color(0xFF0B3F4B),
        onPrimaryContainer: const Color(0xFFB4F4F6),
        secondary: AppColors.darkAccent,
        onSecondary: const Color(0xFF3A2600),
        secondaryContainer: const Color(0xFF3B2D16),
        onSecondaryContainer: const Color(0xFFFFE2B0),
        tertiary: AppColors.darkSuccess,
        onTertiary: const Color(0xFF00391F),
        tertiaryContainer: AppColors.darkSuccessContainer,
        onTertiaryContainer: AppColors.darkOnSuccessContainer,
        error: AppColors.darkError,
        onError: const Color(0xFF690005),
        errorContainer: AppColors.darkErrorContainer,
        onErrorContainer: AppColors.darkOnErrorContainer,
        surface: AppColors.darkBackground,
        onSurface: AppColors.darkTextPrimary,
        onSurfaceVariant: AppColors.darkTextSecondary,
        surfaceContainerLowest: const Color(0xFF0A1F2F),
        surfaceContainerLow: AppColors.darkSurface,
        surfaceContainer: AppColors.darkSurfaceMuted,
        surfaceContainerHigh: const Color(0xFF1D3B4C),
        surfaceContainerHighest: const Color(0xFF24475A),
        outline: AppColors.darkOutline,
        outlineVariant: const Color(0xFF23404F),
        inverseSurface: const Color(0xFFE6F0F3),
        onInverseSurface: AppColors.lightTextPrimary,
        inversePrimary: AppColors.primary,
        shadow: Colors.black,
        scrim: Colors.black,
      );
    }

    return ColorScheme.fromSeed(
      seedColor: AppColors.primary,
      brightness: Brightness.light,
    ).copyWith(
      primary: AppColors.primary,
      onPrimary: Colors.white,
      primaryContainer: const Color(0xFFD8F4F6),
      onPrimaryContainer: const Color(0xFF00363C),
      secondary: AppColors.accentStrong,
      onSecondary: Colors.white,
      secondaryContainer: const Color(0xFFFCEBC9),
      onSecondaryContainer: const Color(0xFF3D2600),
      tertiary: AppColors.success,
      onTertiary: Colors.white,
      tertiaryContainer: AppColors.successContainer,
      onTertiaryContainer: AppColors.onSuccessContainer,
      error: AppColors.error,
      onError: Colors.white,
      errorContainer: AppColors.errorContainer,
      onErrorContainer: AppColors.onErrorContainer,
      surface: AppColors.lightBackground,
      onSurface: AppColors.lightTextPrimary,
      onSurfaceVariant: AppColors.lightTextSecondary,
      surfaceContainerLowest: AppColors.lightSurface,
      surfaceContainerLow: AppColors.lightSurface,
      surfaceContainer: AppColors.lightSurfaceMuted,
      surfaceContainerHigh: const Color(0xFFE9F0F1),
      surfaceContainerHighest: const Color(0xFFDFE8EA),
      outline: const Color(0xFF7D93A0),
      outlineVariant: AppColors.lightOutline,
      inverseSurface: AppColors.lightTextPrimary,
      onInverseSurface: const Color(0xFFEEF5F7),
      inversePrimary: AppColors.darkPrimary,
      shadow: const Color(0xFF10273B),
      scrim: Colors.black,
    );
  }

  static TextTheme _textTheme(ColorScheme scheme) {
    final base = Typography.material2021().black.apply(
      bodyColor: scheme.onSurface,
      displayColor: scheme.onSurface,
    );

    return base.copyWith(
      displaySmall: base.displaySmall?.copyWith(
        fontSize: 32,
        height: 1.2,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.4,
      ),
      headlineLarge: base.headlineLarge?.copyWith(
        fontSize: 28,
        height: 1.2,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.3,
      ),
      headlineMedium: base.headlineMedium?.copyWith(
        fontSize: 24,
        height: 1.25,
        fontWeight: FontWeight.w700,
      ),
      headlineSmall: base.headlineSmall?.copyWith(
        fontSize: 21,
        height: 1.3,
        fontWeight: FontWeight.w600,
      ),
      titleLarge: base.titleLarge?.copyWith(
        fontSize: 19,
        height: 1.35,
        fontWeight: FontWeight.w600,
      ),
      titleMedium: base.titleMedium?.copyWith(
        fontSize: 16,
        height: 1.4,
        fontWeight: FontWeight.w600,
      ),
      titleSmall: base.titleSmall?.copyWith(
        fontSize: 14,
        height: 1.4,
        fontWeight: FontWeight.w600,
      ),
      bodyLarge: base.bodyLarge?.copyWith(fontSize: 16, height: 1.6),
      bodyMedium: base.bodyMedium?.copyWith(
        fontSize: 14,
        height: 1.5,
        color: scheme.onSurfaceVariant,
      ),
      bodySmall: base.bodySmall?.copyWith(
        fontSize: 12,
        height: 1.45,
        color: scheme.onSurfaceVariant,
      ),
      labelLarge: base.labelLarge?.copyWith(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        height: 1.3,
      ),
      labelMedium: base.labelMedium?.copyWith(
        fontSize: 12,
        fontWeight: FontWeight.w500,
        height: 1.3,
        color: scheme.onSurfaceVariant,
      ),
      labelSmall: base.labelSmall?.copyWith(
        fontSize: 11,
        fontWeight: FontWeight.w500,
        height: 1.3,
        color: scheme.onSurfaceVariant,
      ),
    );
  }
}
