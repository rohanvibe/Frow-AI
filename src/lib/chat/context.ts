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

/**
 * Checks whether the user's message is a simple conversational greeting
 * (used to skip unnecessary tool declarations for low latency)
 */
export function isSimpleGreetingPrompt(message?: string, image?: string): boolean {
  if (image) return false
  const prompt = (message || '').toLowerCase().trim()
  return (
    prompt.length < 15 &&
    (prompt === 'hello' ||
      prompt === 'hi' ||
      prompt === 'hey' ||
      prompt === 'hola' ||
      prompt.startsWith('hello ') ||
      prompt.startsWith('hi ') ||
      prompt.startsWith('hey '))
  )
}

/**
 * Filters memories based on active conversation context
 */
function filterMemories(memories: any[], history: any[], message?: string): { memoryPrompt: string } {
  if (!Array.isArray(memories) || memories.length === 0) {
    return { memoryPrompt: '' }
  }

  const userContextStr = (
    history.slice(-3).map((h: any) => h.content || '').join(' ') + ' ' + (message || '')
  ).toLowerCase()

  const filteredMemories = memories
    .map((m: any, i: number) => {
      if (typeof m === 'string' && m.includes('|')) {
        const parts = m.split('|')
        const tag = parts[0].trim()
        const fact = parts.slice(1).join('|').trim()
        return { id: i, tag, fact, raw: m }
      }
      return { id: i, tag: '', fact: m, raw: m }
    })
    .filter(item => {
      if (!item.tag) return true
      if (history.length <= 2) return true
      return (
        userContextStr.includes(item.tag.toLowerCase()) ||
        userContextStr.includes('remember') ||
        userContextStr.includes('forget') ||
        userContextStr.length < 20
      )
    })

  if (filteredMemories.length === 0) {
    return { memoryPrompt: '' }
  }

  const memoryList = filteredMemories.map(m => `[ID: ${m.id}] ${m.raw}`).join('\n')
  const tagList = memories
    .map((m: any) => (typeof m === 'string' && m.includes('|') ? m.split('|')[0].trim() : ''))
    .filter(Boolean)
    .filter((val, i, arr) => arr.indexOf(val) === i)
    .join(', ')

  let memoryPrompt = `ACTIVE MEMORY FACTS:\n${memoryList}`
  if (tagList && filteredMemories.length < memories.length) {
    memoryPrompt += `\n\n(HIDDEN TAGS: ${tagList}. Mention these to load more facts.)`
  }

  return { memoryPrompt }
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
When a user greets you (e.g., "hello", "hey", "hi"), respond warmly and professionally. Suggested greeting: "Hey 👋 I'm ready when you are—what do you want to work on, build, or figure out today?"

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

  const { memoryPrompt } = filterMemories(memories, history, message)

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
    ...history.map((m: any) => ({
      role: m.role,
      content: m.content,
      image: m.images && m.images.length > 0 ? m.images[0] : (m.image || undefined),
      name: m.name || undefined,
      tool_call_id: m.tool_call_id || undefined,
      tool_calls: m.tool_calls || undefined,
    })),
  ]

  // Add the current message if not already present at the end of history
  if (message && (!history.length || history[history.length - 1].content !== message)) {
    if (image) {
      apiMessages.push({
        role: 'user',
        content: message && message.trim() ? message : 'Please describe what you see in this image in detail.',
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
