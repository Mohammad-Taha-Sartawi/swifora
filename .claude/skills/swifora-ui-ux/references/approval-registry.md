# Owner approval registry — authoritative (2026-11-14)

**Owner approved** exactly these four mobile screen groups in **both** Dark Mode and Day Mode:

| ID | Screen | Dark reference | Day reference | Approval | Implemented? |
|---|---|---|---|---|---|
| M-LOGIN | Login / Role selection | `assets/approved/login-dark.png` | `assets/approved/login-day.png` | **APPROVED** | Not asserted; check repository |
| M-CUSTOMER-HOME | Customer Home Dashboard | `assets/approved/customer-home-dark.png` | `assets/approved/customer-home-day.png` | **APPROVED** | Not asserted; check repository |
| M-DRIVER-HOME | Driver Dashboard | `assets/approved/driver-home-dark.png` | `assets/approved/driver-home-day.png` | **APPROVED** | Not asserted; check repository |
| M-CREATE-ORDER | Create New Order | `assets/approved/create-order-dark.png` | `assets/approved/create-order-day.png` | **APPROVED** | Not asserted; check repository |

Paths above are relative to the skill directory. They are bundled with the skill.

**Rejected:** Third login theme — glossy violet/purple sci-fi/futuristic theme. Do not use for any screen, icon set or admin design.

**Unapproved / pending:** Every other mobile screen (offers, active orders, notifications, profiles, support, reports, etc.), all dialogs, and all admin dashboard pages/variants. Existing screenshots of these are evidence of the old UI, **not owner approval** of a new design.

**The approval is for visual design direction and UX structure.** It is not a request to deploy, modify backend APIs, add sign-in providers, change auth/security rules, alter order state transitions, or claim screenshot designs are already functional.

**Next approvals:** Collect further screens in groups of three, each with Dark and Day Mode, obtain explicit owner feedback, update this registry and add references **only after approval**. Do not assume approvals from silence.
