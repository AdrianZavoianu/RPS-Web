#!/usr/bin/env python3
"""Sync backend requirements files from Pipfile.lock."""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
REQUIREMENTS_PATH = BACKEND_DIR / "requirements.txt"
REQUIREMENTS_DEV_PATH = BACKEND_DIR / "requirements-dev.txt"

AUTO_GENERATED_HEADER = (
    "# Auto-generated from backend/Pipfile.lock by scripts/sync_backend_requirements.py.\n"
    "# Do not edit manually.\n\n"
)


def _run_pipenv_requirements(*extra_args: str) -> str:
    command = ["pipenv", "requirements", *extra_args]
    completed = subprocess.run(
        command,
        cwd=BACKEND_DIR,
        text=True,
        capture_output=True,
        check=False,
    )
    if completed.returncode != 0:
        raise RuntimeError(
            f"Command failed ({' '.join(command)}):\n{completed.stderr.strip()}"
        )

    lines: list[str] = []
    for raw_line in completed.stdout.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("Loading .env environment variables"):
            continue
        lines.append(line)

    return AUTO_GENERATED_HEADER + "\n".join(lines) + "\n"


def _sync_file(path: Path, expected_content: str, check_only: bool) -> bool:
    current_content = path.read_text() if path.exists() else ""
    if current_content == expected_content:
        return True

    rel_path = path.relative_to(ROOT_DIR)
    if check_only:
        print(f"Dependency drift detected: {rel_path} is out of sync.")
        return False

    path.write_text(expected_content)
    print(f"Updated {rel_path}")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Fail if generated requirements differ from committed files.",
    )
    args = parser.parse_args()

    requirements_content = _run_pipenv_requirements()
    requirements_dev_content = _run_pipenv_requirements("--dev")

    ok = True
    ok &= _sync_file(REQUIREMENTS_PATH, requirements_content, check_only=args.check)
    ok &= _sync_file(
        REQUIREMENTS_DEV_PATH, requirements_dev_content, check_only=args.check
    )
    if args.check and not ok:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
