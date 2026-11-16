# Administration dashboard — not yet design-approved

The Swifora admin dashboard is currently Node/Express server-rendered EJS + vanilla JS and includes orders, drivers, users, commissions, advertisements, settings, broadcasts, reports, support, etc. Supplied screenshots show dense desktop tables and significant mobile-sidebar overlap.

**There is no owner-approved admin redesign yet.** The official Swifora Dark and Day palette may guide *proposals* but is not an approval to replace admin layouts. Do not assume the mobile login's decorative skyline or mobile bottom tab bar belongs in an operations dashboard.

For an admin proposal:
- Preserve data density and transaction safety while increasing readability.
- Use responsive drawer/rail on small screens, tables with explicit responsive strategy, and high-contrast status chips.
- Group filters, search, bulk actions and destructive confirmations; offer safe previews for broadcasts.
- Separate operational alerts from KPI summaries.
- Cover loading, empty, error, pagination, permissions, concurrent edits and success confirmation.
- Show mockups in both Swifora Dark and Day modes and mark them `PROPOSED — NOT APPROVED`.
- After owner approves exact admin screens, add a new approval entry and image references before implementing.

**No admin CSS/HTML redesign merely because this skill is installed.**
