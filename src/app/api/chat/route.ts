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

    // PHASE 1: Deterministic Intent Detection (Runs BEFORE LLM)
    const { detectImageIntent, fetchVerifiedImages } = await import('@/utils/image-engine')
    const imageIntent = detectImageIntent(message || '')
    let detectedImages: any[] = []
    
    if (imageIntent) {
      console.log(`[Deterministic Flow] Image intent detected for: ${imageIntent.query} (Limit: ${imageIntent.limit})`)
      detectedImages = await fetchVerifiedImages(imageIntent.query, imageIntent.limit)
    }

    // Format memory if it exists (Robust Memory System v2)
    let memoryPrompt = ''
    if (profile?.ai_memory) {
       let memories = Array.isArray(profile.ai_memory) ? profile.ai_memory : []
       if (memories.length > 0) {
          const userContextStr = (history.slice(-5).map((h: any) => h.content).join(' ') + ' ' + (message || '')).toLowerCase()
          
          // 3-LAYER RETRIEVAL & DECAY FILTER
          const now = new Date()
          const filteredMemories = memories.map((m: any, i: number) => {
             // Basic format check
             if (typeof m === 'string') return { id: i, content: m, type: 'general', confidence: 0.5 }
             return { ...m, id: m.id || i }
          }).filter(m => {
             // 🎯 Decision Filter: Load relevant context or high-confidence persistent memory
             const isRelevant = userContextStr.includes((m.tag || '').toLowerCase()) || 
                                userContextStr.includes(m.content.toLowerCase()) ||
                                userContextStr.includes('remember') ||
                                history.length < 3
             
             const isHighConfidence = (m.confidence || 0) > 0.8
             return isRelevant || isHighConfidence
          }).sort((a, b) => (b.confidence || 0) - (a.confidence || 0))

          if (filteredMemories.length > 0) {
             const memoryList = filteredMemories.map(m => {
                const typeTag = m.type ? `[${m.type.toUpperCase()}]` : ''
                const conf = m.confidence ? `(Conf: ${Math.round(m.confidence * 100)}%)` : ''
                return `ID: ${m.id} | ${typeTag} ${m.content} ${conf}`
             }).join('\n')

             memoryPrompt = `\n### 🧠 PERSISTENT MEMORY (LONG-TERM)\nOnly use these if relevant to the current objective:\n${memoryList}\n`
          }
       }
    }

    const systemPrompt = `You are Threadly, an elite AI partner for high-leverage builders. You prioritize systems thinking, execution, and brutal honesty.

### 🧠 ROBUST MEMORY SYSTEM (3-LAYER ARCHITECTURE)
You maintain a 3-layer memory system. Do NOT save everything. Storing less but storing the right things is the goal.

1. **Ephemeral Context**: Recent messages (already in history). Do NOT save this.
2. **Working Memory**: Session-level goals or temporary constraints. Use these during the conversation but do NOT persist them unless they become stable.
3. **Persistent Memory**: High-value, stable data.

### 🎯 THE DECISION FILTER (WHEN TO SAVE)
✅ **SAVE/UPSERT** if information is:
- **Stable**: "I am a founder", "I live in Tokyo".
- **Repeated Behavior**: User consistently asks for brutal feedback.
- **Preferences**: "I hate jargon", "I prefer Python over Node".
- **Long-term Goals**: "I'm building a SaaS for 10k users".

❌ **DO NOT SAVE** if:
- One-time questions, greetings, temporary situations, or casual chat.
- Easily inferable next time.
- Low impact ("I ate pizza today").

### 🛠️ MEMORY TOOLS (SILENT BACKEND)
Use these tags ONLY at the absolute end of your response. 
**CRITICAL**: NEVER mention that you are saving, updating, or deleting memory in your natural language response. The user should NOT see or hear about the memory process. It is a silent backend operation.
- [MEMORY_UPSERT: <type> | <content>] 
- [MEMORY_INCREMENT: <ID>]
- [MEMORY_DELETE: <ID>]

### 👤 USER IDENTITY
- Current user: ${userName}
- User Role: ${userRole}

### 📜 CONTEXT & CUSTOM INSTRUCTIONS
${profile?.custom_instructions ? `Custom Response Style: ${profile.custom_instructions}` : ''}
${memoryPrompt}

### 🧠 CORE PHILOSOPHY
- **Brutal Truth**: Push back on weak ideas. Help refine them into something elite.
- **Systems Thinking**: Connect ideas across domains. Focus on high-leverage workflows.
- **Markdown First**: Use bold text, lists, and headings.
- **Visuals**: Acknowledge visuals; system handles them.

### 🛠️ INSTRUMENTS
- **Interactive Calculator**: Use for ALL math. \`\`\`calculator 5*5 \`\`\`. Do not say the result in text.
- **Python Sandbox**: For simulations. \`\`\`python <code> \`\`\`.

Keep responses elite, concise, and focused on execution.
`

    // Construct full message history for the AI
    const apiMessages: any[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((m: any) => ({ role: m.role, content: m.content })),
    ]
    
    // Add the current message if it's not already in history
    if (message && (!history.length || history[history.length-1].content !== message)) {
      apiMessages.push({ role: 'user', content: message })
    }

    // Tier-Based Model Routing Logic (Groq Free Tier)
    const prompt = (message || '').toLowerCase()
    const complexKeywords = ['code', 'math', 'mermaid', 'diagram', 'draw', 'visualize', 'prove', 'solve', 'complex', 'analyze', 'search', 'latest', 'news', 'calculate', 'architecture', 'show', 'find', 'bugatti']
    
    // Simple greetings should NEVER use tools or 70B to save quota and prevent "empty" responses
    const isSimpleGreeting = (prompt.length < 15 && (prompt === 'hello' || prompt === 'hi' || prompt === 'hey' || prompt === 'hola' || prompt.includes('hello ') || prompt.includes('hi ') || prompt.includes('hey ')))
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
        if (requestedStream) return handleStreaming(aiResponse, detectedImages)
        const data = await aiResponse.json()
        return NextResponse.json({ content: data.choices[0].message.content, images: detectedImages })
    }

    const data = await aiResponse.json()
    const messageObj = data.choices[0].message

    // Fallback for empty content
    if (!messageObj.content && (!messageObj.tool_calls || messageObj.tool_calls.length === 0)) {
       messageObj.content = isSimpleGreeting 
         ? "Hey 👋 I’m ready when you are—what do you want to work on, build, or figure out today?" 
         : "I'm ready. What would you like to build or analyze?"
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
      return handleStreaming(finalResponse, detectedImages)
    }

    // Step 2.5: Catch "hallucinated" text-based function calls (Multiple)
    const rawTags = [...(messageObj.content || '').matchAll(/<function=([\s\S]*?)<\/function>/gi)]
    if (rawTags.length > 0) {
       console.log(`Caught ${rawTags.length} hallucinated function tags`)
       let strippedContent = messageObj.content || ''
       let combinedSearchResults = ''

       for (const match of rawTags) {
         const tagContent = match[1]
         strippedContent = strippedContent.replace(match[0], '')
         
         try {
           const toolName = tagContent.split('{')[0].trim()
           const toolArgs = tagContent.slice(toolName.length)
           
           if (toolName === 'search_web') {
              const { query } = JSON.parse(toolArgs)
              const { searchWeb } = await import('@/utils/search')
              const searchResult = await searchWeb(query)
              combinedSearchResults += `\n\nSEARCH RESULT FOR "${query}":\n${searchResult}`
           }
         } catch (e) {
           console.error('Hallucinated tag parsing failed:', e)
         }
       }

       if (combinedSearchResults) {
          apiMessages.push({ role: 'assistant', content: strippedContent })
          apiMessages.push({ role: 'user', content: `USE THESE REAL SEARCH RESULTS TO PROVIDE LINKS AND IMAGES IN YOUR FINAL RESPONSE. DO NOT SAY "I CAN'T PROVIDE LINKS": ${combinedSearchResults}` })
          
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
          return handleStreaming(finalResponse, detectedImages)
       }
    }

    // Step 3: No tool used, just return content or stream
    if (!requestedStream) {
      return NextResponse.json({ content: messageObj.content, images: detectedImages })
    }

    const encoder = new TextEncoder()
    const content = messageObj.content || ''
    
    const manualStream = new ReadableStream({
      async start(controller) {
        // PHASE 6: Inject structured image data at the start of the stream
        if (detectedImages && detectedImages.length > 0) {
          const imageResult = {
            type: "image_result",
            images: detectedImages
          }
          controller.enqueue(encoder.encode(`[METADATA]:${JSON.stringify(imageResult)}\n`))
        }

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
async function handleStreaming(response: Response, images?: any[]) {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const stream = new ReadableStream({
    async start(controller) {
      // PHASE 6: Inject structured image data at the start of the stream
      if (images && images.length > 0) {
        const imageResult = {
          type: "image_result",
          images: images
        }
        controller.enqueue(encoder.encode(`[METADATA]:${JSON.stringify(imageResult)}\n`))
      }

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


