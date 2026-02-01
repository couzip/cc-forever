# cc-forever-mcp

MCP server for persistent conversation memory in Claude Code.

## Overview

An MCP server that enables semantic search over past conversations.

- Runs locally (no API key required)
- Japanese language support (using Ruri v3 model)
- Vector search with LanceDB

## Installation

```bash
npx -y cc-forever-mcp
```

## Tools

- `store_memory`: Store conversations
- `retrieve_memory`: Retrieve related conversations via semantic search

## Tech Stack

- [LanceDB](https://lancedb.com/) - Vector database
- [Hugging Face Transformers](https://huggingface.co/docs/transformers.js) - Embedding generation
- [MCP SDK](https://modelcontextprotocol.io/) - Model Context Protocol

## License

Apache-2.0
