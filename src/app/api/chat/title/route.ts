import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { aiService } from '@/lib/ai'
import { cleanGeneratedTitle, generateFallbackTitle, isDefaultChatTitle } from '@/lib/chat/title'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { messages, chatId, prompt } = body || {}

    // Extract user prompt from direct parameter or message array
    let userPrompt = ''
    if (typeof prompt === 'string' && prompt.trim()) {
      userPrompt = prompt.trim()
    } else if (Array.isArray(messages) && messages.length > 0) {
      const userMsg = [...messages].reverse().find((m: any) => m && m.role === 'user' && m.content)
      userPrompt = userMsg?.content || messages[0]?.content || ''
    }

    if (!userPrompt || typeof userPrompt !== 'string' || !userPrompt.trim()) {
      return NextResponse.json({ error: 'User prompt or messages required' }, { status: 400 })
    }

    // If chatId is provided, ensure we do not overwrite an existing meaningful title
    if (chatId) {
      const { data: existingChat } = await supabase
        .from('chats')
        .select('title')
        .eq('id', chatId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (existingChat && !isDefaultChatTitle(existingChat.title)) {
        return NextResponse.json({ title: existingChat.title })
      }
    }

    let title = ''

    // Attempt AI title generation using automatic model routing & fallback chain (Groq -> Gemini)
    try {
      const response = await aiService.complete([
        { 
          role: 'system', 
          content: 'You are a session labeler. Create a short, concise, descriptive (3-5 words max) title for this chat based on the user prompt. DO NOT use quotes, markdown like ** or _, or trailing punctuation. Output ONLY the short title in plain text without any formatting.' 
        },
        {
          role: 'user',
          content: userPrompt.slice(0, 500)
        }
      ], {
        max_tokens: 20,
      })

      title = cleanGeneratedTitle(response?.content)
    } catch (aiError: any) {
      console.warn('[Title API] AI generation failed, using prompt fallback:', aiError?.message)
    }

    // Graceful fallback to prompt-based title if AI title was empty or failed
    if (!title) {
      title = generateFallbackTitle(userPrompt)
    }

    // Persist to database if chatId provided
    if (chatId && title) {
      await supabase
        .from('chats')
        .update({ title })
        .eq('id', chatId)
        .eq('user_id', user.id)
    }

    return NextResponse.json({ title })
  } catch (error: any) {
    console.error('Title API Error:', error)
    return NextResponse.json({ error: error.message || 'Failed to generate title' }, { status: 500 })
  }
}
