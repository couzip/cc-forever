/**
 * Conversation chunker - Parse Human/Assistant pairs
 */

interface Chunk {
  text: string
  question: string
}

/**
 * Parse conversation into Q&A pairs
 */
export function chunkConversation(content: string): Chunk[] {
  const chunks: Chunk[] = []
  const lines = content.split('\n')

  let currentRole: 'human' | 'assistant' | null = null
  let currentContent: string[] = []
  let humanQuestion = ''

  const rolePattern = /^(Human|User|Assistant|Claude):\s*/i

  for (const line of lines) {
    const match = line.match(rolePattern)

    if (match) {
      const role = match[1].toLowerCase()
      const newRole = role === 'human' || role === 'user' ? 'human' : 'assistant'
      const textAfterRole = line.slice(match[0].length)

      // Save previous content
      if (currentRole === 'human' && currentContent.length > 0) {
        humanQuestion = currentContent.join('\n').trim()
      } else if (currentRole === 'assistant' && humanQuestion && currentContent.length > 0) {
        const answer = currentContent.join('\n').trim()
        if (answer) {
          chunks.push({
            text: `Human: ${humanQuestion}\nAssistant: ${answer}`,
            question: humanQuestion.slice(0, 200),
          })
        }
        humanQuestion = ''
      }

      currentRole = newRole
      currentContent = textAfterRole ? [textAfterRole] : []
    } else if (currentRole) {
      currentContent.push(line)
    }
  }

  // Handle last pair
  if (currentRole === 'assistant' && humanQuestion && currentContent.length > 0) {
    const answer = currentContent.join('\n').trim()
    if (answer) {
      chunks.push({
        text: `Human: ${humanQuestion}\nAssistant: ${answer}`,
        question: humanQuestion.slice(0, 200),
      })
    }
  }

  return chunks
}
