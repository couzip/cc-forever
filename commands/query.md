---
description: Search past conversations
argument-hint: <question>
allowed-tools: Skill, AskUserQuestion
---

# Search Conversations

If `$ARGUMENTS` is empty, ask the user: "What would you like to search for?"

Otherwise, use the Skill tool to invoke `cc-forever:search-memory` with: $ARGUMENTS
