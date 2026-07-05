import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Zap, Plus, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function SharePage(props: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await props.params
  const supabase = await createClient()
  
  // Fetch chat
  const { data: chat, error: chatError } = await supabase
    .from('chats')
    .select('*')
    .eq('id', chatId)
    .single()

  if (!chat) {
    return (
      <div className="min-h-screen bg-(--background) text-(--foreground) flex flex-col items-center justify-center p-10 font-mono text-xs">
        <h1 className="text-red-500 mb-4 font-black text-xl">VIRAL SHARE DEBUG</h1>
        <div className="bg-(--surface) p-4 rounded-xl space-y-2 border border-(--border-color) max-w-lg">
          <p><span className="text-(--apple-gray)">Error:</span> {chatError?.message || "Chat record not found in database"}</p>
          <p><span className="text-(--apple-gray)">ID Requested:</span> {chatId}</p>
          <p><span className="text-(--apple-gray)">Next.js Route:</span> /share/[chatId]</p>
          <p><span className="text-(--apple-gray)">Troubleshooting:</span> Ensure you have run the SQL to add 'is_public' and the GUEST RLS policies.</p>
        </div>
        <Link href="/" className="mt-8 text-(--apple-blue) hover:underline">Return to Frow</Link>
      </div>
    )
  }

  // Fetch messages
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })

  return (
    <div className="min-h-screen bg-(--background) text-(--foreground) font-sans selection:bg-(--apple-blue)/30 overflow-x-hidden">
      
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-(--border-color) bg-(--background)/60 backdrop-blur-3xl">
        <div className="max-w-4xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 squircle bg-(--apple-blue) flex items-center justify-center shadow-2xl shadow-(--apple-blue)/20">
                <Zap className="w-5 h-5 text-white" />
             </div>
             <span className="font-bold text-2xl tracking-tight text-(--foreground)">Frow</span>
          </div>
          <Link href="/" className="px-6 py-3 rounded-2xl bg-(--foreground) text-(--background) font-bold text-[13px] hover:opacity-90 transition-all flex items-center gap-2 group shadow-2xl">
             Enter Workspace <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 md:py-24">
        <div className="mb-20 space-y-4">
           <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight text-(--foreground)">{chat.title}</h1>
           <p className="text-(--apple-gray) text-[12px] font-medium tracking-tight uppercase">Shared Flow • Refined with Frow AI</p>
        </div>

        <div className="space-y-24">
          {messages?.map((msg) => (
            <div key={msg.id} className="flex gap-8 md:gap-12 group animate-in fade-in slide-in-from-bottom-4 duration-1000">
               <div className={`w-12 h-12 squircle flex items-center justify-center shrink-0 shadow-xl ${
                msg.role === 'assistant' ? 'bg-(--apple-blue) text-white' : 'bg-(--surface) text-(--apple-gray)'
               }`}>
                 {msg.role === 'assistant' ? <Zap className="w-5 h-5" /> : <Plus className="w-5 h-5 rotate-45" />}
               </div>
               <div className="flex-1 space-y-6 min-w-0 overflow-hidden pt-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[13px] tracking-tight text-(--apple-gray)">
                      {msg.role === 'assistant' ? 'Frow Assistant' : 'Shared Thought'}
                    </span>
                  </div>
                  <div className="text-(--foreground) leading-relaxed text-[17px] prose prose-lg dark:prose-invert max-w-none prose-p:leading-[1.8] prose-pre:rounded-3xl prose-code:text-(--apple-blue) break-words whitespace-pre-wrap">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
               </div>
            </div>
          ))}
        </div>

        {/* Footer Viral CTA */}
        <div className="mt-32 p-12 md:p-20 rounded-[3rem] border border-(--border-color) bg-(--surface) text-center space-y-10 relative overflow-hidden group shadow-xl">
           <div className="absolute inset-0 bg-linear-to-b from-(--apple-blue)/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
           <div className="relative z-10 space-y-8">
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-(--foreground)">Experience high-speed <br/> intelligence.</h2>
              <p className="text-(--apple-gray) text-lg font-medium max-w-md mx-auto leading-relaxed">Frow is a high-performance workspace designed for elite thinkers and builders.</p>
              <Link href="/" className="inline-flex h-16 items-center justify-center px-12 rounded-[1.25rem] bg-(--foreground) font-bold text-(--background) hover:opacity-90 shadow-2xl transition-all active:scale-95 text-[15px]">
                 Claim Your Workspace
              </Link>
              <div className="pt-6">
                 <span className="text-[11px] font-bold text-(--apple-gray) uppercase tracking-[0.4em]">frowai.vercel.app</span>
              </div>
           </div>
        </div>
      </main>
    </div>
  )
}
