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

- **Persistent Memory**: Save conversations manually or automatically
- **Auto-Index**: Automatically save conversations when Claude responds (optional)
- **Semantic Search**: Find relevant past conversations by meaning, not just keywords
- **Session Compaction**: Summarize entire sessions into topic-based Q&A pairs
- **Project or Global**: Keep memories per-project or share across all projects

## Installation

```bash
claude plugin add /path/to/cc-forever
```

Restart Claude Code after installation, then run `/cc-forever:setup` to configure.

## Setup

```
/cc-forever:setup
```

Choose your embedding model:

| Option | Model | Size | Use Case |
|--------|-------|------|----------|
| English | `Xenova/all-MiniLM-L6-v2` | ~90MB | Default, fast |
| Multilingual | `Xenova/multilingual-e5-small` | ~470MB | Multiple languages |
| Japanese (Light) | `sirasagi62/ruri-v3-30m-ONNX` | ~120MB | Japanese, balanced |
| Japanese (High Accuracy) | `sirasagi62/ruri-v3-310m-ONNX` | ~1.2GB | Japanese, best quality |

**Custom Models:** You can use any [Transformers.js compatible model](https://huggingface.co/models?library=transformers.js&pipeline_tag=feature-extraction) from HuggingFace. Models must support the `feature-extraction` pipeline and have ONNX weights for Transformers.js.

**Note:** First run downloads the embedding model. This may take a few minutes depending on model size and network speed.

## Commands

### Save Conversations

```
/cc-forever:index [count]
```

Save recent Q&A pairs to the index. Optionally specify how many pairs to save.

### Search Past Conversations

```
/cc-forever:query <question>
```

Search past conversations for relevant information using semantic search.

### Summarize Session

```
/cc-forever:compact
```

Summarize and save the entire session as topic-based Q&A pairs.

## Auto-Index (Optional)

Enable automatic indexing to save conversations whenever Claude finishes responding.

**Warning:** Auto-index saves every Q&A pair, which can cause the database to grow quickly. Consider using manual `/cc-forever:index` or `/cc-forever:compact` for better control over what gets saved.

### Enable via Setup

Run `/cc-forever:setup` and select "Yes" for auto-indexing.

### Manual Configuration

Edit your config file (`~/.forever/config.yml` or `./.forever/config.yml`):

```yaml
auto_index: true
```

When enabled, the last Q&A pair is automatically indexed after each Claude response.

## Configuration

CC-Forever supports two config scopes:

| Scope | Config Path | Data Path | Use Case |
|-------|-------------|-----------|----------|
| Project-level | `./.forever/config.yml` | `./.forever/` | Project-specific memory |
| User-level | `~/.forever/config.yml` | `~/.forever/` | Global memory across projects |

**Priority:** Project-level config takes priority over user-level config.

### Config Options

```yaml
embeddings:
  path: Xenova/all-MiniLM-L6-v2

auto_index: false
```

| Setting | Default | Description |
|---------|---------|-------------|
| `embeddings.path` | `Xenova/all-MiniLM-L6-v2` | Embedding model from HuggingFace |
| `auto_index` | `false` | Auto-save conversations on Claude response |

## Architecture

```
Claude Code Session
        │
        ├── /cc-forever:index   ──► Skill ──► MCP Server ──► LanceDB
        ├── /cc-forever:query   ──► Skill ──► MCP Server ──► LanceDB
        ├── /cc-forever:compact ──► Skill ──► MCP Server ──► LanceDB
        │
        └── [Stop Hook] ──► auto-index.mjs ──► LanceDB (if auto_index: true)
```

### Tech Stack

- **[LanceDB](https://lancedb.com/)**: Vector database (file-based, no server needed)
- **[Transformers.js](https://huggingface.co/docs/transformers.js)**: Local embeddings via ONNX
- **[MCP](https://modelcontextprotocol.io/)**: Model Context Protocol for Claude Code integration

## Development

### Prerequisites

- Node.js 20+
- npm

### Project Structure

```
cc-forever/
├── .claude-plugin/
│   └── plugin.json
├── commands/           # Slash commands
├── skills/             # Skill implementations
├── hooks/
│   └── hooks.json      # Stop hook for auto-index
├── scripts/
│   └── auto-index.mjs  # Auto-index script
└── mcp-server/         # MCP server with LanceDB
```

### Running Locally

```bash
# Install dependencies
cd mcp-server
npm install

# Build
npm run build

# Test with Claude Code
claude --plugin-dir /path/to/cc-forever
```

### Debug Mode

```bash
# Enable debug logging
CC_FOREVER_DEBUG=1 claude --plugin-dir /path/to/cc-forever

# Or use Claude's debug mode
claude --debug --plugin-dir /path/to/cc-forever
```

## License

Apache License 2.0

See [LICENSE](LICENSE) and [NOTICE](NOTICE) for details.

## Acknowledgments

- [mcp-local-rag](https://github.com/shinpr/mcp-local-rag) - Architecture and implementation reference (MIT License)
- [LanceDB](https://lancedb.com/) - Vector database
- [Transformers.js](https://huggingface.co/docs/transformers.js) - Local embeddings
