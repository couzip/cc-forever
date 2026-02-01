---
description: Summarize entire session and save to index
allowed-tools: mcp__cc-forever:cc-forever-mcp__store_memory
---

# Compact Session

Summarize the entire session and save as Q&A pairs.

## IMPORTANT

Call store_memory **ONLY ONCE** with ALL Q&A pairs in a single content string.
Do NOT call store_memory multiple times.

## Steps

1. Review all conversations in this session
2. Summarize into Q&A pairs by topic (typically 3-5 pairs)
3. Call store_memory **ONCE** with all pairs concatenated

## Summary Guidelines

- Group related discussions into single Q&A pairs
- Questions should be concise (what was discussed)
- Answers should contain key points and conclusions only
- Omit redundant explanations
- Aim for 3-5 summarized Q&A pairs total

## Content Format

All Q&A pairs must be in a SINGLE content string:

    Human: Topic 1 summary
    Assistant: Key points for topic 1

    Human: Topic 2 summary
    Assistant: Key points for topic 2

    Human: Topic 3 summary
    Assistant: Key points for topic 3

## Example

Call store_memory ONCE with:

- content: "Human: CC-Forever plugin design\nAssistant: Built on txtai. Commands: index, compact, query.\n\nHuman: MCP server issue\nAssistant: Fixed by lazy init."
- project: current directory name
- tags: ["compact", "session-summary"]

## Completion

Report the number of topics summarized (e.g., "Saved 3 topic summaries").
