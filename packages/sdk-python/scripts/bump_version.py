"""Bump version in pyproject.toml. Usage: python bump_version.py [major|minor|patch]."""

from __future__ import annotations

import re
import sys
from pathlib import Path


def main() -> None:
    if len(sys.argv) != 2 or sys.argv[1] not in ("major", "minor", "patch"):
        print("Usage: python bump_version.py [major|minor|patch]", file=sys.stderr)
        sys.exit(1)
    part = sys.argv[1]

    path = Path(__file__).resolve().parent.parent / "pyproject.toml"
    text = path.read_text()
    m = re.search(r'version\s*=\s*["\']([^"\']+)["\']', text)
    if not m:
        print("No version found in pyproject.toml", file=sys.stderr)
        sys.exit(1)

    parts = [int(x) for x in m.group(1).strip().split(".")]
    while len(parts) < 3:
        parts.append(0)
    major, minor, patch = parts[0], parts[1], parts[2]

    if part == "major":
        major, minor, patch = major + 1, 0, 0
    elif part == "minor":
        minor, patch = minor + 1, 0
    else:  # patch
        patch += 1

    new_version = f"{major}.{minor}.{patch}"
    new_text = re.sub(
        r'(version\s*=\s*["\'])[^"\']+(["\'])',
        rf"\g<1>{new_version}\g<2>",
        text,
    )
    path.write_text(new_text)
    print(new_version)


if __name__ == "__main__":
    main()
