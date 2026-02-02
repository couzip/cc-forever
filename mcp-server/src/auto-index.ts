#!/usr/bin/env node
/**
 * Auto-index CLI for Stop hook
 *
 * Automatically indexes the last Q&A pair when Claude's response completes.
 *
 * Usage: npx cc-forever-mcp auto-index
 *
 * Input (stdin JSON):
 * - session_id: string
 * - transcript_path: string
 * - cwd: string
 * - stop_hook_active: boolean (true if this is a Stop hook response)
 */

import { readFileSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import { loadConfig, getDataDir } from './config.js'
import { Embedder } from './embedder.js'
import { VectorStore } from './vectorstore.js'

interface HookInput {
  session_id?: string
  transcript_path?: string
  cwd?: string
  stop_hook_active?: boolean
}

interface Message {
  type: string
  message?: {
    role?: string
    content?: string | Array<{ type: string; text?: string }>
  }
}

interface QAPair {
  question: string
  text: string
}

/**
 * Read JSON from stdin
 */
async function readStdin(): Promise<HookInput> {
  return new Promise((resolve, reject) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk: string) => { data += chunk })
    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(data))
      } catch {
        reject(new Error('Invalid JSON input'))
      }
    })
    process.stdin.on('error', reject)
  })
}

/**
 * Read JSONL transcript file and extract messages
 */
function readTranscript(transcriptPath: string): Message[] {
  if (!existsSync(transcriptPath)) {
    return []
  }

  const content = readFileSync(transcriptPath, 'utf-8')
  const messages: Message[] = []

  for (const line of content.split('\n')) {
    if (!line.trim()) continue
    try {
      messages.push(JSON.parse(line))
    } catch {
      // Skip invalid JSON lines
    }
  }

  return messages
}

/**
 * Extract text content from message.content array
 */
function extractTextContent(content: string | Array<{ type: string; text?: string }> | undefined): string {
  if (!content) return ''

  if (typeof content === 'string') return content

  if (Array.isArray(content)) {
    return content
      .filter(c => typeof c === 'object' && c.type === 'text' && c.text)
      .map(c => c.text)
      .join(' ')
  }

  return ''
}

/**
 * Extract the last Q&A pair from messages
 */
function extractLastQAPair(messages: Message[]): QAPair | null {
  // Filter to only user/assistant messages
  const conversationMessages = messages.filter(msg =>
    msg.type === 'user' || msg.type === 'assistant'
  )

  // Find the last user message with actual text content
  let lastUserIndex = -1
  let lastUserContent = ''

  for (let i = conversationMessages.length - 1; i >= 0; i--) {
    const msg = conversationMessages[i]

    if (msg.type === 'user') {
      const content = extractTextContent(msg.message?.content)
      if (content && !content.includes('[Request interrupted')) {
        lastUserIndex = i
        lastUserContent = content
        break
      }
    }
  }

  if (lastUserIndex === -1 || !lastUserContent) {
    return null
  }

  // Find the assistant response after the user message
  let assistantContent = ''

  for (let i = lastUserIndex + 1; i < conversationMessages.length; i++) {
    const msg = conversationMessages[i]

    if (msg.type === 'assistant') {
      const content = extractTextContent(msg.message?.content)
      if (content) {
        assistantContent += content + '\n'
      }
    } else if (msg.type === 'user') {
      break
    }
  }

  assistantContent = assistantContent.trim()

  if (!assistantContent) {
    return null
  }

  // Truncate if too long
  const maxLength = 2000
  if (assistantContent.length > maxLength) {
    assistantContent = assistantContent.slice(0, maxLength) + '...'
  }

  return {
    question: lastUserContent.slice(0, 200),
    text: `Human: ${lastUserContent}\nAssistant: ${assistantContent}`
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const DEBUG = process.env.CC_FOREVER_DEBUG === '1'

  try {
    // Read hook input from stdin
    const input = await readStdin()

    if (DEBUG) {
      console.error(`[cc-forever] Hook input: ${JSON.stringify(input, null, 2)}`)
    }

    // Check stop_hook_active to prevent infinite loop
    if (input.stop_hook_active) {
      if (DEBUG) console.error('[cc-forever] Skipped: stop_hook_active is true')
      return
    }

    // Load config
    const config = loadConfig()

    if (DEBUG) {
      console.error(`[cc-forever] Config: auto_index=${config.auto_index}, source=${config.source}`)
    }

    // Check if auto_index is enabled (default OFF)
    if (!config.auto_index) {
      if (DEBUG) console.error('[cc-forever] Skipped: auto_index is not enabled')
      return
    }

    // Get transcript path
    const transcriptPath = input.transcript_path
    if (!transcriptPath || !existsSync(transcriptPath)) {
      if (DEBUG) console.error(`[cc-forever] Skipped: transcript not found at ${transcriptPath}`)
      return
    }

    // Read transcript
    const messages = readTranscript(transcriptPath)
    if (messages.length === 0) {
      return
    }

    // Extract last Q&A pair
    const qaPair = extractLastQAPair(messages)
    if (!qaPair) {
      return
    }

    // Initialize embedder and vector store
    const dataDir = getDataDir(config)
    const modelPath = config.embeddings?.path || 'Xenova/all-MiniLM-L6-v2'

    const embedder = new Embedder({
      modelPath,
      batchSize: 32,
      cacheDir: join(dataDir, 'models')
    })

    const vectorStore = new VectorStore({
      dbPath: join(dataDir, 'lancedb'),
      tableName: 'memories'
    })

    await embedder.initialize()
    await vectorStore.initialize()

    // Generate embedding
    const vector = await embedder.embed(qaPair.text)

    // Create chunk
    const timestamp = new Date().toISOString()
    const project = basename(input.cwd || process.cwd())
    const sessionId = input.session_id || 'unknown'

    const chunk = {
      id: `${sessionId}-${Date.now()}`,
      text: qaPair.text,
      question: qaPair.question,
      vector,
      project,
      tags: 'auto-indexed',
      timestamp
    }

    // Insert chunk
    await vectorStore.insertChunks([chunk])

    console.error(`[cc-forever] Auto-indexed 1 Q&A pair`)

    // Allow LanceDB to cleanup properly before exit
    await new Promise(resolve => setTimeout(resolve, 100))

  } catch (error) {
    // Log error but don't fail the hook
    console.error(`[cc-forever] Auto-index error: ${(error as Error).message}`)
  }
}

main()
