#!/usr/bin/env python3
"""
SessionStart hook: Check if CC-Forever is configured
"""

import os
import sys
from pathlib import Path


def find_config() -> str | None:
    """
    Find config file with priority:
    1. Project-level: ./.forever/config.yml
    2. User-level: ~/.forever/config.yml
    """
    # Priority 1: Project-level
    project_config = Path.cwd() / ".forever" / "config.yml"
    if project_config.exists():
        return str(project_config)

    # Priority 2: User-level
    user_config = Path.home() / ".forever" / "config.yml"
    if user_config.exists():
        return str(user_config)

    return None


def main():
    config_path = find_config()

    if config_path is None:
        print("CC-Forever plugin is not configured", file=sys.stderr)
        print("Run /cc-forever:setup to configure", file=sys.stderr)

    sys.exit(0)


if __name__ == "__main__":
    main()
