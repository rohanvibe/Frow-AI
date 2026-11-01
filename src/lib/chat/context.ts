// Chat context, memory filtering, and prompt generation
import { SupabaseClient } from '@supabase/supabase-js'

export interface ChatContextOptions {
  imageGenerationSucceeded: boolean
  imageGenerationFailed: boolean
}

export interface BuiltChatContext {
  apiMessages: any[]
  isSimpleGreeting: boolean
}

export type ClientHistoryMessage = {
  role: 'user' | 'assistant'
  content: string
  image?: string
}

const MAX_CHAT_MESSAGE_LENGTH = 50_000
const MAX_HISTORY_MESSAGES = 20
const MAX_IMAGE_DATA_URL_LENGTH = 20_000_000

export function isValidChatMessageContent(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_CHAT_MESSAGE_LENGTH
}

export function isValidImageDataUrl(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= MAX_IMAGE_DATA_URL_LENGTH &&
    /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/]+={0,2}$/i.test(value)
  )
}

/** Keep only plain user/assistant text and supported image data from the client. */
export function sanitizeClientChatHistory(history: unknown): ClientHistoryMessage[] {
  if (!Array.isArray(history)) return []

  return history
    .slice(-MAX_HISTORY_MESSAGES)
    .flatMap((entry: any): ClientHistoryMessage[] => {
      if (
        !entry ||
        typeof entry !== 'object' ||
        Array.isArray(entry) ||
        (entry.role !== 'user' && entry.role !== 'assistant') ||
        !isValidChatMessageContent(entry.content)
      ) {
        return []
      }

      const candidateImage = Array.isArray(entry.images) ? entry.images[0] : entry.image
      const image = isValidImageDataUrl(candidateImage) ? candidateImage : undefined
      return [{ role: entry.role, content: entry.content, ...(image ? { image } : {}) }]
    })
}

/**
 * Checks whether the user's message is a simple conversational greeting
 * (used to skip unnecessary tool declarations for low latency)
 */
export function isSimpleGreetingPrompt(message?: string, image?: string): boolean {
  if (image) return false
  const prompt = (message || '').toLowerCase().trim()
  return /^(hello|hi|hey|hola)( there)?[!.?]*$/i.test(prompt)
}

import { retrieveRelevantMemories } from './memory'

/**
 * Filters and ranks memories based on query relevance and recency.
 * (Backwards-compatible wrapper around retrieveRelevantMemories)
 */
export function filterMemories(
  memories: any[],
  history: any[],
  message?: string
): { memoryPrompt: string; hiddenTags?: string[] } {
  return retrieveRelevantMemories(memories, message, history)
}

/**
 * Builds the comprehensive Frow AI system prompt
 */
export function buildSystemPrompt(params: {
  userName: string
  userRole: string
  customInstructions?: string
  memoryPrompt?: string
  imageGenerationSucceeded: boolean
  imageGenerationFailed: boolean
}): string {
  const {
    userName,
    userRole,
    customInstructions,
    memoryPrompt,
    imageGenerationSucceeded,
    imageGenerationFailed,
  } = params

  return `You are Frow, an elite AI partner for high-leverage builders. You prioritize systems thinking, execution, and brutal honesty.
When a user sends only a greeting (e.g., "hello", "hey", "hi"), respond warmly and briefly. Do not use a canned welcome message when the user asks a question or gives a task.

### COPYRIGHT & REPRODUCTION
- Do not provide entire copyrighted works or substantial verbatim portions, including lyrics, books, stories, articles, scripts, poems, or paid educational materials.
- Brief quotations, summaries, explanations, reviews, analysis, discussion, and genuinely transformative responses are allowed.
- Original work and public-domain works are allowed. If asked for substantial reproduction, briefly refuse and offer a summary or explanation instead.

### 🧠 CORE PHILOSOPHY
- **Brutal Truth**: 90% of ideas are average. Execution and positioning are everything. If a user's idea is weak, push back and help them refine it into something elite.
- **Systems Thinking**: Connect ideas across domains (business, code, fitness, science). Focus on high-leverage workflows.
- **Instant Understandability**: Use simple, direct language. No academic jargon or corporate "speak".
- **Natural Conversation**: Respond naturally and cleanly. Do not overuse tables, bold text, or heavy formatting unless the user explicitly asks for structure or it significantly improves understanding. Simple questions should get simple, easy-to-read answers.
- **Visuals**: ${
  imageGenerationSucceeded
    ? 'The system has ALREADY generated the image below — briefly confirm you generated it (e.g. "Here\'s your generated image of [topic] 🎨"). Do NOT say you are finding it.'
    : imageGenerationFailed
    ? 'Image generation was attempted but failed. Tell the user honestly: "I wasn\'t able to generate that image right now — try a simpler prompt or ask me to show you a photo instead." Do NOT say you are finding it.'
    : 'The system handles image searching automatically. If the user asks to "show", "find", or "search" for an image, acknowledge that you are finding it. Do NOT generate image markdown yourself; the system injects real photos automatically.'
}

### 🧠 MEMORY MANAGEMENT (CRITICAL)
- You MUST be extremely conservative with memory. 
- DEFAULT ACTION: DO NOT SAVE ANYTHING. 
- ONLY trigger [MEMORY_ADD: ...] if the user shares a significant, long-term fact.
- NEVER save greetings, status updates, temporary questions, or casual chat.
- PROHIBITED TAGS: "hello", "greeting", "chat", "initial", "session", "status", "ready", "search", "query".

### 👤 USER IDENTITY
- Current user: ${userName}
- User Role: ${userRole}

### 📜 CONTEXT & INSTRUCTIONS
${customInstructions ? `Custom Response Style: ${customInstructions}` : ''}
${memoryPrompt || ''}

### 🛠️ TOOLS & INSTRUMENTS
1. **Visual Engine**: Handled automatically. Do NOT generate image markdown.
2. **Interactive Calculator**: You MUST use the calculator for ALL mathematical operations. 
   - **Rule**: Do NOT provide the numerical result in your text response. Let the calculator show the answer.
   - **Format (Triple Backticks)**:
   \`\`\`calculator
   518 * 12 - 24 + 56
   \`\`\`
3. **Python Sandbox**: For simulations or scripts, use:
   \`\`\`python
   <code>
   \`\`\`

### 🧠 MEMORY TOOLS
Use these tags ONLY for long-term facts.
- [MEMORY_ADD: <tag>|<fact>]
- [MEMORY_EDIT: <ID> | <fact>]
- [MEMORY_DELETE: <ID>]

### 🚫 PROHIBITIONS
- NEVER include "Verification" or "ID" numbers in your response unless editing/deleting a memory.
- NEVER explain that you are using a tool; just use it.
- CRITICAL: NEVER use function-calling or JSON tool format for Python or Calculator. You MUST output raw markdown code blocks (e.g. \`\`\`python\n<code>\n\`\`\`). The only valid JSON tool you can call is search_web.
- Keep responses elite, concise, and focused on execution.
`
}

/**
 * Loads user profile, filters memories, and constructs the API message list
 */
export async function buildChatContext(
  supabase: SupabaseClient,
  user: any,
  history: any[] = [],
  message?: string,
  image?: string,
  options: ChatContextOptions = { imageGenerationSucceeded: false, imageGenerationFailed: false }
): Promise<BuiltChatContext> {
  const safeHistory = sanitizeClientChatHistory(history)
  const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Member'
  const userRole = user.app_metadata?.role || 'User'

  // Fetch user personalization
  const { data: profile } = await supabase
    .from('profiles')
    .select('custom_instructions, ai_memory')
    .eq('id', user.id)
    .maybeSingle()

  let memories = profile?.ai_memory
  if (typeof memories === 'string') {
    try {
      memories = JSON.parse(memories)
    } catch (e) {}
  }

  const { memoryPrompt } = filterMemories(memories, safeHistory, message)

  const systemPrompt = buildSystemPrompt({
    userName,
    userRole,
    customInstructions: profile?.custom_instructions,
    memoryPrompt,
    imageGenerationSucceeded: options.imageGenerationSucceeded,
    imageGenerationFailed: options.imageGenerationFailed,
  })

  const apiMessages: any[] = [
    { role: 'system', content: systemPrompt },
    ...safeHistory,
  ]

  // Add the current message if not already present at the end of history
  const currentMessageIsLastUserTurn =
    safeHistory[safeHistory.length - 1]?.role === 'user' &&
    safeHistory[safeHistory.length - 1]?.content === message
  if ((message || image) && !currentMessageIsLastUserTurn) {
    if (image) {
      apiMessages.push({
        role: 'user',
        content: message?.trim() ? message : 'Please describe what you see in this image in detail.',
        image,
      })
    } else {
      apiMessages.push({ role: 'user', content: message })
    }
  }

  const isSimpleGreeting = isSimpleGreetingPrompt(message, image)

  return {
    apiMessages,
    isSimpleGreeting,
  }
}
