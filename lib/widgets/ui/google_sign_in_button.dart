import 'package:flutter/material.dart';

import '../../services/localization_service.dart';
import '../../services/theme_service.dart';

/// "Continue with Google", styled per Google's sign-in branding guidelines:
/// the four-colour Google "G" on a white (light) or #131314 (dark) button
/// with the standard outline and text colours.
class GoogleSignInButton extends StatelessWidget {
  final VoidCallback? onPressed;
  final bool loading;

  const GoogleSignInButton({super.key, this.onPressed, this.loading = false});

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final background = dark ? const Color(0xFF131314) : Colors.white;
    final border = dark ? const Color(0xFF8E918F) : const Color(0xFF747775);
    final foreground = dark ? const Color(0xFFE3E3E3) : const Color(0xFF1F1F1F);
    final label = AppLocalization.get(context, 'continue_with_google');

    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: SizedBox(
        height: AppSizes.buttonHeight,
        child: OutlinedButton(
          key: const Key('googleSignInButton'),
          onPressed: loading ? null : onPressed,
          style: OutlinedButton.styleFrom(
            backgroundColor: background,
            foregroundColor: foreground,
            disabledBackgroundColor: background,
            side: BorderSide(color: border),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.pill),
            ),
            padding: const EdgeInsetsDirectional.symmetric(
              horizontal: AppSpacing.lg,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (loading)
                SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: foreground,
                  ),
                )
              else
                const SizedBox(
                  width: 20,
                  height: 20,
                  child: CustomPaint(painter: _GoogleLogoPainter()),
                ),
              const SizedBox(width: AppSpacing.sm + 2),
              Flexible(
                child: Text(
                  label,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: foreground,
                    fontWeight: FontWeight.w500,
                    fontSize: 15,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The Google "G" from Google's published 48×48 sign-in button artwork.
class _GoogleLogoPainter extends CustomPainter {
  const _GoogleLogoPainter();

  static const _parts = <(int, String)>[
    (
      0xFFEA4335,
      'M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 '
          '14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z',
    ),
    (
      0xFF4285F4,
      'M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 '
          '5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z',
    ),
    (
      0xFFFBBC05,
      'M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19'
          'C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z',
    ),
    (
      0xFF34A853,
      'M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 '
          '2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z',
    ),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 48, size.height / 48);
    for (final (color, data) in _parts) {
      canvas.drawPath(svgPath(data), Paint()..color = Color(color));
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(_GoogleLogoPainter oldDelegate) => false;
}

/// A small SVG path reader (M, L, H, V, C, S, Z; absolute and relative),
/// enough for the logo above.
@visibleForTesting
Path svgPath(String data) {
  final tokens = RegExp(
    r'[MmLlHhVvCcSsZz]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?',
  ).allMatches(data).map((m) => m.group(0)!).toList();
  final path = Path();
  var i = 0;
  var command = '';
  var x = 0.0, y = 0.0, startX = 0.0, startY = 0.0;
  double? lastC2x, lastC2y;

  bool isCommand(String token) => RegExp(r'^[A-Za-z]$').hasMatch(token);
  double next() => double.parse(tokens[i++]);

  while (i < tokens.length) {
    if (isCommand(tokens[i])) command = tokens[i++];
    final relative = command == command.toLowerCase();
    final dx = relative ? x : 0.0, dy = relative ? y : 0.0;
    switch (command.toUpperCase()) {
      case 'M':
        x = dx + next();
        y = dy + next();
        path.moveTo(x, y);
        startX = x;
        startY = y;
        command = relative ? 'l' : 'L'; // following pairs are line-tos
        lastC2x = null;
      case 'L':
        x = dx + next();
        y = dy + next();
        path.lineTo(x, y);
        lastC2x = null;
      case 'H':
        x = dx + next();
        path.lineTo(x, y);
        lastC2x = null;
      case 'V':
        y = (relative ? y : 0.0) + next();
        path.lineTo(x, y);
        lastC2x = null;
      case 'C':
        final x1 = dx + next(), y1 = dy + next();
        final x2 = dx + next(), y2 = dy + next();
        x = dx + next();
        y = dy + next();
        path.cubicTo(x1, y1, x2, y2, x, y);
        lastC2x = x2;
        lastC2y = y2;
      case 'S':
        final x1 = lastC2x == null ? x : 2 * x - lastC2x;
        final y1 = lastC2y == null ? y : 2 * y - lastC2y;
        final x2 = dx + next(), y2 = dy + next();
        x = dx + next();
        y = dy + next();
        path.cubicTo(x1, y1, x2, y2, x, y);
        lastC2x = x2;
        lastC2y = y2;
      case 'Z':
        path.close();
        x = startX;
        y = startY;
        lastC2x = null;
      default:
        i++;
    }
  }
  return path;
}
