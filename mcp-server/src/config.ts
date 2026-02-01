/**
 * Configuration loader
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

export interface Config {
  embeddings?: {
    path?: string
  }
  data_dir?: string
  auto_index?: boolean
  source?: string
}

/**
 * Load config with priority:
 * 1. Project-level: ./.forever/config.yml
 * 2. User-level: ~/.forever/config.yml
 * 3. Default settings
 *
 * data_dir is automatically set to the directory containing the config file
 */
export function loadConfig(): Config {
  // Priority 1: Project-level
  const projectDir = path.join(process.cwd(), '.forever')
  const projectConfig = path.join(projectDir, 'config.yml')
  if (fs.existsSync(projectConfig)) {
    return {
      ...parseYaml(projectConfig),
      data_dir: projectDir,
      source: projectConfig,
    }
  }

  // Priority 2: User-level
  const userDir = path.join(os.homedir(), '.forever')
  const userConfig = path.join(userDir, 'config.yml')
  if (fs.existsSync(userConfig)) {
    return {
      ...parseYaml(userConfig),
      data_dir: userDir,
      source: userConfig,
    }
  }

  // Priority 3: Default (user-level)
  return {
    embeddings: { path: 'Xenova/all-MiniLM-L6-v2' },
    data_dir: path.join(os.homedir(), '.forever'),
    source: 'default',
  }
}

/**
 * Simple YAML parser (handles basic key: value pairs)
 */
function parseYaml(filePath: string): Config {
  const content = fs.readFileSync(filePath, 'utf-8')
  const config: Record<string, unknown> = {}

  let currentSection = ''

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    // Check indentation for nested values
    const indent = line.length - line.trimStart().length

    if (indent === 0 && trimmed.includes(':')) {
      const [key, ...valueParts] = trimmed.split(':')
      const value = valueParts.join(':').trim()

      if (value) {
        config[key.trim()] = parseValue(value)
        currentSection = ''
      } else {
        currentSection = key.trim()
        config[currentSection] = {}
      }
    } else if (indent > 0 && currentSection && trimmed.includes(':')) {
      const [key, ...valueParts] = trimmed.split(':')
      const value = valueParts.join(':').trim()
      ;(config[currentSection] as Record<string, unknown>)[key.trim()] = parseValue(value)
    }
  }

  return config as Config
}

function parseValue(value: string): string | boolean | number {
  if (value.toLowerCase() === 'true') return true
  if (value.toLowerCase() === 'false') return false
  if (/^\d+$/.test(value)) return parseInt(value, 10)
  if (/^\d+\.\d+$/.test(value)) return parseFloat(value)
  return value.replace(/^["']|["']$/g, '')
}

/**
 * Get data directory path
 */
export function getDataDir(config: Config): string {
  const dir = config.data_dir || path.join(os.homedir(), '.forever')
  const expanded = dir.startsWith('~') ? dir.replace('~', os.homedir()) : dir

  if (!fs.existsSync(expanded)) {
    fs.mkdirSync(expanded, { recursive: true })
  }

  return expanded
}
