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

    // Fetch user personalization
    const { data: profile } = await supabase
      .from('profiles')
      .select('custom_instructions, ai_memory')
      .eq('id', user.id)
      .single()

    const { message, chatId, skipSave, stream: requestedStream = true } = await req.json()

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Format memory if it exists
    let memoryPrompt = ''
    if (profile?.ai_memory) {
       try {
          const memories = JSON.parse(profile.ai_memory)
          if (Array.isArray(memories) && memories.length > 0) {
             memoryPrompt = `USER CONTEXT & MEMORY:\n${memories.map(m => `- ${m}`).join('\n')}`
          }
       } catch (e) {
          memoryPrompt = profile.ai_memory // Fallback to raw if not JSON
       }
    }

    const systemPrompt = `You are Threadly, a helpful and sophisticated AI partner. 
While maintaining high-speed technical precision, avoid robotic responses. 
Be concise, skip the boilerplate, and when using tables, use clear "Yes" or "-" symbols for comparisons.

${profile?.custom_instructions ? `HOW TO RESPOND: ${profile.custom_instructions}` : ''}
${memoryPrompt}

MEMORY MANAGEMENT: 
If the user shares new personal information, preferences, or technical context about themselves during this conversation, identify it. 
At the VERY END of your response, output a single line with this format: [MEMORY_LEARNED: <brief concise fact>]. 
Do not mention memory unless you are recording it. Only record high-value facts.`

    const response = await fetch('https://api.sambanova.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SAMBANOVA_API_KEY}`
      },
      body: JSON.stringify({
        model: 'Meta-Llama-3.3-70B-Instruct',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
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
