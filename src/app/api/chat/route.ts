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
             if (!item.tag) return true // Include legacy untagged memory
             // Include if tag keyword is present in recent conversation
             return userContextStr.includes(item.tag.toLowerCase()) || userContextStr.includes('remember') || userContextStr.includes('forget')
          })

          if (filteredMemories.length > 0) {
             const memoryList = filteredMemories.map(m => `[ID: ${m.id}] ${m.raw}`).join('\n')
             const tagList = memories
               .map((m: any) => typeof m === 'string' && m.includes('|') ? m.split('|')[0].trim() : '')
               .filter(Boolean)
               .filter((val, i, arr) => arr.indexOf(val) === i) // unique tags
               .join(', ')

             memoryPrompt = `ACTIVE MEMORY FACTS (Loaded via related tags):\n${memoryList}`
             if (tagList) {
                memoryPrompt += `\n\n(HIDDEN TAGS: ${tagList}. If user mentions these words, facts will load next turn.)`
             }
          }
       }
    }

    const systemPrompt = `You are Threadly, a high-performance AI workspace. 
You have a "Persistent Brain"—this means you must actively use the "USER CONTEXT & MEMORY" and "HOW TO RESPOND" sections below to shape every single reply. 

PRIVACY PROTOCOL:
- You DO NOT know the user's real name or contact info. 
- Refer to the user only by context or as "User".
- NEVER record emails, login names, or contact info as memories. 
- Only record technical facts or project context explicitly provided by the user.

Tone & Logic:
- Proactively reference the user's projects, tech stack, and preferences found in memories.
- If the user prefers TypeScript, always output TS. 
- Avoid generic filler. Be an elite engineer-partner.
- Use clear "Yes" or "-" symbols for comparison tables.

${profile?.custom_instructions ? `HOW TO RESPOND: ${profile.custom_instructions}` : ''}
${memoryPrompt}

MEMORY MANAGEMENT: 
Do NOT output phrases like "Memory learned" or "I will remember that" in your natural text. Act completely natural.
IF AND ONLY IF the user explicitly asks you to remember, update, or forget something, or shares a critical persistent fact, you may trigger the memory system.
Memories use a TAG SYSTEM. When adding a memory, prefix it with a simple 1-word lowercase tag and a pipe symbol (e.g., framework|User uses NextJS).
Use ONE of these exact tags on a single line at the VERY END of your response to manage memory. Keep usages extremely rare.
To ADD: [MEMORY_ADD: <one_word_tag>|<brief concise fact>]
To EDIT an existing fact by ID: [MEMORY_EDIT: <ID> | <new updated raw string including tag>]
To DELETE an existing fact by ID: [MEMORY_DELETE: <ID>]`

    // Construct full message history for the AI
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...history.map((m: any) => ({ role: m.role, content: m.content })),
    ]
    
    // Add the current message if it's not already in history
    if (message && (!history.length || history[history.length-1].content !== message)) {
      apiMessages.push({ role: 'user', content: message })
    }

    const response = await fetch('https://api.sambanova.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SAMBANOVA_API_KEY}`
      },
      body: JSON.stringify({
        model: 'Meta-Llama-3.3-70B-Instruct',
        messages: apiMessages,
        stream: requestedStream
      })
    })

    if (!response.ok) {
        let errorData
        try {
          errorData = await response.json()
        } catch {
          errorData = { message: 'Failed to parse error response' }
        }
        console.error('SambaNova API Error Context:', errorData)
        return NextResponse.json({ 
          error: 'SambaNova Error', 
          details: errorData.message || response.statusText 
        }, { status: response.status })
    }

    if (!requestedStream) {
        const data = await response.json()
        const assistantContent = data.choices[0].message.content
        return NextResponse.json({ content: assistantContent })
    }

    // Set up streaming response
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader()
        if (!reader) {
          controller.close()
          return
        }

        let fullAssistantContent = ''
        let buffer = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || '' // Keep the incomplete line in the buffer

            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed || trimmed === 'data: [DONE]') continue
              
              if (trimmed.startsWith('data: ')) {
                try {
                  const json = JSON.parse(trimmed.slice(6))
                  const content = json.choices[0]?.delta?.content || ''
                  if (content) {
                    fullAssistantContent += content
                    controller.enqueue(encoder.encode(content))
                  }
                } catch (e) {
                  // Buffer likely split mid-JSON, will catch on next chunk
                }
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

  } catch (error: any) {
    console.error('Chat API Error:', error)
    const errDetails = error.cause ? error.cause.message || error.cause.code : error.message
    return NextResponse.json({ error: 'fetch failed', details: errDetails }, { status: 500 })
  }
}
