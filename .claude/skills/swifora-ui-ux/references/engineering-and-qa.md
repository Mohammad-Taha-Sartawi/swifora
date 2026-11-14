# Safe Flutter + admin engineering and QA contract

## Codebase (based on the supplied audit snapshot; verify against HEAD)

- Flutter 3.47 mobile Android/iOS; `lib/screens/`, `lib/bloc/`, `lib/services/`, `lib/models/`, `lib/widgets/ui/`; mixed BLoC and stateful screens.
- Shared components/theme: `lib/services/theme_service.dart`, `AppTone`, `AppSemanticColors`, `AppSpacing`, `AppRadius`, `AppSizes`, `AppStatusChip`, `AppConfirmDialog`, loading/feedback, `Responsive`.
- Backend in `swifora_backend/`: Node/Express/MongoDB, Socket.IO, FCM; admin is EJS + JS. UI work should not change API contract or database models without explicit scope.
- Legacy audit name `Stars Delivery` refers to same evolving Swifora repository. Date of audit 2026-11-13; subsequent code may differ.
- Audit snapshot records 613 passing tests but many source-level assertions, a reported startup ANR and prior dependency/advisory concerns. Do not infer current test status.

## Review gates before each implementation

1. `git status`, branch and diff; inspect relevant files and test types; verify whether implementation branch includes prior UX-03 fixes.
2. Trace screen events to BLoC/services and API responses; inventory any logic co-located with UI.
3. Treat current business behavior as the functional source of truth; annotate UI proposals needing new domain capabilities.
4. Add/extend widget and behavior tests for interactions and actual states, not only source-grepping.
5. Use existing localization keys or add missing keys for both languages. Never hide a hard-coded English placeholder in an Arabic screen.
6. Capture initial and loaded/error states on representative Android and iOS targets (when available); keep screenshots synthetic and redact personal data.
7. Compare design to approved PNG at visual hierarchy and component level, not blindly match AI-image output text as functional copy.
8. Run `dart format` on touched Dart, `flutter analyze`, relevant `flutter test` (and wider suite when safe); report specific commands and results. Backend tests only if backend touched under a separate approved task.
9. Check WCAG AA contrast, screen-reader traversal, touch target dimensions, scalable fonts, RTL/LTR bidi and 320+ dp widths.
10. Check network timeouts, duplicate taps, stale data, logout, role/driver status and app lifecycle. Avoid ANRs/startup loading regressions.

## Crucial regression journeys

- Login customer and driver, wrong-role error, suspended/pending driver, logout and sign-in again; restoration/revocation.
- Create product/people/goods order, validation and duplicate submit, no network, delayed network, canceled order.
- Driver available/paused; new order; submit price/ETA; expiration/rejection; offered/accepted transitions.
- Customer accepts one offer; provider sees accepted order and correct next action.
- Start delivery; request customer confirmation; reject/approve; complete; driver/customer status synchronization; rating and notification.
- Driver earnings, commissions and stale/failure state differentiation.
- System bar + keyboard + accessibility + small-screen navigation in both modes and both languages.

## Mandatory deliverable format

```markdown
### Scope / approval
### Screenshot vs implementation delta
### Preserved behavior and proposed new behavior
### Changed files
### Tests run (command, pass/fail/skipped)
### Screenshot capture paths (theme, locale, device)
### Known risks / remaining questions
### Owner approval required? (yes/no; what)
```

Do not claim integration tests, OAuth, browser responsiveness or pixel-perfect visuals were verified unless those tools actually ran.
