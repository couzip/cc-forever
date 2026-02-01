#!/usr/bin/env python3
"""
SessionEnd hook: Auto-index the LAST Q&A pair only
Disabled by default. Enable with auto_index: true in config.yml

Only saves the last Q&A pair to avoid duplication across sessions.
"""

import json
import sys
import os
from datetime import datetime
from pathlib import Path

try:
    import yaml
    YAML_AVAILABLE = True
except ImportError:
    YAML_AVAILABLE = False


def find_config_path() -> Path | None:
    """
    Find config file with priority:
    1. Project-level: ./.forever/config.yml
    2. User-level: ~/.forever/config.yml
    """
    # Priority 1: Project-level
    project_config = Path.cwd() / ".forever" / "config.yml"
    if project_config.exists():
        return project_config

    # Priority 2: User-level
    user_config = Path.home() / ".forever" / "config.yml"
    if user_config.exists():
        return user_config

    return None


def load_config() -> dict:
    """Load config file"""
    config_path = find_config_path()
    if config_path is None:
        return {}

    with open(config_path, 'r', encoding='utf-8') as f:
        if YAML_AVAILABLE:
            return yaml.safe_load(f) or {}
        else:
            # Simple YAML parser fallback
            content = f.read()
            config = {}
            for line in content.split('\n'):
                if ':' in line and not line.strip().startswith('#'):
                    parts = line.split(':', 1)
                    if len(parts) == 2:
                        key = parts[0].strip()
                        value = parts[1].strip()
                        if value.lower() == 'true':
                            config[key] = True
                        elif value.lower() == 'false':
                            config[key] = False
                        elif value.isdigit():
                            config[key] = int(value)
                        else:
                            config[key] = value
            return config


def read_transcript(transcript_path: str) -> list:
    """Read JSONL conversation transcript"""
    messages = []
    try:
        with open(transcript_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    try:
                        messages.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
    except Exception as e:
        print(f"Error reading transcript: {e}", file=sys.stderr)
    return messages


def extract_qa_pairs(messages: list) -> list:
    """Extract Q&A pairs from messages"""
    pairs = []
    human_msg = None

    for msg in messages:
        msg_type = msg.get("type") or msg.get("role", "")
        content = msg.get("content") or msg.get("text", "")

        # Handle list content (Claude Code format)
        if isinstance(content, list):
            text_parts = []
            for c in content:
                if isinstance(c, dict) and c.get("type") == "text":
                    text_parts.append(c.get("text", ""))
            content = " ".join(text_parts)

        if not isinstance(content, str):
            continue

        msg_type_lower = msg_type.lower()

        if msg_type_lower in ["human", "user"]:
            human_msg = content.strip()
        elif msg_type_lower in ["assistant", "claude"] and human_msg:
            answer = content.strip()
            if human_msg and answer:
                # Truncate long answers
                if len(answer) > 1000:
                    answer = answer[:1000] + "..."
                pairs.append({
                    "question": human_msg,
                    "answer": answer
                })
            human_msg = None

    return pairs


def build_conversation_text(pairs: list) -> str:
    """Convert Q&A pairs to Human/Assistant format text"""
    lines = []
    for pair in pairs:
        lines.append(f"Human: {pair['question']}")
        lines.append(f"Assistant: {pair['answer']}")
        lines.append("")
    return "\n".join(lines)


def store_to_index(conversation: str, project: str, session_id: str, config: dict) -> dict:
    """Store conversation to txtai index"""
    try:
        from txtai import Embeddings

        data_dir = os.path.expanduser(config.get("data_dir", "~/.forever"))
        index_path = os.path.join(data_dir, "index")

        embeddings_config = config.get("embeddings", {
            "path": "sentence-transformers/all-MiniLM-L6-v2",
            "content": True
        })
        embeddings_config["content"] = True

        embeddings = Embeddings(embeddings_config)

        # Load existing index if available
        if os.path.exists(index_path):
            try:
                embeddings.load(index_path)
            except Exception:
                pass

        # Import chunker
        script_dir = Path(__file__).parent
        mcp_server_path = script_dir.parent / "mcp-server" / "server"
        sys.path.insert(0, str(mcp_server_path))
        from chunker import chunk_conversation

        chunks = chunk_conversation(conversation, session_id=session_id)

        if not chunks:
            return {"success": False, "error": "No valid Q&A pairs"}

        # Create index
        timestamp = datetime.now().isoformat()
        documents = []
        for i, c in enumerate(chunks):
            doc_id = c.get("id", f"{session_id}-{i}")
            doc = {
                "text": c["text"],
                "question": c.get("question", ""),
                "timestamp": timestamp,
                "project": project,
                "tags": "auto-indexed,session-end"
            }
            documents.append((doc_id, doc, None))

        embeddings.upsert(documents)
        embeddings.save(index_path)

        return {"success": True, "indexed": len(chunks)}

    except ImportError:
        return {"success": False, "error": "txtai not available"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def main():
    # Load config
    config = load_config()

    # Skip if auto_index is disabled (default)
    if not config.get("auto_index", False):
        sys.exit(0)

    # Read hook input from stdin
    try:
        hook_input = json.load(sys.stdin)
    except json.JSONDecodeError:
        print("Error: Invalid JSON input", file=sys.stderr)
        sys.exit(1)

    session_id = hook_input.get("session_id", "unknown")
    transcript_path = hook_input.get("transcript_path")
    cwd = hook_input.get("cwd", "")
    reason = hook_input.get("reason", "")

    # Skip if no transcript
    if not transcript_path or not os.path.exists(transcript_path):
        sys.exit(0)

    # Skip on /clear
    if reason == "clear":
        sys.exit(0)

    # Read conversation
    messages = read_transcript(transcript_path)
    if not messages:
        sys.exit(0)

    # Extract Q&A pairs
    pairs = extract_qa_pairs(messages)

    if not pairs:
        sys.exit(0)

    # Only save the LAST Q&A pair (avoid duplication)
    last_pair = pairs[-1]
    conversation = build_conversation_text([last_pair])

    # Get project name
    project = Path(cwd).name if cwd else "unknown"

    # Index
    result = store_to_index(conversation, project, session_id, config)

    if result.get("success"):
        print(f"CC-Forever: Auto-indexed last Q&A pair", file=sys.stderr)
    else:
        error = result.get("error", "Unknown error")
        print(f"CC-Forever: Index failed - {error}", file=sys.stderr)

    sys.exit(0)


if __name__ == "__main__":
    main()
