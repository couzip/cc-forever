/**
 * VectorStore implementation with LanceDB
 */

import { type Connection, type Table, connect } from '@lancedb/lancedb'

// ============================================
// Types
// ============================================

export interface VectorStoreConfig {
  dbPath: string
  tableName: string
}

export interface MemoryChunk {
  id: string
  text: string
  question: string
  vector: number[]
  project: string
  tags: string
  timestamp: string
}

export interface SearchResult {
  id: string
  text: string
  question: string
  score: number
  project: string
  tags: string
  timestamp: string
}

// ============================================
// VectorStore Class
// ============================================

export class VectorStore {
  private db: Connection | null = null
  private table: Table | null = null
  private readonly config: VectorStoreConfig

  constructor(config: VectorStoreConfig) {
    this.config = config
  }

  async initialize(): Promise<void> {
    try {
      this.db = await connect(this.config.dbPath)

      const tableNames = await this.db.tableNames()
      if (tableNames.includes(this.config.tableName)) {
        this.table = await this.db.openTable(this.config.tableName)
        console.error(`VectorStore: Opened existing table "${this.config.tableName}"`)
      } else {
        console.error(`VectorStore: Table "${this.config.tableName}" will be created on first insertion`)
      }
    } catch (error) {
      throw new Error(`Failed to initialize VectorStore: ${(error as Error).message}`)
    }
  }

  async insertChunks(chunks: MemoryChunk[]): Promise<void> {
    if (chunks.length === 0) return

    try {
      if (!this.table) {
        if (!this.db) {
          throw new Error('VectorStore is not initialized')
        }
        const records = chunks.map((chunk) => chunk as unknown as Record<string, unknown>)
        this.table = await this.db.createTable(this.config.tableName, records)
        console.error(`VectorStore: Created table "${this.config.tableName}"`)
      } else {
        const records = chunks.map((chunk) => chunk as unknown as Record<string, unknown>)
        await this.table.add(records)
      }

      console.error(`VectorStore: Inserted ${chunks.length} chunks`)
    } catch (error) {
      throw new Error(`Failed to insert chunks: ${(error as Error).message}`)
    }
  }

  async search(queryVector: number[], limit = 10): Promise<SearchResult[]> {
    if (!this.table) {
      return []
    }

    try {
      const results = await this.table
        .vectorSearch(queryVector)
        .distanceType('dot')
        .limit(limit)
        .toArray()

      return results.map((r) => ({
        id: r.id as string,
        text: r.text as string,
        question: r.question as string,
        score: (r._distance as number) ?? 0,
        project: r.project as string,
        tags: r.tags as string,
        timestamp: r.timestamp as string,
      }))
    } catch (error) {
      throw new Error(`Failed to search: ${(error as Error).message}`)
    }
  }

  async getStatus(): Promise<{ chunkCount: number }> {
    if (!this.table) {
      return { chunkCount: 0 }
    }

    try {
      const allRecords = await this.table.query().toArray()
      return { chunkCount: allRecords.length }
    } catch (error) {
      return { chunkCount: 0 }
    }
  }

  async deleteChunks(predicate: string): Promise<number> {
    if (!this.table) {
      throw new Error('Table not initialized')
    }

    try {
      const beforeCount = (await this.table.query().toArray()).length
      await this.table.delete(predicate)
      const afterCount = (await this.table.query().toArray()).length
      const deletedCount = beforeCount - afterCount
      console.error(`VectorStore: Deleted ${deletedCount} chunks`)
      return deletedCount
    } catch (error) {
      throw new Error(`Failed to delete chunks: ${(error as Error).message}`)
    }
  }

  async deleteAll(): Promise<number> {
    if (!this.table) {
      return 0
    }

    try {
      const beforeCount = (await this.table.query().toArray()).length
      await this.table.delete('id IS NOT NULL')
      console.error(`VectorStore: Deleted all ${beforeCount} chunks`)
      return beforeCount
    } catch (error) {
      throw new Error(`Failed to delete all chunks: ${(error as Error).message}`)
    }
  }
}
