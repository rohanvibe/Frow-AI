import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { aiService } from '@/lib/ai'
import { AIRouter } from '@/lib/ai/router'

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

    const { message, image, messages: history = [], chatId, skipSave, stream: requestedStream = true, selectedModel } = await req.json()

    if (!message && history.length === 0) {
      return NextResponse.json({ error: 'Message or history is required' }, { status: 400 })
    }

    // PHASE 1: Deterministic Intent Detection (Runs BEFORE LLM)
    const { detectImageIntent, fetchVerifiedImages, generateImage } = await import('@/utils/image-engine')
    const imageIntent = detectImageIntent(message || '')
    let detectedImages: any[] = []
    
    if (imageIntent) {
      console.log(`[Deterministic Flow] Image intent detected for: ${imageIntent.query} (Action: ${imageIntent.action}, Limit: ${imageIntent.limit})`)
      if (imageIntent.action === 'generate') {
        detectedImages = await generateImage(imageIntent.query, imageIntent.limit)
      } else {
        detectedImages = await fetchVerifiedImages(imageIntent.query, imageIntent.limit)
      }
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

    const systemPrompt = `You are Frow, an elite AI partner for high-leverage builders. You prioritize systems thinking, execution, and brutal honesty.
When a user greets you (e.g., "hello", "hey", "hi"), respond warmly and professionally. Suggested greeting: "Hey 👋 I’m ready when you are—what do you want to work on, build, or figure out today?"

### 🧠 CORE PHILOSOPHY
- **Brutal Truth**: 90% of ideas are average. Execution and positioning are everything. If a user's idea is weak, push back and help them refine it into something elite.
- **Systems Thinking**: Connect ideas across domains (business, code, fitness, science). Focus on high-leverage workflows.
- **Instant Understandability**: Use simple, direct language. No academic jargon or corporate "speak".
- **Natural Conversation**: Respond naturally and cleanly. Do not overuse tables, bold text, or heavy formatting unless the user explicitly asks for structure or it significantly improves understanding. Simple questions should get simple, easy-to-read answers.
- **Visuals**: You ARE capable of showing images. If the user asks for a visual, acknowledge that you are finding it for them. However, do NOT generate image markdown yourself; the system will automatically inject the verified visual assets into the workspace.

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
${profile?.custom_instructions ? `Custom Response Style: ${profile.custom_instructions}` : ''}
${memoryPrompt}

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

    // Construct full message history for the AI
    const apiMessages: any[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((m: any) => ({
        role: m.role,
        content: m.content,
        image: m.images && m.images.length > 0 ? m.images[0] : (m.image || undefined),
        name: m.name || undefined,
        tool_call_id: m.tool_call_id || undefined,
        tool_calls: m.tool_calls || undefined
      })),
    ]
    
    // Add the current message if it's not already in history
    if (message && (!history.length || history[history.length-1].content !== message)) {
      if (image) {
        // If image exists, add it to the user message
        apiMessages.push({ role: 'user', content: message, image })
      } else {
        apiMessages.push({ role: 'user', content: message })
      }
    }

    // Simple greetings detection for tool optimization
    const prompt = (message || '').toLowerCase()
    const isSimpleGreeting = (prompt.length < 15 && (prompt === 'hello' || prompt === 'hi' || prompt === 'hey' || prompt === 'hola' || prompt.includes('hello ') || prompt.includes('hi ') || prompt.includes('hey ')))

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

    // Use AI service for intelligent routing and fallback
    let routingDecision
    const hasImageInput = !!image || apiMessages.some(m => !!m.image)

    if (hasImageInput) {
      // Force Gemini if any image is present, because Groq does not support images
      routingDecision = AIRouter.forceModel('gemini', 'gemini-2.0-flash-exp')
      console.log('[Chat API] Image detected, forcing Gemini Flash')
    } else if (selectedModel && selectedModel !== 'auto') {
      // User manually selected a model
      const provider = selectedModel.includes('gemini') ? 'gemini' : 'groq'
      routingDecision = AIRouter.forceModel(provider, selectedModel)
      console.log('[Chat API] User selected model:', selectedModel)
    } else {
      // Use automatic routing
      routingDecision = aiService.getRoutingDecision(apiMessages, message)
    }
    console.log('[Chat API] Routing decision:', routingDecision)

    // Step 1: Initial call to check for tools using AI service
    let aiResponse
    try {
      aiResponse = await aiService.complete(apiMessages, {
        currentMessage: message,
        tools: isSimpleGreeting ? undefined : tools,
        tool_choice: isSimpleGreeting ? undefined : 'auto',
        temperature: 0.1,
        max_tokens: 4096,
        forceModel: (selectedModel && selectedModel !== 'auto') ? selectedModel : undefined,
        forceProvider: (selectedModel && selectedModel !== 'auto') ? (selectedModel.includes('gemini') ? 'gemini' : 'groq') : undefined,
      })
    } catch (error: any) {
      console.error('[Chat API] AI Service Error:', error)
      // Fallback: Try without tools if tool calling fails
      console.log('[Chat API] Retrying without tools due to error')
      try {
        aiResponse = await aiService.complete(apiMessages, {
          currentMessage: message,
          tools: undefined,
          tool_choice: undefined,
          temperature: 0.1,
          max_tokens: 4096,
          forceModel: (selectedModel && selectedModel !== 'auto') ? selectedModel : undefined,
          forceProvider: (selectedModel && selectedModel !== 'auto') ? (selectedModel.includes('gemini') ? 'gemini' : 'groq') : undefined,
        })
      } catch (retryError: any) {
        console.error('[Chat API] Retry failed:', retryError)
        
        // Handle Groq strict tool failure by extracting the hallucinated code
        const errMsg = retryError.message || ''
        if (errMsg.includes('failed_generation')) {
          try {
            const match = errMsg.match(/"failed_generation"\s*:\s*"([\s\S]*?)"\s*}/) || errMsg.match(/"failed_generation"\s*:\s*'(.*?)'\s*}/);
            let unescaped = '';
            if (match) {
              unescaped = match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
            } else if (errMsg.includes('failed_generation')) {
               // naive extraction
               unescaped = errMsg.substring(errMsg.indexOf('"failed_generation"'));
               unescaped = unescaped.replace(/\\"/g, '"').replace(/\\n/g, '\n');
            }
            
            if (unescaped.includes('"name": "python"')) {
              let code = unescaped.split('"arguments":')[1]?.replace(/}$/, '').trim();
              if (code) {
                 return NextResponse.json({ content: `\`\`\`python\n${code}\n\`\`\``, images: detectedImages })
              }
            } else if (unescaped.includes('"name": "calculator"')) {
              let code = unescaped.split('"arguments":')[1]?.replace(/}$/, '').trim();
              if (code) {
                 return NextResponse.json({ content: `\`\`\`calculator\n${code}\n\`\`\``, images: detectedImages })
              }
            }
          } catch(e) {}
        }
        
        return NextResponse.json({ error: retryError.message || 'AI service failed' }, { status: 500 })
      }
    }

    const messageObj = {
      role: 'assistant',
      content: aiResponse.content,
      tool_calls: aiResponse.tool_calls,
    }

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

      // Final call after all tools are executed using AI service
      const finalStream = await aiService.stream(apiMessages, {
        temperature: 0.1,
        forceModel: (selectedModel && selectedModel !== 'auto') ? selectedModel : undefined,
        forceProvider: (selectedModel && selectedModel !== 'auto') ? (selectedModel.includes('gemini') ? 'gemini' : 'groq') : undefined,
      })
      return handleStreaming(finalStream, detectedImages)
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
          
          const finalStream = await aiService.stream(apiMessages, {
            temperature: 0.1,
            forceModel: (selectedModel && selectedModel !== 'auto') ? selectedModel : undefined,
            forceProvider: (selectedModel && selectedModel !== 'auto') ? (selectedModel.includes('gemini') ? 'gemini' : 'groq') : undefined,
          })
          return handleStreaming(finalStream, detectedImages)
       }
    }

    // Step 3: No tool used — stream the already-computed content directly
    // instead of making a second LLM call. This halves latency for simple messages.
    if (!requestedStream) {
      return NextResponse.json({ content: messageObj.content, images: detectedImages })
    }

    const encoder = new TextEncoder()
    const directStream = new ReadableStream({
      start(controller) {
        if (detectedImages && detectedImages.length > 0) {
          const imageResult = { type: "image_result", images: detectedImages }
          controller.enqueue(encoder.encode(`[METADATA]:${JSON.stringify(imageResult)}\n`))
        }
        controller.enqueue(encoder.encode(messageObj.content || ''))
        controller.close()
      }
    })

    return new Response(directStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      }
    })
  } catch (error: any) {
    console.error('Chat API Error:', error)
    return NextResponse.json({ error: error.message || 'Server error', details: error.stack }, { status: 500 })
  }
}

// Helper to handle streaming logic
async function handleStreaming(stream: ReadableStream, images?: any[]) {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const wrappedStream = new ReadableStream({
    async start(controller) {
      // PHASE 6: Inject structured image data at the start of the stream
      if (images && images.length > 0) {
        const imageResult = {
          type: "image_result",
          images: images
        }
        controller.enqueue(encoder.encode(`[METADATA]:${JSON.stringify(imageResult)}\n`))
      }

      const reader = stream.getReader()
      if (!reader) {
        controller.close()
        return
      }

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          // Pass through the stream content directly
          controller.enqueue(value)
        }
      } catch (error) {
        controller.error(error)
      } finally {
        controller.close()
      }
    }
  })

  return new Response(wrappedStream, {
    headers: { 
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    }
  })
}



