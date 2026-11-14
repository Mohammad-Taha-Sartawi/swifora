# Approval and change-control protocol

## Design review loop

1. Select exactly **three new screens** per review batch unless owner requests otherwise.
2. Inspect their current screenshots and workflows, trace real functional states, and identify enhancements vs new features.
3. Create two proposals for each screen: **Swifora Dark Mode** and **Swifora Day Mode**, with Arabic-first RTL design and a clear note that English and device variants are required.
4. Provide full-screen images and short strengths/weaknesses; label each `PROPOSED — NOT APPROVED`.
5. Wait for explicit per-screen owner approval or correction.
6. Only then update `approval-registry.md`, add bundled reference PNGs, and if needed adjust `design-system.md` without overriding existing approved decisions.
7. If the owner asks to implement an approved screen, use the `implement` mode from `SKILL.md` and `engineering-and-qa.md`.

## Approval record format

```text
Date: YYYY-MM-DD
Screen ID and source path:
Dark reference:
Day reference:
Owner decision: APPROVED | REVISION REQUIRED | PENDING | REJECTED
Notes on what is approved:
Behavior changes requiring separate product/API approval:
```

Never treat an old screenshot, assistant suggestion, generated mockup, or lack of criticism as approval. The owner can supersede approved specs explicitly; document replacements with date and reference path rather than silently deleting them.
