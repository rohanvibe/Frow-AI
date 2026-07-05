import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { aiService } from '@/lib/ai'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { messages } = await req.json()
    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'Messages required' }, { status: 400 })
    }

    const response = await aiService.complete([
      { 
        role: 'system', 
        content: 'You are a session labeler. Create a short (3-4 words max) title for this chat. Example: "Product Research", "Code Review". DO NOT use markdown like ** or _. Output ONLY the short title in plain text without any formatting.' 
      },
      ...messages.slice(0, 5).map((m: any) => ({ role: m.role, content: m.content }))
    ], {
      max_tokens: 20,
      forceModel: 'openai/gpt-oss-120b',
      forceProvider: 'groq',
    })

    let title = response.content.trim()
    
    // Clean up title
    title = title.replace(/^["'](.*)["']$/, '$1') // Remove quotes
    if (title.length > 40) title = title.slice(0, 37) + '...'

    return NextResponse.json({ title })
  } catch (error: any) {
    console.error('Title API Error:', error)
    return NextResponse.json({ error: error.message || 'Failed to generate title' }, { status: 500 })
  }
}
