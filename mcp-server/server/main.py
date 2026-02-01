#!/usr/bin/env python3
"""
CC-Forever MCP Server
Persistent conversation memory with semantic search

Based on txtai-assistant-mcp
"""

import os
import sys
import json
from datetime import datetime
from pathlib import Path

import yaml
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

# Note: txtai is imported lazily in init_embeddings() to avoid slow startup

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from chunker import chunk_conversation

# Global embeddings instance
embeddings = None
config = None
data_dir = None
config_source = None  # Track which config file was used


def load_config() -> dict:
    """
    Load config file with priority:
    1. Project-level: ./.forever/config.yml (current working directory)
    2. User-level: ~/.forever/config.yml
    3. Default settings
    """
    global config_source

    # Priority 1: Project-level config
    project_config = Path.cwd() / ".forever" / "config.yml"
    if project_config.exists():
        config_source = str(project_config)
        with open(project_config, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f) or {}

    # Priority 2: User-level config (or env override)
    user_config_path = os.environ.get("FOREVER_CONFIG", "~/.forever/config.yml")
    user_config = Path(os.path.expanduser(user_config_path))
    if user_config.exists():
        config_source = str(user_config)
        with open(user_config, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f) or {}

    # Priority 3: Default settings
    config_source = "default"
    return {
        "embeddings": {
            "path": "sentence-transformers/all-MiniLM-L6-v2",
            "content": True
        },
        "data_dir": "~/.forever"
    }


def get_data_dir() -> Path:
    """Get data directory path"""
    global config
    dir_path = os.path.expanduser(config.get("data_dir", "~/.forever"))
    path = Path(dir_path)
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_index_path() -> Path:
    """Get index file path"""
    return get_data_dir() / "index"


def init_embeddings():
    """Initialize embeddings (lazy load txtai here)"""
    global embeddings, config, data_dir

    # Lazy import to avoid slow startup
    from txtai import Embeddings

    config = load_config()
    data_dir = get_data_dir()
    index_path = get_index_path()

    embeddings_config = config.get("embeddings", {})
    embeddings_config["content"] = True  # Always store content

    embeddings = Embeddings(embeddings_config)

    # Load existing index if available
    if index_path.exists():
        try:
            embeddings.load(str(index_path))
        except Exception as e:
            print(f"Warning: Could not load existing index: {e}", file=sys.stderr)


# Initialize MCP server
server = Server("forever")


@server.list_tools()
async def list_tools():
    """Return available tools"""
    return [
        Tool(
            name="store_memory",
            description="Store conversation in the index. Chunks content into Q&A pairs.",
            inputSchema={
                "type": "object",
                "properties": {
                    "content": {
                        "type": "string",
                        "description": "Conversation content in Human/Assistant format"
                    },
                    "project": {
                        "type": "string",
                        "description": "Project name (optional)"
                    },
                    "tags": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Tags (optional)"
                    },
                    "chunk": {
                        "type": "boolean",
                        "description": "Whether to chunk into Q&A pairs (default: true)",
                        "default": True
                    }
                },
                "required": ["content"]
            }
        ),
        Tool(
            name="retrieve_memory",
            description="Search past conversations using semantic search",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query"
                    },
                    "n_results": {
                        "type": "integer",
                        "description": "Number of results to return (default: 5)",
                        "default": 5
                    },
                    "threshold": {
                        "type": "number",
                        "description": "Similarity threshold (default: 0.3)",
                        "default": 0.3
                    },
                    "project": {
                        "type": "string",
                        "description": "Filter by project name (optional)"
                    }
                },
                "required": ["query"]
            }
        ),
        Tool(
            name="get_stats",
            description="Get index statistics and configuration info",
            inputSchema={
                "type": "object",
                "properties": {}
            }
        )
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict):
    """Execute a tool"""
    global embeddings

    if embeddings is None:
        init_embeddings()

    if name == "store_memory":
        return await store_memory(
            content=arguments.get("content", ""),
            project=arguments.get("project"),
            tags=arguments.get("tags"),
            chunk=arguments.get("chunk", True)
        )
    elif name == "retrieve_memory":
        return await retrieve_memory(
            query=arguments.get("query", ""),
            n_results=arguments.get("n_results", 5),
            threshold=arguments.get("threshold", 0.3),
            project=arguments.get("project")
        )
    elif name == "get_stats":
        return await get_stats()
    else:
        return [TextContent(type="text", text=f"Unknown tool: {name}")]


async def store_memory(content: str, project: str = None, tags: list = None, chunk: bool = True):
    """Store conversation in index"""
    global embeddings

    timestamp = datetime.now().isoformat()

    if chunk:
        chunks = chunk_conversation(content)
    else:
        chunks = [{
            "id": f"{timestamp}-0",
            "text": content,
            "question": content[:200]
        }]

    if not chunks:
        return [TextContent(type="text", text=json.dumps({
            "success": False,
            "error": "No valid Q&A pairs found in content"
        }))]

    # Add metadata
    documents = []
    for i, c in enumerate(chunks):
        doc_id = c.get("id", f"{timestamp}-{i}")
        doc = {
            "text": c["text"],
            "question": c.get("question", ""),
            "timestamp": timestamp,
            "project": project or "default",
            "tags": ",".join(tags) if tags else "conversation"
        }
        documents.append((doc_id, doc, None))

    # Add to index
    embeddings.upsert(documents)

    # Save index
    index_path = get_index_path()
    embeddings.save(str(index_path))

    return [TextContent(type="text", text=json.dumps({
        "success": True,
        "chunks_stored": len(chunks),
        "timestamp": timestamp
    }))]


async def retrieve_memory(query: str, n_results: int = 5, threshold: float = 0.3, project: str = None):
    """Semantic search"""
    global embeddings

    if embeddings is None or embeddings.count() == 0:
        return [TextContent(type="text", text=json.dumps({
            "results": [],
            "message": "No memories indexed yet"
        }))]

    # Execute search
    results = embeddings.search(query, limit=n_results * 2)  # Get extra for filtering

    formatted = []
    for r in results:
        score = r.get("score", 0)
        if score < threshold:
            continue

        # Project filter
        if project and r.get("project") != project:
            continue

        formatted.append({
            "score": round(score, 4),
            "question": r.get("question", ""),
            "text": r.get("text", ""),
            "timestamp": r.get("timestamp", ""),
            "project": r.get("project", ""),
            "tags": r.get("tags", "")
        })

        if len(formatted) >= n_results:
            break

    return [TextContent(type="text", text=json.dumps({
        "results": formatted,
        "query": query,
        "total_found": len(formatted)
    }))]


async def get_stats():
    """Get index statistics"""
    global embeddings, config, config_source

    if embeddings is None:
        init_embeddings()

    count = embeddings.count() if embeddings else 0

    return [TextContent(type="text", text=json.dumps({
        "total_chunks": count,
        "model": config.get("embeddings", {}).get("path", "unknown"),
        "data_dir": str(get_data_dir()),
        "index_exists": get_index_path().exists(),
        "config_source": config_source
    }))]


async def main():
    """Main entry point"""
    # Note: embeddings are lazily initialized on first tool call
    # to avoid timeout during startup

    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


def run():
    """Entry point (called from pyproject.toml)"""
    import asyncio
    asyncio.run(main())


if __name__ == "__main__":
    run()
