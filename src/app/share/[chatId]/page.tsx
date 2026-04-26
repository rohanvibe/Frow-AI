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
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-10 font-mono text-xs">
        <h1 className="text-red-500 mb-4 font-black text-xl">VIRAL SHARE DEBUG</h1>
        <div className="bg-white/5 p-4 rounded-xl space-y-2 border border-white/10 max-w-lg">
          <p><span className="text-gray-500">Error:</span> {chatError?.message || "Chat record not found in database"}</p>
          <p><span className="text-gray-500">ID Requested:</span> {chatId}</p>
          <p><span className="text-gray-500">Next.js Route:</span> /share/[chatId]</p>
          <p><span className="text-gray-500">Troubleshooting:</span> Ensure you have run the SQL to add 'is_public' and the GUEST RLS policies.</p>
        </div>
        <Link href="/" className="mt-8 text-blue-500 hover:underline">Return to Threadly</Link>
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
    <div className="min-h-screen bg-[#000000] text-white font-sans selection:bg-blue-500/30 overflow-x-hidden">
      {/* Aesthetic Background */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-50 grain-texture" />
      
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-black/60 backdrop-blur-3xl">
        <div className="max-w-4xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 squircle bg-(--apple-blue) flex items-center justify-center shadow-2xl shadow-blue-500/20">
                <Zap className="w-5 h-5 text-white" />
             </div>
             <span className="font-bold text-2xl tracking-tight">Threadly</span>
          </div>
          <Link href="/" className="px-6 py-3 rounded-2xl bg-white text-black font-bold text-[13px] hover:bg-gray-100 transition-all flex items-center gap-2 group shadow-2xl">
             Enter Workspace <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 md:py-24">
        <div className="mb-20 space-y-4">
           <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight text-white">{chat.title}</h1>
           <p className="text-(--apple-gray) text-[13px] font-medium tracking-tight uppercase">Shared Flow • Refined with Threadly AI</p>
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
                      {msg.role === 'assistant' ? 'Threadly Assistant' : 'Shared Thought'}
                    </span>
                  </div>
                  <div className="text-gray-100 leading-relaxed text-[17px] prose prose-invert prose-lg max-w-none prose-p:leading-[1.8] prose-pre:rounded-3xl prose-code:text-(--apple-blue) wrap-break-word whitespace-pre-wrap">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
               </div>
            </div>
          ))}
        </div>

        {/* Footer Viral CTA */}
        <div className="mt-32 p-12 md:p-20 rounded-[3rem] border-none bg-(--surface) text-center space-y-10 relative overflow-hidden group">
           <div className="absolute inset-0 bg-linear-to-b from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
           <div className="relative z-10 space-y-8">
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white">Experience high-speed <br/> intelligence.</h2>
              <p className="text-(--apple-gray) text-lg font-medium max-w-md mx-auto leading-relaxed">Threadly is a high-performance workspace designed for elite thinkers and builders.</p>
              <Link href="/" className="inline-flex h-16 items-center justify-center px-12 rounded-[1.25rem] bg-white font-bold text-black hover:bg-gray-100 shadow-2xl transition-all active:scale-95 text-[15px]">
                 Claim Your Workspace
              </Link>
              <div className="pt-6">
                 <span className="text-[11px] font-bold text-(--apple-gray) uppercase tracking-[0.4em]">threadly.app</span>
              </div>
           </div>
        </div>
      </main>
    </div>
  )
}
