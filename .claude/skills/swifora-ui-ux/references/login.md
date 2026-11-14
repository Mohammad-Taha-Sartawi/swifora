# M-LOGIN — Login / Role Selection

**Approved** reference assets: `assets/approved/login-dark.png` and `assets/approved/login-day.png`.

## Intended hierarchy

1. Language switch Arabic/English, anchored in safe header area.
2. Delivery-oriented Swifora branding (speed/parcel S mark concept, Arabic + English wordmark). Dark uses a cinematic navy/cyan route motif; Day uses a quiet warm-white/gold city/map motif.
3. Role selector `زبون` / `سائق` (English `Customer` / `Driver`), clear selected state with text, icon and check; preserve the role sent to auth.
4. Email and password with validation and show/hide password; recovery link.
5. Large primary `تسجيل الدخول` (`Sign in`) action; loading/error/disabled feedback; no double-submit.
6. Google login and Apple login **design** as clearly separated provider actions; Apple available on iOS where supported. These require verified OAuth backend/integration and account-linking flows before implementation; do not hardcode fake success or send passwords to provider endpoints.
7. New-account link and support contact discoverable before authentication.
8. Optional biometric quick sign-in is only explicitly pictured in the *rejected* third concept; **not part of approved scope**. Never add solely on that basis.

## UX and security details

- Role switching cannot discard typed data unexpectedly; explicitly decide how role-specific eligibility should be handled.
- Ensure email/password sign-in remains usable if Google/Apple not configured. If requested to implement social auth, make a separate technical plan covering iOS entitlement, service IDs, identity token validation on backend, account linking, existing users, errors, revoked access and logout.
- Keyboard/IME email and password appropriate, password autofill, password manager, autofocus strategy, `TextInputAction`, focus traversal and error announcements.
- Distinguish invalid credentials, incorrect role, suspended account, provider pending review and backend unavailable; do not leak sensitive security details.
- Login visuals are more decorative than downstream utility screens; preserve scrolling and accessibility at 320–390 dp widths and larger accessibility fonts.
- Signup is an existing distinct form/flow, **not yet visually approved**. Make only essential changes to keep login links and global theme functional, and propose a design before a full signup redesign.

## Existing file mapping to verify

- `lib/screens/login_screen.dart`
- `lib/bloc/auth/` and auth service
- `lib/services/localization_service.dart`, `lib/services/theme_service.dart`
- `test/` login/auth/widget tests

## Acceptance tests

Customer and driver correct auth; wrong-role credentials; validation; session restore; logout→login; pending driver approval; provider button availability/failure; offline/timeout; tab/keyboard navigation; Arabic/English; dark/day; iOS/Android; responsive screen and social option placement. Keep sensitive values out of logs/screenshots.
