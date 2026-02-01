/**
 * Embedder implementation with Transformers.js
 */

import { env, pipeline } from '@huggingface/transformers'

// ============================================
// Types
// ============================================

export interface EmbedderConfig {
  modelPath: string
  batchSize: number
  cacheDir: string
}

// ============================================
// Embedder Class
// ============================================

export class Embedder {
  private model: unknown = null
  private initPromise: Promise<void> | null = null
  private readonly config: EmbedderConfig

  constructor(config: EmbedderConfig) {
    this.config = config
  }

  async initialize(): Promise<void> {
    if (this.model) return

    try {
      env.cacheDir = this.config.cacheDir
      console.error(`Embedder: Loading model "${this.config.modelPath}"...`)
      this.model = await pipeline('feature-extraction', this.config.modelPath)
      console.error('Embedder: Model loaded successfully')
    } catch (error) {
      throw new Error(`Failed to initialize Embedder: ${(error as Error).message}`)
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.model) return

    if (this.initPromise) {
      await this.initPromise
      return
    }

    console.error('Embedder: First use detected. Loading model (may take 1-2 minutes on first run)...')

    this.initPromise = this.initialize().catch((error) => {
      this.initPromise = null
      throw error
    })

    await this.initPromise
  }

  async embed(text: string): Promise<number[]> {
    await this.ensureInitialized()

    if (text.length === 0) {
      throw new Error('Cannot generate embedding for empty text')
    }

    try {
      const options = { pooling: 'mean', normalize: true }
      const modelCall = this.model as (
        text: string,
        options: unknown
      ) => Promise<{ data: Float32Array }>
      const output = await modelCall(text, options)
      return Array.from(output.data)
    } catch (error) {
      throw new Error(`Failed to generate embedding: ${(error as Error).message}`)
    }
  }

}
