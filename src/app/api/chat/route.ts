import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Member'
    const userRole = user.app_metadata?.role || 'User'

    // Fetch user personalization
    const { data: profile } = await supabase
      .from('profiles')
      .select('custom_instructions, ai_memory')
      .eq('id', user.id)
      .maybeSingle()

    const { message, messages: history = [], chatId, skipSave, stream: requestedStream = true } = await req.json()

    if (!message && history.length === 0) {
      return NextResponse.json({ error: 'Message or history is required' }, { status: 400 })
    }

    // Format memory if it exists
    let memoryPrompt = ''
    if (profile?.ai_memory) {
       let memories = profile.ai_memory
       if (typeof memories === 'string') {
          try { memories = JSON.parse(memories) } catch (e) {}
       }
       if (Array.isArray(memories) && memories.length > 0) {
          const userContextStr = (history.slice(-3).map((h: any) => h.content).join(' ') + ' ' + (message || '')).toLowerCase()
          
          const filteredMemories = memories.map((m: any, i: number) => {
             if (typeof m === 'string' && m.includes('|')) {
                const parts = m.split('|')
                const tag = parts[0].trim()
                const fact = parts.slice(1).join('|').trim()
                return { id: i, tag, fact, raw: m }
             }
             return { id: i, tag: '', fact: m, raw: m }
          }).filter(item => {
             if (!item.tag) return true 
             // Semantic hint: If the user context is short (new chat), load everything or load related tags
             if (history.length <= 2) return true 
             return userContextStr.includes(item.tag.toLowerCase()) || userContextStr.includes('remember') || userContextStr.includes('forget') || userContextStr.length < 20
          })

          if (filteredMemories.length > 0) {
             const memoryList = filteredMemories.map(m => `[ID: ${m.id}] ${m.raw}`).join('\n')
             const tagList = memories
               .map((m: any) => typeof m === 'string' && m.includes('|') ? m.split('|')[0].trim() : '')
               .filter(Boolean)
               .filter((val, i, arr) => arr.indexOf(val) === i) // unique tags
               .join(', ')

             memoryPrompt = `ACTIVE MEMORY FACTS:\n${memoryList}`
             if (tagList && filteredMemories.length < memories.length) {
                memoryPrompt += `\n\n(HIDDEN TAGS: ${tagList}. Mention these to load more facts.)`
             }
          }
       }
    }

    const systemPrompt = `You are Threadly, an elite AI partner for high-leverage builders. You prioritize systems thinking, execution, and brutal honesty.

### 🧠 CORE PHILOSOPHY
- **Brutal Truth**: 90% of ideas are average. Execution and positioning are everything. If a user's idea is weak, push back and help them refine it into something elite.
- **Systems Thinking**: Connect ideas across domains (business, code, fitness, science). Focus on high-leverage workflows.
- **Instant Understandability**: Use simple, direct language. No academic jargon or corporate "speak".
- **Markdown First**: ALWAYS use bold text, lists, and headings to structure your thoughts. Use ![alt](url) [View Product](url) for visual examples.

### 🗣️ COMMUNICATION STYLE (MANDATORY)
- Use simple, plain English. 
- NEVER use complex words, academic jargon, or corporate "speak".
- Ensure your message is instantly understandable at a first glance.
- Be direct and concise. Avoid long, winding sentences.
- If a simpler word exists, use it. (e.g., use "help" instead of "facilitate").
- ALWAYS use Markdown formatting. Use bold text, lists, and headings to make your answers easy to read. Markdown is your default way of writing.
- **Visuals**: Use Mermaid diagrams for architecture or workflows. 
  - **MERMAID GOLD STANDARD**: 
    1. ALWAYS start with an explicit type like \`graph TD\` or \`flowchart LR\`.
    2. ALWAYS wrap node labels in double quotes (e.g., \`A["My Process (v1)"]\`).
- **NO PLACEHOLDERS**: NEVER use fictional or placeholder URLs (like \`example.com\`). If you need to show an image or product, you MUST use the \`search_web\` tool to find real URLs.
- **CRITICAL**: Unless the user specifically asks for photos with people, always find and show "clean" images (product-only, flat lays, or scenery) that **do NOT contain people**.
- This makes your examples much clearer and easier to use.

### 🧠 MEMORY MANAGEMENT (CRITICAL)
- You MUST be extremely conservative with memory. 
- DEFAULT ACTION: DO NOT SAVE ANYTHING. 
- ONLY trigger [MEMORY_ADD: ...] if the user shares a significant, long-term fact (e.g., "My name is John", "I prefer React over Vue", "My project is called Project X").
- NEVER save greetings, status updates, temporary questions, or casual chat.
- If you are unsure, DO NOT SAVE IT. Saving "junk" or "small talk" will result in system degradation.
- PROHIBITED TAGS: "hello", "greeting", "chat", "initial", "session", "status", "ready", "search", "query".
- Do NOT output phrases like "Memory learned" or "I will remember that" in your natural text. Act completely natural.

### 👤 USER IDENTITY
- Current user: ${userName}
- User Role: ${userRole}
- Use memory facts below to personalize your response without being creepy.

### 📜 CONTEXT & INSTRUCTIONS
${profile?.custom_instructions ? `Custom Response Style: ${profile.custom_instructions}` : ''}
${memoryPrompt}

### 🛠️ MEMORY TOOLS
Use these tags on a single line at the VERY END of your response ONLY when necessary:
- [MEMORY_ADD: <one_word_tag>|<brief fact>]
- [MEMORY_EDIT: <ID> | <new fact>]
- [MEMORY_DELETE: <ID>]`

    // Construct full message history for the AI
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...history.map((m: any) => ({ role: m.role, content: m.content })),
    ]
    
    // Add the current message if it's not already in history
    if (message && (!history.length || history[history.length-1].content !== message)) {
      apiMessages.push({ role: 'user', content: message })
    }

    // Tier-Based Model Routing Logic (Groq Free Tier)
    const prompt = (message || '').toLowerCase()
    const complexKeywords = ['code', 'math', 'mermaid', 'diagram', 'draw', 'visualize', 'prove', 'solve', 'complex', 'analyze', 'search', 'latest', 'news', 'calculate', 'architecture', 'show', 'find']
    
    // Simple greetings should NEVER use tools or 70B to save quota and prevent "empty" responses
    const isSimpleGreeting = (prompt.length < 15 && (prompt.includes('hello') || prompt.includes('hi') || prompt.includes('hey') || prompt.includes('hola'))) || prompt.length < 5
    const isComplex = !isSimpleGreeting && (complexKeywords.some(k => prompt.includes(k)) || prompt.length > 500)
    
    // Model Selection
    const model70B = 'llama-3.3-70b-versatile'
    const model8B = 'llama-3.1-8b-instant'
    const primaryModel = isComplex ? model70B : model8B

    const tools = [
      {
        type: 'function',
        function: {
          name: 'search_web',
          description: 'Search the web for real-time information or news.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string' },
            },
            required: ['query'],
          },
        },
      },
    ]

    // Step 1: Initial call to check for tools (Groq API)
    let aiResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: primaryModel,
        messages: apiMessages,
        // Only send tools if NOT a simple greeting
        tools: isSimpleGreeting ? undefined : tools,
        tool_choice: isSimpleGreeting ? undefined : 'auto',
        temperature: 0.1,
      })
    })

    if (!aiResponse.ok) {
        const errorText = await aiResponse.text()
        console.error('Groq API Error:', errorText)
        
        // Final fallback to 8B if everything fails
        aiResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model: model8B,
            messages: apiMessages,
            stream: requestedStream
          })
        })
        if (!aiResponse.ok) {
           const finalError = await aiResponse.text()
           if (aiResponse.status === 429) {
             return NextResponse.json({ error: "Groq is currently at capacity. Please wait a moment." }, { status: 429 })
           }
           return NextResponse.json({ error: `Groq Error: ${finalError.slice(0, 150)}` }, { status: 500 })
        }
        if (requestedStream) return handleStreaming(aiResponse)
        const data = await aiResponse.json()
        return NextResponse.json({ content: data.choices[0].message.content })
    }

    const data = await aiResponse.json()
    const messageObj = data.choices[0].message

    // Fallback for empty content
    if (!messageObj.content && (!messageObj.tool_calls || messageObj.tool_calls.length === 0)) {
       messageObj.content = isSimpleGreeting ? "Hello! How can I help you build today?" : "I'm ready. What would you like to build or analyze?"
    }

    // Step 2: Handle Tool Calls (Multiple)
    if (messageObj.tool_calls && messageObj.tool_calls.length > 0) {
      const toolCalls = messageObj.tool_calls
      apiMessages.push(messageObj)

      for (const toolCall of toolCalls) {
        if (toolCall.function.name === 'search_web') {
          try {
            const { query } = JSON.parse(toolCall.function.arguments)
            const { searchWeb } = await import('@/utils/search')
            const searchResult = await searchWeb(query)

            apiMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: 'search_web',
              content: searchResult,
            })
          } catch (e) {
            console.error('Tool execution failed:', e)
          }
        }
      }

      // Final call after all tools are executed
      const finalResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: model70B, 
          messages: apiMessages,
          stream: true
        })
      })

      if (!finalResponse.ok) throw new Error('Groq final stream failed')
      return handleStreaming(finalResponse)
    }

    // Step 2.5: Catch "hallucinated" text-based function calls (e.g. <function=...>)
    const rawTagMatch = messageObj.content?.match(/<function=([^>]+)>/i)
    if (rawTagMatch) {
       console.log('Caught hallucinated function tag:', rawTagMatch[1])
       try {
         const tagContent = rawTagMatch[1]
         const toolName = tagContent.split('{')[0].trim()
         const toolArgs = tagContent.slice(toolName.length)
         
         if (toolName === 'search_web') {
            const { query } = JSON.parse(toolArgs)
            const { searchWeb } = await import('@/utils/search')
            const searchResult = await searchWeb(query)
            
            apiMessages.push({ role: 'assistant', content: messageObj.content.replace(/<function=[^>]+>/g, '') })
            apiMessages.push({ role: 'user', content: `Search Result for "${query}": ${searchResult}` })
            
            const finalResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
              },
              body: JSON.stringify({
                model: model70B, 
                messages: apiMessages,
                stream: true
              })
            })
            return handleStreaming(finalResponse)
         }
       } catch (e) {
         console.error('Hallucinated tag parsing failed:', e)
       }
    }

    // Step 3: No tool used, just return content or stream
    if (!requestedStream) {
      return NextResponse.json({ content: messageObj.content })
    }

    const encoder = new TextEncoder()
    const content = messageObj.content || ''
    
    const manualStream = new ReadableStream({
      async start(controller) {
        // Stream character by character or word by word for better effect
        const words = content.split(' ')
        for (let i = 0; i < words.length; i++) {
          controller.enqueue(encoder.encode(words[i] + (i === words.length - 1 ? '' : ' ')))
          await new Promise(r => setTimeout(r, 15))
        }
        controller.close()
      }
    })

    return new Response(manualStream, {
      headers: { 'Content-Type': 'text/event-stream' }
    })
    return new Response(manualStream, {
      headers: { 'Content-Type': 'text/event-stream' }
    })
  } catch (error: any) {
    console.error('Chat API Error:', error)
    return NextResponse.json({ error: 'fetch failed', details: error.message }, { status: 500 })
  }
}

// Helper to handle streaming logic
async function handleStreaming(response: Response) {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body?.getReader()
      if (!reader) {
        controller.close()
        return
      }

      let buffer = ''
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || trimmed === 'data: [DONE]') continue
            
            if (trimmed.startsWith('data: ')) {
              try {
                const json = JSON.parse(trimmed.slice(6))
                const content = json.choices[0]?.delta?.content || ''
                if (content) {
                  controller.enqueue(encoder.encode(content))
                }
              } catch (e) {}
            }
          }
        }
      } catch (error) {
        controller.error(error)
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' }
  })
}


