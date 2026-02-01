---
description: Search past conversations
argument-hint: <question>
allowed-tools: mcp__cc-forever:cc-forever-mcp__retrieve_memory, AskUserQuestion
---

# Search Conversations

Search past conversations using semantic search.

## Argument Check

If `$ARGUMENTS` is empty, ask the user: "What would you like to search for?"

**Search query:** $ARGUMENTS

## Steps

### 1. Execute Search

Call `mcp__cc-forever:cc-forever-mcp__retrieve_memory`:

```json
{
  "query": "$ARGUMENTS",
  "n_results": 5,
  "threshold": 0.3
}
```

### 2. Format Results

Display results sorted by similarity:

```
Related past conversations:

### 1. (Similarity: 85%)
**Question:** {past question}
**Answer:** {summary of past answer}
**Date:** {timestamp}
**Project:** {project}

---

### 2. (Similarity: 72%)
...
```

### 3. Synthesized Answer

Based on the search results, provide an answer to the user's question:

```
---

Based on past conversations:

{answer to the question}
```

## No Results

If no relevant results found:

```
No past conversations found for "{query}".

Tips:
- Try different keywords
- Use /cc-forever:index to save conversations first
```
