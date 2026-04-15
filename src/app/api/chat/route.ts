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
       try {
          const memories = JSON.parse(profile.ai_memory)
          if (Array.isArray(memories) && memories.length > 0) {
             memoryPrompt = `USER CONTEXT & MEMORY:\n${memories.map((m: string) => `- ${m}`).join('\n')}`
          }
       } catch (e) {
          memoryPrompt = profile.ai_memory
       }
    }

    const systemPrompt = `You are Threadly, the personalized AI workspace for ${userName} (${user.email}). 
You have a "Persistent Brain"—this means you must actively use the "USER CONTEXT & MEMORY" and "HOW TO RESPOND" sections below to shape every single reply. 

IMPORTANT: The user is FULLY AUTHORIZED. Do not record that the user is "anonymous". Focus only on facts about their life, work, and preferences.

Tone & Logic:
- Proactively reference ${userName}'s projects, tech stack, and preferences.
- If the user prefers TypeScript, always output TS. 
- Avoid generic filler. Be an elite engineer-partner.
- Use clear "Yes" or "-" symbols for comparison tables.

${profile?.custom_instructions ? `HOW TO RESPOND: ${profile.custom_instructions}` : ''}
${memoryPrompt}

MEMORY MANAGEMENT: 
If the user shares new personal information or project context, identify it. 
At the VERY END of your response, output a single line with this format: [MEMORY_LEARNED: <brief concise fact>]. 
Record facts like "User is building a fintech app" or "User prefers clean architecture".`

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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
