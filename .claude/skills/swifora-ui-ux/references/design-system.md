# Swifora Delivery visual system — baseline v1.0

## Approved visual language

**Dark Mode:** refined midnight navy backdrop, layered blue/slate surfaces, bold readable ivory/white Arabic typography, vibrant restrained cyan/teal interactive color, selective soft amber/gold for secondary highlights; warm delivery/parcel accent imagery. Subtle route motifs and gradient lighting are allowed only in hero/decorative contexts. Avoid purple/violet as a new primary direction.

**Day Mode:** clean warm off-white / near-white canvas with high-contrast navy text, quiet blue-gray borders and surfaces, cyan/teal main actions, muted golden highlights, generous whitespace and gentle soft shadows. This is not a monochrome inversion of dark mode; it has a separately approved look.

**Candidate token values** below are an engineering starting point inferred from design PNGs, **not sampled/approved pixel-perfect hex tokens**. Adjust centrally to match actual implementation and accessibility tests. The bundled PNGs remain the authoritative visual reference.

| Semantic token | Dark candidate | Day candidate | Usage |
|---|---|---|---|
| `background` | `#061624` | `#F8F8F5` | Main scaffold |
| `surface` | `#102838` | `#FFFFFF` | Cards and forms |
| `surfaceAlt` | `#173342` | `#F1F5F5` | Segments / secondary cards |
| `primary` | `#0BCBD0` | `#00A8B8` | Filled primary CTA (pair with deep navy label) |
| `onPrimary` | `#002530` | `#002530` | High-contrast text on primary fill |
| `textPrimary` | `#F5FAFC` | `#10273B` | Headlines, body text |
| `textSecondary` | `#B3C8D2` | `#526B7B` | Descriptions and metadata |
| `accentGold` | `#E9B35B` | `#C8872C` | Decorative highlights; do not use as small text without contrast-safe variant |
| `border` | `#345366` | `#D7E2E6` | Input/card outlines |
| `primaryTextLink` | `#0BCBD0` | `#007D89` | Text/link on background; verify context |
| `success` | semantic token | semantic token | Lifecycle feedback only |
| `warning` / `error` | semantic tokens | semantic tokens | Warnings and errors, not decoration |

**Implementation principle:** Adapt existing `lib/services/theme_service.dart` (`ColorScheme`, `AppSemanticColors`, `AppTone`, spacing/radius/sizes) and UX-03 shared widgets first. If token additions are needed, make them once in theme sources and use role-based design tokens. Verify every normal-text/token contrast in both modes; alter candidate colors if necessary. Do not keep inaccessible color combinations to match mockups exactly.

## Component system

- **Header:** Arabic brand wordmark `سويفورا دليفري` / English `Swifora Delivery`, modest logo aligned with RTL; avoid the giant ornamental login hero on utility screens.
- **Cards:** 16–24 dp typical radius; stacked semantic surfaces with subtle boundaries, not excessive inner borders. Use stable padding (16/20/24 dp). Decoration must not compete with actions.
- **Type:** well-rendered Arabic font with native Arabic glyphs, clear hierarchy (hero, page title, section title, body, supporting metadata), correct mixed English/Arabic shaping. Prefer type ramp from Flutter TextTheme; avoid text baked into images. Numeric/phone/email values should use appropriate text direction.
- **Spacing:** derive 4/8/12/16/24/32 dp scale from existing AppSpacing; visually group items, not arbitrary 40px gaps.
- **Buttons:** primary filled teal, secondary outlined or low-emphasis; destructive only red; separate disabled/loading/pressed states; comfortable at least 48 dp height and accessible labeling.
- **Inputs:** visible labels, not placeholder-only, persistent hints, input format/keyboard selection, validation and focus outline; password visibility accessible and email autofill.
- **Navigation:** one clear back path, RTL-consistent directional arrows, one active bottom-nav destination. Do not introduce double nav or change routing semantics without request.
- **Status:** textual chip + optionally icon, not color-only; semantic success/warning/error, no arbitrary purple status chips.
- **Illustrations:** brand imagery evokes swift delivery, map route, parcel, small truck; low-intensity, not distracting. The sample logo is a concept asset, not necessarily an approved vector master. Obtain a production-quality SVG/vector brand asset before shipping an app icon or wordmark.
- **Animations:** short, purposeful (<300 ms typical) and optional/reduced-motion friendly. No heavy animated backdrop.

## Platform and language parity

- Android and iOS native gestures, safe areas, system bar styles, notification permission differences.
- Arabic RTL is first-class; English LTR must keep equivalent structure and functionality. Mirror layout positions where meaningful, **not** Google/Apple trademarks or numeric strings.
- Login Apple option is an iOS requirement; for Android avoid a misleading Apple button unless supported by product requirements and implementation. Use current platform branding guidelines.
- Font scaling and accessibility services can enlarge text; test narrow devices, tablets as applicable, and keyboard-visible form states. Inputs and button labels must not clip.
- Light and dark both required on every approved mobile screen; avoid visual parity measured solely by using one token set inverted.

## Avoid

- Rejected purple/violet futuristic concept; old Stars Delivery label; hard-coded color literals in screen widgets; too many saturated cards; dense icon-only controls; massive unused vertical whitespace; obscuring bottom nav; photo-based labels; elaborate animation blocking startup; fake social auth buttons.
