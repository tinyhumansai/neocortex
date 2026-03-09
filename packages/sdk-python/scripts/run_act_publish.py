"""Run act to test .github/workflows/publish.yml locally with secrets from .act-secrets."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path


def _repo_root() -> Path:
    root = Path(__file__).resolve().parent.parent
    if not (root / ".github" / "workflows").exists():
        raise SystemExit(
            "run_act_publish: must run from repo root (has .github/workflows)"
        )
    return root


def main() -> None:
    root = _repo_root()
    secrets_file = root / ".act-secrets"
    if not secrets_file.exists():
        print(
            "Missing .act-secrets. Copy act-secrets.example to .act-secrets and add PYPI_API_TOKEN.",
            file=sys.stderr,
        )
        sys.exit(1)

    tag = os.environ.get("ACT_TAG", "v0.1.0")
    event = {"ref": f"refs/tags/{tag}"}

    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump(event, f)
        event_path = f.name

    try:
        workflow = root / ".github" / "workflows" / "publish.yml"
        cmd = [
            "act",
            "push",
            "-W",
            str(workflow),
            "--secret-file",
            str(secrets_file),
            "-e",
            event_path,
        ]
        sys.exit(subprocess.run(cmd, cwd=root).returncode)
    finally:
        os.unlink(event_path, dir_fd=None)


if __name__ == "__main__":
    main()
