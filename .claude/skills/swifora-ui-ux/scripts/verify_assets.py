#!/usr/bin/env python3
"""Validate Swifora approved image files, manifest and skill metadata (stdlib only)."""
import hashlib
import json
from pathlib import Path
import sys
root = Path(__file__).resolve().parents[1]
skill = (root / "SKILL.md").read_text(encoding="utf-8")
errors = []
if not skill.startswith("---\n") or "name: swifora-ui-ux" not in skill.split("---",2)[1]:
    errors.append("SKILL.md missing expected frontmatter")
manifest = json.loads((root / "references" / "approved-asset-manifest.json").read_text(encoding="utf-8"))
for name, expected in manifest["files"].items():
    f = root / "assets" / "approved" / name
    if not f.is_file():
        errors.append(f"Missing approved image: {name}")
    elif hashlib.sha256(f.read_bytes()).hexdigest() != expected["sha256"]:
        errors.append(f"Hash mismatch: {name}")
if len(manifest["files"]) != 8:
    errors.append("Expected exactly 8 approved reference images")
if errors:
    print("\n".join(errors), file=sys.stderr)
    raise SystemExit(1)
print("PASS: SKILL.md metadata and all 8 approved PNG reference hashes verified")
