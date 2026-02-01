#!/usr/bin/env python3
"""
Q&A Pair Chunking Module

Splits conversations into Human/Assistant pairs for indexing.
"""

import re
from datetime import datetime
from typing import List, Dict, Optional


def chunk_conversation(
    conversation: str,
    max_answer_length: int = 1000,
    session_id: Optional[str] = None
) -> List[Dict]:
    """
    Split conversation into Q&A pairs.

    Args:
        conversation: Conversation text in Human/Assistant format
        max_answer_length: Maximum answer length (truncated if exceeded)
        session_id: Session ID (optional)

    Returns:
        List of chunks
    """
    chunks = []
    timestamp = datetime.now().isoformat()
    base_id = session_id or timestamp

    # Split by Human/Assistant/User/Claude turns
    pattern = r'^(Human|User|Assistant|Claude):\s*'

    # Extract each turn
    turns = []
    current_role = None
    current_content = []

    for line in conversation.split('\n'):
        match = re.match(pattern, line, re.IGNORECASE)
        if match:
            if current_role and current_content:
                turns.append({
                    "role": current_role,
                    "content": '\n'.join(current_content).strip()
                })

            role = match.group(1).lower()
            current_role = "human" if role in ["human", "user"] else "assistant"
            remaining = line[match.end():].strip()
            current_content = [remaining] if remaining else []
        else:
            current_content.append(line)

    if current_role and current_content:
        turns.append({
            "role": current_role,
            "content": '\n'.join(current_content).strip()
        })

    # Create Human/Assistant pairs
    pair_index = 0
    i = 0
    while i < len(turns):
        if turns[i]["role"] == "human":
            question = turns[i]["content"]
            answer = ""

            if i + 1 < len(turns) and turns[i + 1]["role"] == "assistant":
                answer = turns[i + 1]["content"]
                if len(answer) > max_answer_length:
                    answer = answer[:max_answer_length] + "..."
                i += 2
            else:
                i += 1
                continue

            if not question.strip() or not answer.strip():
                continue

            chunk_id = f"{base_id}-{pair_index}"
            chunks.append({
                "id": chunk_id,
                "text": f"Human: {question}\nAssistant: {answer}",
                "question": question[:200],
                "timestamp": timestamp,
            })
            pair_index += 1
        else:
            i += 1

    return chunks


def chunk_from_jsonl(
    messages: List[Dict],
    session_id: str = None,
    max_answer_length: int = 1000
) -> List[Dict]:
    """
    Extract Q&A pairs from JSONL message list.

    Args:
        messages: List of messages loaded from JSONL
        session_id: Session ID
        max_answer_length: Maximum answer length

    Returns:
        List of chunks
    """
    chunks = []
    timestamp = datetime.now().isoformat()
    base_id = session_id or timestamp

    human_msg = None
    pair_index = 0

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
                if len(answer) > max_answer_length:
                    answer = answer[:max_answer_length] + "..."

                chunk_id = f"{base_id}-{pair_index}"
                chunks.append({
                    "id": chunk_id,
                    "text": f"Human: {human_msg}\nAssistant: {answer}",
                    "question": human_msg[:200],
                    "timestamp": timestamp,
                })
                pair_index += 1

            human_msg = None

    return chunks
