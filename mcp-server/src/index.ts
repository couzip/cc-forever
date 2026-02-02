#!/usr/bin/env node
/**
 * CC-Forever MCP Server
 * Persistent conversation memory with semantic search
 *
 * Uses LanceDB + Transformers.js for lightweight local embeddings
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { VectorStore } from './vectorstore.js'
import { Embedder } from './embedder.js'
import { chunkConversation } from './chunker.js'
import { loadConfig, getDataDir, type Config } from './config.js'

// ============================================
// Types
// ============================================

interface StoreMemoryArgs {
  content: string
  project?: string
  tags?: string[]
  chunk?: boolean
}

interface RetrieveMemoryArgs {
  query: string
  n_results?: number
  threshold?: number
  project?: string
}

interface DeleteMemoryArgs {
  ids?: string[]
  project?: string
  before?: string
  all?: boolean
}

// ============================================
// Main Server
// ============================================

class CCForeverServer {
  private server: Server
  private vectorStore: VectorStore | null = null
  private embedder: Embedder | null = null
  private config: Config | null = null
  private initialized = false

  constructor() {
    this.server = new Server(
      { name: 'cc-forever-mcp', version: '1.0.0' },
      { capabilities: { tools: {} } }
    )

    this.setupHandlers()
  }

  private setupHandlers(): void {
    // List tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'store_memory',
          description:
            "Store Q&A conversation pairs in the memory index. Content MUST include both Human question AND Assistant answer. Example format: 'Human: How do I use OAuth?\\nAssistant: OAuth is an authentication protocol...'",
          inputSchema: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description:
                  "Conversation in 'Human: <question>\\nAssistant: <answer>' format. MUST include both Human and Assistant parts.",
              },
              project: {
                type: 'string',
                description: 'Project name (optional)',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Tags (optional)',
              },
              chunk: {
                type: 'boolean',
                description: 'Whether to chunk into Q&A pairs (default: true)',
                default: true,
              },
            },
            required: ['content'],
          },
        },
        {
          name: 'retrieve_memory',
          description: 'Search past conversations using semantic search',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query',
              },
              n_results: {
                type: 'integer',
                description: 'Number of results to return (default: 5)',
                default: 5,
              },
              threshold: {
                type: 'number',
                description: 'Similarity threshold 0-1 (default: 0.3)',
                default: 0.3,
              },
              project: {
                type: 'string',
                description: 'Filter by project name (optional)',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'get_stats',
          description: 'Get index statistics and configuration info',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'delete_memory',
          description: 'Delete memories from the index. Supports deletion by IDs, project, timestamp, or all.',
          inputSchema: {
            type: 'object',
            properties: {
              ids: {
                type: 'array',
                items: { type: 'string' },
                description: 'Delete by specific IDs',
              },
              project: {
                type: 'string',
                description: 'Delete all memories for a project',
              },
              before: {
                type: 'string',
                description: 'Delete memories before this ISO timestamp (e.g., 2025-01-01T00:00:00Z)',
              },
              all: {
                type: 'boolean',
                description: 'Delete ALL memories (use with caution)',
              },
            },
          },
        },
      ],
    }))

    // Call tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params

      try {
        // Lazy initialization
        if (!this.initialized) {
          await this.initialize()
        }

        switch (name) {
          case 'store_memory':
            return await this.storeMemory(args as unknown as StoreMemoryArgs)
          case 'retrieve_memory':
            return await this.retrieveMemory(args as unknown as RetrieveMemoryArgs)
          case 'get_stats':
            return await this.getStats()
          case 'delete_memory':
            return await this.deleteMemory(args as unknown as DeleteMemoryArgs)
          default:
            return {
              content: [{ type: 'text', text: JSON.stringify({ success: false, error: `Unknown tool: ${name}` }) }],
            }
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `Tool execution failed: ${(error as Error).message}`,
              }),
            },
          ],
        }
      }
    })
  }

  private async initialize(): Promise<void> {
    this.config = loadConfig()
    const dataDir = getDataDir(this.config)

    const modelPath = this.config.embeddings?.path || 'Xenova/all-MiniLM-L6-v2'
    const cacheDir = `${dataDir}/models`

    this.embedder = new Embedder({
      modelPath,
      batchSize: 8,
      cacheDir,
    })

    // Download model on initialization
    console.error('CC-Forever: Downloading embedding model (this may take a moment)...')
    await this.embedder.initialize()

    this.vectorStore = new VectorStore({
      dbPath: `${dataDir}/lancedb`,
      tableName: 'memories',
    })

    await this.vectorStore.initialize()
    this.initialized = true
    console.error('CC-Forever MCP Server initialized')
  }

  private async storeMemory(args: StoreMemoryArgs): Promise<{ content: { type: string; text: string }[] }> {
    const { content, project, tags, chunk = true } = args

    // Validation
    if (!content || !content.trim()) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Content cannot be empty' }) }],
      }
    }

    if (content.length > 100000) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Content too large (max 100KB)' }) }],
      }
    }

    const timestamp = new Date().toISOString()
    const chunks = chunk ? chunkConversation(content) : [{ text: content, question: content.slice(0, 200) }]

    if (chunks.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: "No valid Q&A pairs found in content. Format: 'Human: <question>\\nAssistant: <answer>'",
            }),
          },
        ],
      }
    }

    // Generate embeddings and store
    const documents = []
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i]
      const vector = await this.embedder!.embed(c.text)
      documents.push({
        id: `${timestamp}-${i}`,
        text: c.text,
        question: c.question,
        vector,
        project: project || 'default',
        tags: tags?.join(',') || 'conversation',
        timestamp,
      })
    }

    await this.vectorStore!.insertChunks(documents)

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            chunks_stored: chunks.length,
            timestamp,
          }),
        },
      ],
    }
  }

  private async retrieveMemory(args: RetrieveMemoryArgs): Promise<{ content: { type: string; text: string }[] }> {
    let { query, n_results = 5, threshold = 0.3, project } = args

    // Validation
    if (!query || !query.trim()) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Query cannot be empty' }) }],
      }
    }

    if (query.length > 10000) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Query too long (max 10KB)' }) }],
      }
    }

    // Sanitize
    n_results = Math.min(Math.max(n_results, 1), 100)
    threshold = Math.max(0, Math.min(threshold, 1))

    const queryVector = await this.embedder!.embed(query)
    const results = await this.vectorStore!.search(queryVector, n_results * 2)

    // Filter and format
    const formatted = results
      .filter((r) => {
        // Convert distance to similarity (1 - distance for dot product)
        const similarity = 1 - r.score
        if (similarity < threshold) return false
        if (project && r.project !== project) return false
        return true
      })
      .slice(0, n_results)
      .map((r) => ({
        id: r.id,
        score: Math.round((1 - r.score) * 10000) / 10000,
        question: r.question,
        text: r.text,
        timestamp: r.timestamp,
        project: r.project,
        tags: r.tags,
      }))

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            results: formatted,
            query,
            total_found: formatted.length,
          }),
        },
      ],
    }
  }

  private async getStats(): Promise<{ content: { type: string; text: string }[] }> {
    const status = await this.vectorStore!.getStatus()

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            total_chunks: status.chunkCount,
            model: this.config?.embeddings?.path || 'Xenova/all-MiniLM-L6-v2',
            data_dir: getDataDir(this.config!),
            config_source: this.config?.source || 'default',
          }),
        },
      ],
    }
  }

  private async deleteMemory(args: DeleteMemoryArgs): Promise<{ content: { type: string; text: string }[] }> {
    const { ids, project, before, all } = args

    // Validate: at least one deletion criteria must be specified
    if (!ids && !project && !before && !all) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'At least one deletion criteria must be specified: ids, project, before, or all',
            }),
          },
        ],
      }
    }

    try {
      let deletedCount = 0

      if (all === true) {
        // Delete all memories
        deletedCount = await this.vectorStore!.deleteAll()
      } else if (ids && ids.length > 0) {
        // Delete by specific IDs
        const escapedIds = ids.map((id) => `'${id.replace(/'/g, "''")}'`).join(', ')
        const predicate = `id IN (${escapedIds})`
        deletedCount = await this.vectorStore!.deleteChunks(predicate)
      } else if (project) {
        // Delete by project
        const escapedProject = project.replace(/'/g, "''")
        const predicate = `project = '${escapedProject}'`
        deletedCount = await this.vectorStore!.deleteChunks(predicate)
      } else if (before) {
        // Delete by timestamp
        const escapedBefore = before.replace(/'/g, "''")
        const predicate = `timestamp < '${escapedBefore}'`
        deletedCount = await this.vectorStore!.deleteChunks(predicate)
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              deleted_count: deletedCount,
              criteria: { ids, project, before, all },
            }),
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Failed to delete memories: ${(error as Error).message}`,
            }),
          },
        ],
      }
    }
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport()
    await this.server.connect(transport)
    console.error('CC-Forever MCP Server running on stdio')
  }
}

// ============================================
// Entry Point
// ============================================

async function main(): Promise<void> {
  // Check for subcommand
  const command = process.argv[2]

  if (command === 'auto-index') {
    // Run auto-index CLI
    await import('./auto-index.js')
    return
  }

  // Default: run MCP server
  try {
    const server = new CCForeverServer()
    await server.run()
  } catch (error) {
    console.error('Failed to start CC-Forever MCP Server:', error)
    process.exit(1)
  }
}

main()
