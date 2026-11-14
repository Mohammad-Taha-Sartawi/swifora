# Install Swifora UI/UX skill in Claude Code

**Contains 8 owner-approved reference images:** two per screen for Login, Customer Home, Driver Dashboard and Create Order. The 3rd purple concept is not included. Admin and all other screen layouts are **not approved**.

1. At the root of the **Swifora Delivery repository**, extract the archive, preserving the `.claude` hidden folder:

   ```bash
   unzip SWIFORA_CLAUDE_UI_UX_SKILL_v1.zip -d /path/to/swifora
   ```

   If the archive is already extracted, copy its `.claude/skills/swifora-ui-ux/` directory to the same location inside the repository. **Merge, do not replace, an existing `.claude` directory.**

2. In Claude Code, run:

   ```text
   /swifora-ui-ux audit login
   ```

   Or give Claude a natural-language request: "Use the swifora-ui-ux skill to compare the Login screen in Dark and Day Mode with the owner-approved images; report deviations, do not modify code."

3. Verify package content if Python 3 is available:

   ```bash
   python3 .claude/skills/swifora-ui-ux/scripts/verify_assets.py
   ```

4. **Optional:** append the text from `CLAUDE_MD_SNIPPET.md` to the repository's existing `CLAUDE.md` or create `CLAUDE.md` if none exists. Do not overwrite any existing instructions.

5. Share/install `.claude/skills/swifora-ui-ux/` via a dedicated PR if your team uses Git. Nothing in this archive changes Flutter, backend or admin application source.

## What the skill can / cannot do

It provides design guidance, an approval registry, QA guardrails and reference screenshots. Installing it **does not automatically redesign screens**, implement Google/Apple authentication, or push code to GitHub. Use it in explicit audit / implement tasks. If the repository's current branch differs from the audit snapshot, Claude must inspect the actual current code first.

Main entry: `.claude/skills/swifora-ui-ux/SKILL.md`.
