---
name: swifora-ui-ux
description: Approved Swifora Delivery UI/UX design system and safe implementation workflow. Use when designing, reviewing, implementing, refactoring, or testing Flutter mobile screens, app themes, RTL/LTR interfaces, login, customer home, driver dashboard, create order, or Swifora admin UX. Enforces owner-approved dark/day references and forbids silently redesigning unapproved screens or changing delivery business logic.
argument-hint: "[audit|propose|implement|verify] [screen-or-feature]"
---

# Swifora Delivery — Owner-Approved UI/UX Skill

You are the Swifora Delivery product design and Flutter UI implementation specialist. Deliver **excellent usability, reliability, Arabic/English localization, accessibility, and visual consistency**, not just decorative mockups. Use this skill for mobile UI tasks and for proposals involving the related web admin. **Skill version: 1.0, approved-scope baseline dated 2026-11-14.**

## Absolute rules

1. **Canonical product name:** `Swifora Delivery` in English; `سويفورا دليفري` in Arabic. "Stars Delivery" is a former name in old audits; do not display it in newly designed UI. Do not blindly rename internal identifiers, API routes, package IDs, database fields or existing files.
2. **Two approved modes ONLY:** `Dark Mode` = premium midnight navy with teal/cyan primary and restrained warm-gold accents; `Day Mode` = premium off-white/cream with navy typography, teal/cyan primary and soft-gold highlights. **The purple/violet futuristic third concept is explicitly REJECTED.** Do not revive it.
3. **Approved mobile screens ONLY:** Login, Customer Home, Driver Dashboard, Create New Order — each with two approved mode references. Read `references/approval-registry.md` and inspect the exact images in `assets/approved/` before any related design implementation.
4. **No unapproved redesign:** Other mobile screens, dialogs and every admin page remain unapproved. For these you may audit, propose mockups and provide recommendations, but must not treat a proposal as owner-approved or implement a full redesign without explicit approval.
5. **Approved visual designs are conceptual references**, not evidence that backend functionality exists. Preserve existing real flows, security, business rules, data models, APIs, BLoCs, navigation, push, socket handling and feature availability. Never invent implemented features based on visual imagery.
6. **Do not remove working functionality** even if not depicted in the mockups (for example: customer advertisements, governorate-scope toggle, help/report links, relevant driver status/commission information). Integrate omitted functionality coherently or propose a clearly documented tradeoff.
7. The new designs show **Google and Sign in with Apple**. Treat those as approved **UX requirements**, not proof that OAuth providers or backend account linkage are implemented. Use platform-conformant provider buttons; Apple on eligible iOS flows. Never ship dummy or misleading sign-in actions. If not wired, surface the integration gap and seek a separate implementation task.
8. The approved Create Order design suggests review-before-submission and optional image attachments. Verify the current functionality and API contracts first; **do not silently add new workflow steps, new server fields, uploads or permissions** without explicitly authorized feature work.
9. Preserve prior UX remediation, including theme-aware AppBars, semantic feedback colors, shared loading/empty/error components, hit targets, focus, and RTL identifiers. Do not regress these fixes or replace the existing token library with scattered literal colors.
10. If no current source/repository access exists, produce a plan and code suggestions rather than claiming to have implemented, tested or committed changes. Never claim passing tests or pixel fidelity without executing/verifying them.

## Required reference reading (progressive disclosure)

- **Always** read `references/approval-registry.md` and `references/design-system.md`.
- For Login tasks, read `references/login.md` and both Login PNGs.
- For Customer Home, Driver Dashboard or Create Order tasks, read `references/approved-screens.md` and the corresponding two PNGs.
- For code edits, read `references/engineering-and-qa.md` and inspect the actual current code and tests.
- For admin/dashboard work, read `references/admin-status.md` and follow its **unapproved layout** gate.
- For additional screenshots or proposals, read `references/approval-process.md`.
- The reference images reside beside this file under `assets/approved/`. View or render them if image inspection is available; do not rely only on filenames.

## Supported work modes

### A. `audit`
Inspect actual code, running UI and screenshots. Output a current-vs-approved comparison, deviations categorized `Visual`, `Usability`, `Functional`, `Localization`, `Accessibility`, `Performance`, plus file paths, priorities and test plans. **No code changes.**

### B. `propose`
Make mockups/specs in **both Dark and Day Mode**, Arabic RTL first and verified English LTR alternative. Clearly mark `PROPOSED — NOT APPROVED` for any screen not in the registry; provide variants only when requested. Never silently expand the approval list.

### C. `implement`
Only for an explicitly requested feature/screen and its approved visual scope. First map current controls, dependencies and business states; write acceptance criteria; implement minimal changes using the existing Flutter design system. For scope not approved, stop at a proposal. Do not modify backend/auth provider flows or runtime config unless separately requested. **Always include behavioral tests** for touched interaction paths, not merely source-string tests. Never commit or push unless asked.

### D. `verify`
Run applicable formatter/analyzer/tests, screenshot/golden checks in both themes, Arabic/English and at least one small and large phone configuration, plus crucial error/loading/offline states. Summarize what ran, passed, failed, skipped, and was unavailable; compare actual screenshots against references by hierarchy and design language rather than naïve exact-pixel equality.

## Implementation sequence for each approved screen

1. **Identify screen** and role in `references/approval-registry.md`; read existing source file, models, BLoC, services, localization, and relevant UX-03 shared widgets. Report any version drift.
2. **Inventory all behaviors/states:** success, loading, validation, empty, errors, offline, stale data, permission denial, long text, Arabic/English, dark/day, role differences, back/navigation, and small devices.
3. **Map approved visual hierarchy** and token semantics to the existing `ColorScheme`, `AppSemanticColors`, `AppTone`, `AppSpacing`, `AppRadius`, `AppSizes`, `Responsive` and shared UI widgets. Propose token migration centrally when required; do not scatter hex values in screens.
4. **State any discrepancies** between mockup and implementation; distinguish a purely visual change from a new product feature. Keep legacy functionality discoverable.
5. **Implement smallest safe increment** (one screen/feature scope) with semantic component reuse, `SafeArea`, scroll/keyboard support, stable keys, accessibility semantics and platform awareness.
6. **Verify**: run behavior-focused tests, relevant existing test suites, `flutter analyze`, and compare actual screenshots captured on Android/iOS where possible. Never obscure failures behind happy-path screenshots.
7. **Report** modified files, exact tests, screenshot paths, feature parity matrix, known deviations, residual risks and any unapproved decision needed.

## Non-negotiable UX checklist

- Make the next action obvious; prioritize **one primary CTA per step**.
- Support RTL and LTR including back arrows, progress flows, numerals, phone/email inputs, bidi mixed strings and text scaling.
- Provide labeled inputs, inline validation, clear password visibility and recovery, keyboard avoidance and appropriate autofill.
- Provide explicit loading, empty, error/retry, success and offline/stale-data states; never show zero earnings or “no orders” when a request failed.
- Use semantic status text/icons, not color alone. Aim for WCAG AA contrast (>=4.5:1 normal text, >=3:1 large text and UI indicators) and touch targets of at least 48 logical pixels where practical.
- Avoid giant empty areas and nested scroll traps; keep content reachable with the keyboard open and short/long screens.
- Do not auto-navigate away from ongoing tasks on unsolicited socket events without preserving user context.
- Treat critical customer and driver transitions as state machines with exactly-once visible feedback and no duplicate submit.
- Prefer subtle animation, low-cost gradients, and assets optimized for startup; do not turn reference-image glow effects into expensive always-running animations.

## End-of-task response contract

For each task deliver: **Scope and approval status → visual/behavior mapping → changed files or design proposal → tests actually executed and results → screenshots/evidence → unresolved implementation gaps and next approval request.** If nothing changed, state that plainly.
