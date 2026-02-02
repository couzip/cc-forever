---
description: Delete memories from the index
argument-hint: <all|project:name|before:timestamp|id...>
allowed-tools: Skill, AskUserQuestion
---

# Delete Memories

If `$ARGUMENTS` is empty, ask the user what to delete with options:
- "all" - Delete all memories
- "project:<name>" - Delete by project
- "before:<date>" - Delete by date
- Specific IDs

Otherwise, use the Skill tool to invoke `cc-forever:delete-memory` with: $ARGUMENTS
