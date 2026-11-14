# Approved mobile screen specifications (Owner approved 2026-11-14)

**Visual source of truth:** inspect each paired PNG in `assets/approved/`. These descriptions are implementation guidance, not pixel-exact substitutes.

## M-CUSTOMER-HOME — Customer Home Dashboard

**Dark:** `customer-home-dark.png` | **Day:** `customer-home-day.png`.

### Approved UX direction
- Clear Swifora wordmark, concise greeting and quick access to profile/notifications.
- Dominant single **Create New Order** hero action with delivery/map/parcel imagery (not a full-screen ad).
- Compact, legible nearby-driver availability summary.
- **My Orders** with price offers (count), in-progress orders (count), and an in-transit shortcut where applicable; clear status and tap targets.
- Simplified bottom navigation concept (`Home`, `Orders`, `Notifications`, `Account`) with consistent selected state in RTL/LTR.

### Functionality to protect
Current home may include ad carousel, unread support count, governorate-wide broadcast toggle, support/report driver actions, reports, pull-to-refresh, push registration and socket updates. The mockup omits some of these; do **not delete**. Propose reasonable secondary placements (e.g. account/settings, expandable section, contextual card) and make resulting navigation behavior explicit. New offer events must not unexpectedly hijack the user's current task. No-driver state needs an actionable explanation.

Source to inspect: `lib/screens/home_screen.dart`; notification and order BLoCs/services.

## M-DRIVER-HOME — Driver Dashboard

**Dark:** `driver-home-dark.png` | **Day:** `driver-home-day.png`.

### Approved UX direction
- Driver identity / notifications and an unmistakable **Available / Paused** control, with a clear status description.
- High-priority new requests, offers submitted, and in-progress deliveries; visible counts and fast actions.
- Earnings/commission summary with semantic labels; distinguish today/month/owed amounts.
- Spacing and grouping optimized for drivers operating quickly in the field; stable action priorities and light/day parity.

### Functionality to protect
Do not change driver activation/approval state, availability endpoint, offer lifecycle, order assignment, driver earnings/commission accounting, or realtime update contracts. **Never show `ILS 0` if fetching earnings failed.** Preserve existing stats during transient refresh failures, mark stale data, and provide retry. Existing project audit says earning/commission recognition on offer acceptance is intentional, not a UI bug.

Source: `lib/screens/provider_home_screen.dart` + provider BLoC.

## M-CREATE-ORDER — Create New Order

**Dark:** `create-order-dark.png` | **Day:** `create-order-day.png`.

### Approved UX direction
- Clear page title and optional progress (design shows "Step 1 of 2") if a separately authorized review step is implemented.
- Three prominent selectable types: Product Order (`طلب منتج`), People Transport (`توصيل أشخاص`), Goods Transport (`نقل بضاعة`); show text, icon and selected state.
- Readable field labels, description, delivery area/location, contact phone and correctly formatted phone input.
- Optional image-attachment affordance is **illustrative only** until verified supported/authorized.
- Dominant bottom primary CTA and concise contextual helper; clear draft, validation and submission states.

### Functionality to protect
Existing order creation may submit directly and have non-product-specific fields, location assumptions and server validation. Verify field schema and authorization. Do not add uploads or 2-step review API side effects based on mockup alone; require feature approval. Prevent accidental duplicate submits; handle permission denial, location unknown, lengthy descriptions, out-of-area option and API errors. The form must scroll and avoid keyboard overlap.

Source: `lib/screens/create_order_screen.dart`, order service and models.

## All three — test coverage expected

UI renders in both themes and ar/en; selected tabs and form states; device sizes and text scaling; network failure vs empty state; refresh while retaining data; accessibility/semantic labels; screenshots vs owner-approved references; no regressions of real user journeys from new order through driver offer, acceptance, tracking and delivery confirmation.
