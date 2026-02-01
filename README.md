# CC-Forever

**Give Claude Code a persistent memory — 100% local, 100% free.**

Never lose valuable conversations again. CC-Forever lets you save and retrieve past conversations with Claude Code using semantic search. Ask "How did I implement authentication last month?" and instantly get relevant context from your conversation history.

## Why CC-Forever?

- **100% Local** — All data stays on your machine. No cloud, no external APIs.
- **100% Free** — No API keys, no subscriptions, no usage limits.
- **Instant Recall** — Retrieve any past conversation with semantic search.
- **Privacy First** — Your conversations never leave your computer.
- **Works Offline** — No internet required after initial model download.

## Features

- **Persistent Memory**: Save conversations automatically or manually
- **Semantic Search**: Find relevant past conversations by meaning, not just keywords
- **Project or Global**: Keep memories per-project or share across all projects
- **Cross-platform**: Works on macOS, Linux, and Windows

## Installation

```bash
# Add marketplace
/plugin marketplace add couzip/cc-forever

# Install plugin
/plugin install cc-forever@cc-forever-marketplace

# Or install directly from local directory
claude --plugin-dir /path/to/cc-forever
```

## Setup

```
/cc-forever:setup
```

Choose your preferences:

1. **Embedding Model**
   - English (default): `sentence-transformers/all-MiniLM-L6-v2` (~80MB)
   - English (Q&A optimized): `sentence-transformers/multi-qa-MiniLM-L6-dot-v1` (~80MB)
   - Japanese: `cl-nagoya/ruri-v3-30m` (~150MB)
   - Japanese (high accuracy): `cl-nagoya/ruri-v3-130m` (~530MB)

2. **Auto-indexing**
   - OFF (default): Manual indexing only
   - ON: Automatically save last Q&A on session end

## Commands

### Save Conversations

```
/cc-forever:index
```

Save recent Q&A pairs to the index.

### Summarize Session

```
/cc-forever:compact
```

Summarize and save the entire session by topic.

### Search Past Conversations

```
/cc-forever:query <question>
```

Search past conversations for relevant information.

## Configuration

CC-Forever supports two config scopes:

| Scope | Config Path | Data Path | Use Case |
|-------|-------------|-----------|----------|
| Project-level | `./.forever/config.yml` | `./.forever/` | Project-specific memory |
| User-level | `~/.forever/config.yml` | `~/.forever/` | Global memory across projects |

**Priority:** Project-level config takes priority over user-level config.

### Config File

```yaml
embeddings:
  path: sentence-transformers/all-MiniLM-L6-v2
  content: true

data_dir: ~/.forever   # or ./.forever for project-level
auto_index: false
```

| Setting | Default | Description |
|---------|---------|-------------|
| `embeddings.path` | `sentence-transformers/all-MiniLM-L6-v2` | Embedding model |
| `data_dir` | `~/.forever` | Data directory |
| `auto_index` | `false` | Auto-index last Q&A on session end |

## Architecture

```
Claude Code Session
        │
        ├── /cc-forever:index  ──► MCP Server ──► txtai
        ├── /cc-forever:query  ──► MCP Server ──► txtai
        │
        └── [Session End] (if auto_index: true)
                │
                └── SessionEnd Hook ──► auto-index.py ──► txtai
```

### Tech Stack

- **[txtai](https://github.com/neuml/txtai)**: Embeddings and semantic search
- **[MCP](https://modelcontextprotocol.io/)**: Model Context Protocol for Claude Code integration
- **[Faiss](https://github.com/facebookresearch/faiss)**: Vector index
- **SQLite**: Metadata storage

## Development

### Prerequisites

- Python 3.10+
- [uv](https://github.com/astral-sh/uv) (recommended) or pip

### Running locally

```bash
# Install dependencies
cd mcp-server
uv sync

# Run MCP server
uv run python server/main.py
```

## License

Apache License 2.0

## Acknowledgments

- [txtai](https://github.com/neuml/txtai) - Embedding database
- [txtai-assistant-mcp](https://github.com/rmtech1/txtai-assistant-mcp) - MCP server reference
- [ruri-v3](https://huggingface.co/cl-nagoya/ruri-v3-30m) - Japanese embedding model
