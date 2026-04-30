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

    const { messages } = await req.json()
    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'Messages required' }, { status: 400 })
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { 
            role: 'system', 
            content: 'You are a session labeler. Create a short (2-4 words) title for this chat. Example: "Product Research", "Code Review", "App Design". DO NOT use "I can\'t help", "As an AI", or any other refusal. If the chat is empty, return "New Workspace". Output ONLY the short title.' 
          },
          ...messages.slice(0, 5).map((m: any) => ({ role: m.role, content: m.content }))
        ],
        max_tokens: 20
      })
    })

    if (!response.ok) throw new Error('Groq error')

    const data = await response.json()
    let title = data.choices[0].message.content.trim()
    
    // Clean up title
    title = title.replace(/^["'](.*)["']$/, '$1') // Remove quotes
    if (title.length > 40) title = title.slice(0, 37) + '...'

    return NextResponse.json({ title })
  } catch (error: any) {
    console.error('Title API Error:', error)
    return NextResponse.json({ error: 'Failed to generate title' }, { status: 500 })
  }
}
