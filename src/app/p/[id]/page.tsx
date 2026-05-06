import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import { Zap, Copy, Play } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function PromptSharePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const supabase = await createClient()
  
  const { data: prompt } = await supabase
    .from('prompts')
    .select('*')
    .eq('id', id)
    .single()

  if (!prompt) notFound()

  return (
    <div className="min-h-screen text-white selection:bg-blue-500/30">
      
      <main className="max-w-2xl mx-auto px-6 py-24 md:py-40 flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-[0_0_40px_rgba(37,99,235,0.4)] mb-10">
           <Zap className="w-10 h-10 text-white fill-current" />
        </div>

        <div className="text-center space-y-4 mb-12">
           <h1 className="text-3xl md:text-4xl font-black uppercase tracking-widest">{prompt.title}</h1>
           <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Prompt Template Shared via Threadly</p>
        </div>

        <div className="w-full rounded-3xl border border-white/10 bg-white/5 p-8 md:p-10 mb-10 group relative">
           <div className="absolute top-6 right-6 opacity-40 group-hover:opacity-100 transition-opacity">
              <Copy className="w-4 h-4 cursor-pointer hover:text-blue-400" />
           </div>
           <p className="text-gray-300 leading-relaxed font-mono text-sm whitespace-pre-wrap">
              {prompt.template}
           </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
           <Link 
             href={`/?prompt=${encodeURIComponent(prompt.template)}`}
             className="h-14 px-10 rounded-2xl bg-white text-black font-black text-sm flex items-center justify-center gap-3 hover:bg-gray-200 transition-all active:scale-95 shadow-xl"
           >
             <Play className="w-4 h-4 fill-current" /> Use this Prompt
           </Link>
           <Link 
             href="/"
             className="h-14 px-10 rounded-2xl border border-white/10 bg-white/1 font-black text-sm flex items-center justify-center gap-3 hover:bg-white/5 transition-all active:scale-95"
           >
             Create New Thread
           </Link>
        </div>

        <div className="mt-20">
           <span className="text-[10px] font-bold text-gray-700 uppercase tracking-[0.6em]">threadly.app</span>
        </div>
      </main>
    </div>
  )
}
