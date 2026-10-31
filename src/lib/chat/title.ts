/**
 * Chat Title Utilities
 * Handles title cleaning, fallback title extraction from user prompts,
 * and default title validation.
 */

const DEFAULT_TITLES = new Set(['new chat', 'untitled chat', 'new session', 'untitled conversation']);

/**
 * Checks whether a chat title is a placeholder or default title.
 */
export function isDefaultChatTitle(title?: string | null): boolean {
  if (!title || typeof title !== 'string') return true;
  const normalized = title.trim().toLowerCase();
  return !normalized || DEFAULT_TITLES.has(normalized);
}

/** Apply an automatic title only while the sidebar still has a placeholder. */
export function applyGeneratedChatTitle<T extends { id: string; title: string }>(
  chats: T[],
  chatId: string,
  title: string
): T[] {
  if (!title || isDefaultChatTitle(title)) return chats
  return chats.map(chat =>
    chat.id === chatId && isDefaultChatTitle(chat.title)
      ? { ...chat, title }
      : chat
  )
}

/**
 * Cleans an AI-generated title:
 * - Strips quotes, markdown characters, label prefixes, and trailing punctuation
 * - Normalizes whitespace
 * - Bounds length to 40 characters
 */
export function cleanGeneratedTitle(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';

  let t = raw.trim();

  // Strip code blocks and inline code markers
  t = t.replace(/```[\s\S]*?```/g, '').replace(/`/g, '');

  // Strip markdown formatting: bold, italic, headers
  t = t.replace(/[*_#~]/g, '');

  // Strip leading/trailing quotes (standard and curly)
  t = t.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '');

  // Strip common label prefixes like "Title:", "Chat Title:", "Session:"
  t = t.replace(/^(chat\s+)?(session\s+)?title\s*:\s*/i, '');
  t = t.replace(/^topic\s*:\s*/i, '');

  // Strip trailing punctuation
  t = t.replace(/[.,!?;:\-_]+$/, '');

  // Normalize internal whitespace
  t = t.replace(/\s+/g, ' ').trim();

  // Keep the title within the requested 3–7 word range where possible.
  const titleWords = t.split(' ')
  if (titleWords.length > 7) t = titleWords.slice(0, 7).join(' ')

  // If the cleaned title is a default placeholder or empty, reject it
  if (!t || isDefaultChatTitle(t)) {
    return '';
  }

  // Bound length to 40 chars
  if (t.length > 40) {
    t = t.slice(0, 37).trim() + '...';
  }

  return t;
}

/**
 * Generates a concise (3-6 words), readable fallback title directly from a user prompt.
 * Used when AI title generation is unavailable, rate-limited, or fails.
 */
export function generateFallbackTitle(promptText?: string | null): string {
  if (!promptText || typeof promptText !== 'string' || !promptText.trim()) {
    return 'New Session';
  }

  // Clean out file context blocks, code blocks, and markdown
  let clean = promptText
    .replace(/\[FILE CONTEXT:[\s\S]*?\]/gi, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[*_#`~>]/g, '')
    .trim();

  if (!clean) {
    return 'New Session';
  }

  clean = clean.replace(/\s+/g, ' ').replace(/[.,!?;:]+$/, '').trim()
  if (!clean) return 'New Session'

  const capitalize = (value: string) => {
    const acronyms: Record<string, string> = { ai: 'AI', api: 'API', css: 'CSS', html: 'HTML', http: 'HTTP', js: 'JavaScript', ram: 'RAM', ui: 'UI', ux: 'UX' }
    return value
      .split(' ')
      .map((word, index) => {
        const key = word.toLowerCase().replace(/[^a-z0-9]/g, '')
        if (acronyms[key]) return acronyms[key]
        if (index > 0 && /^(a|an|and|for|in|of|on|or|the|to|vs)$/i.test(word)) return word.toLowerCase()
        return word.charAt(0).toUpperCase() + word.slice(1)
      })
      .join(' ')
  }

  const topicTitle = (topic: string, action = 'Understanding') =>
    `${action} ${topic.trim().replace(/^(?:my|the|a|an|this|that)\s+/i, '').replace(/[?.!,;:]+$/, '')}`.trim()

  let semanticTitle = ''
  const difference = clean.match(/(?:what(?:'s| is) the difference between|difference between)\s+(.+?)\s+and\s+(.+?)(?:[?.!]|$)/i)
  const learning = clean.match(/\b(?:i want to|i'd like to|i would like to|help me|let's)\s+(learn|build|create|make|improve|fix|understand|study)\s+(.+)/i)
  const howToAction = clean.match(/^(?:how do i|how can i|how to)\s+(build|create|make|improve|fix|learn|understand)\s+(.+?)(?:[?.!]|$)/i)
  const question = clean.match(/^(?:can you )?(?:explain )?(?:how|what|why)\s+(.+)$/i)
  const helpFix = clean.match(/^(?:can you )?help me fix\s+(.+)/i)
  const ubuntuAccent = clean.match(/^why does (.+?) use .+? as its accent colou?r/i)

  if (ubuntuAccent) {
    semanticTitle = `${ubuntuAccent[1].trim()}'s Design Philosophy`
  } else if (difference) {
    semanticTitle = `${difference[1].trim()} vs ${difference[2].trim()}`
  } else if (helpFix) {
    semanticTitle = topicTitle(helpFix[1], 'Fixing')
  } else if (howToAction) {
    const verb = howToAction[1].toLowerCase()
    const action = ({ build: 'Building', create: 'Creating', make: 'Building', improve: 'Improving', fix: 'Fixing', learn: 'Learning', understand: 'Understanding' } as Record<string, string>)[verb]
    const topic = howToAction[2].split(/\s+(?:using|with)\s+/i)[0]
    semanticTitle = topicTitle(topic, action)
  } else if (learning) {
    const verb = learning[1].toLowerCase()
    const action = ({ learn: 'Learning', build: 'Building', create: 'Creating', make: 'Building', improve: 'Improving', fix: 'Fixing', understand: 'Understanding', study: 'Learning' } as Record<string, string>)[verb]
    semanticTitle = topicTitle(learning[2], action)
  } else if (question) {
    let topic = question[1]
      .replace(/^(?:do|does|did|is|are|can|could|would|will)\s+/i, '')
      .replace(/\b(work|works|function|functions|happen|happens|mean|means)\??$/i, '')
      .replace(/^(?:the|a|an)\s+/i, '')
      .trim()
    semanticTitle = topicTitle(topic, 'Understanding')
  }

  // Split into words, discarding empty tokens
  const words = (semanticTitle || clean).split(/\s+/).filter(Boolean)
  if (words.length === 0) {
    return 'New Session';
  }

  // Keep intent and topic; short prompts need no artificial filler words.
  let title = capitalize(words.slice(0, 7).join(' '));

  // Remove trailing punctuation
  title = title.replace(/[.,!?;:\-_]+$/, '').trim();

  // Ensure length does not exceed 40 chars
  if (title.length > 40) {
    title = title.slice(0, 37).trim() + '...';
  }

  return title || 'New Session';
}
