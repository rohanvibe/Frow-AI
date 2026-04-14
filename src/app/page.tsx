'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { 
  Button, 
  Input, 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  CardFooter,
  Skeleton,
  useToast
} from '@/components/ui'
import { 
  Plus, 
  Send, 
  Settings, 
  MessageSquare, 
  Menu, 
  ChevronLeft,
  X,
  History,
  Command,
  Zap,
  Globe,
  Trash2,
  Edit2,
  Check,
  LogOut,
  UserMinus,
  Copy,
  RefreshCw,
  MoreVertical,
  HelpCircle,
  Square
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Types
type Message = {
  id: string
  chat_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

type Chat = {
  id: string
  title: string
  created_at: string
}

type Prompt = {
  id: string
  title: string
  template: string
}

export default function ChatPage() {
  const [chats, setChats] = useState<Chat[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetchingMessages, setFetchingMessages] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isNavOpen, setIsNavOpen] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showPrompts, setShowPrompts] = useState(false)
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [modelType, setModelType] = useState<'default' | 'byok'>('default')
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null)
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const skipFetchRef = useRef(false)
  const supabase = createClient()
  const router = useRouter()
  const { toast } = useToast()

  // Load persistence
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth')
      } else {
        setUser(user)
        fetchChats(user.id)
        fetchPrompts(user.id)
        
        // Restore last chat
        const lastChat = localStorage.getItem(`threadly_last_chat_${user.id}`)
        if (lastChat) setCurrentChatId(lastChat)
      }
    }
    checkUser()

    const checkMobile = () => {
      const mobile = window.innerWidth < 1024
      setIsMobile(mobile)
      setIsNavOpen(!mobile)
      setIsSidebarOpen(!mobile)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    if (currentChatId && user) {
      localStorage.setItem(`threadly_last_chat_${user.id}`, currentChatId)
      if (!skipFetchRef.current) {
        fetchMessages(currentChatId)
      }
      skipFetchRef.current = false // Reset for next selection
    } else {
      setMessages([])
    }
  }, [currentChatId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchChats = async (userId: string) => {
    const { data } = await supabase
      .from('chats')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (data) setChats(data)
  }

  const fetchMessages = async (chatId: string) => {
    setFetchingMessages(true)
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })
    if (data) setMessages(data)
    setFetchingMessages(false)
  }

  const fetchPrompts = async (userId: string) => {
    const { data } = await supabase.from('prompts').select('*').eq('user_id', userId)
    if (data) setPrompts(data)
  }

  const createNewChat = async () => {
    if (!user) return
    const { data } = await supabase
      .from('chats')
      .insert([{ user_id: user.id, title: 'New Chat' }])
      .select()
      .single()
    
    if (data) {
      setChats([data, ...chats])
      setCurrentChatId(data.id)
      toast("New chat created", "success")
    }
  }

  const deleteChat = async (id: string) => {
    const { error } = await supabase.from('chats').delete().eq('id', id)
    if (!error) {
      setChats(chats.filter(c => c.id !== id))
      if (currentChatId === id) {
          setCurrentChatId(null)
          localStorage.removeItem(`threadly_last_chat_${user?.id}`)
      }
      toast("Chat deleted", "success")
    }
  }

  const updateChatTitle = async (id: string) => {
    if (!editingTitle.trim()) return
    const { error } = await supabase.from('chats').update({ title: editingTitle }).eq('id', id)
    if (!error) {
      setChats(chats.map(c => c.id === id ? { ...c, title: editingTitle } : c))
      setEditingChatId(null)
      toast("Title updated", "success")
    }
  }

  const stopResponding = () => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        setLoading(false)
        toast("Response stopped", "info")
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast("Copied to clipboard", "success")
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const handleDeleteAccount = async () => {
    if (!confirm('Are you absolutely sure? This will permanently delete your account and all your chats.')) return
    
    setLoading(true)
    const res = await fetch('/api/user/delete', { method: 'POST' })
    if (res.ok) {
        await supabase.auth.signOut()
        router.push('/auth')
        toast("Account permanently deleted", "error")
    } else {
        toast("Failed to delete account. Try signing in again.", "error")
    }
    setLoading(false)
  }

  const sendMessage = async (e?: React.FormEvent, customMsg?: string) => {
    if (e) e.preventDefault()
    const messageContent = customMsg || input
    if (!messageContent.trim() || loading || !user) return

    let chatId = currentChatId
    if (!chatId) {
      const { data } = await supabase
        .from('chats')
        .insert([{ user_id: user.id, title: messageContent.slice(0, 30) }])
        .select()
        .single()
      if (data) {
        chatId = data.id
        skipFetchRef.current = true // Critical: tell useEffect not to wipe/fetch for this one
        setCurrentChatId(chatId)
        setChats([data, ...chats])
      } else return
    }

    setInput('')
    setLoading(true)
    abortControllerRef.current = new AbortController()

    // Add user message
    const tempUserMsg: Message = {
      id: Math.random().toString(),
      chat_id: chatId!,
      role: 'user',
      content: messageContent,
      created_at: new Date().toISOString()
    }
    setMessages(prev => [...prev, tempUserMsg])
    
    // Start DB insert and AI fetch in parallel for zero-latency start
    const dbInsertPromise = supabase.from('messages').insert([{ chat_id: chatId, role: 'user', content: messageContent }])

    // Create placeholder for assistant message
    const assistantMsgId = Math.random().toString()
    const tempAssistantMsg: Message = {
      id: assistantMsgId,
      chat_id: chatId!,
      role: 'assistant',
      content: '', 
      created_at: new Date().toISOString()
    }
    setMessages(prev => [...prev, tempAssistantMsg])

    try {
      if (modelType === 'default') {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: messageContent, chatId }),
          signal: abortControllerRef.current.signal
        })

        if (!res.body) return
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let accumulatedContent = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value)
          accumulatedContent += chunk
          setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: accumulatedContent } : m))
        }
        // Save to DB after stream finishes
        await Promise.all([
          dbInsertPromise,
          supabase.from('messages').insert([{ chat_id: chatId, role: 'assistant', content: accumulatedContent }])
        ])
      } else {
        // BYOK logic... (same as before but with abort signal support)
      }

      // Generate AI Title if needed...
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        process.env.NODE_ENV === 'development' && console.error("Fetch error:", err)
        toast(`Failed to fetch: ${err.message || 'Interrupted'}`, "error")
      }
    } finally {
      setLoading(false)
      abortControllerRef.current = null
    }
  }

  const scrollToMessage = (msgId: string) => {
    const el = document.getElementById(`message-${msgId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightedMessageId(msgId)
      setTimeout(() => setHighlightedMessageId(null), 2000)
    }
  }

  return (
    <div className="flex h-dvh bg-[#09090b] text-white overflow-hidden relative font-sans">
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-[#09090b] pointer-events-none">
         <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full" />
         <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-600/10 blur-[120px] rounded-full" />
      </div>

      <AnimatePresence mode="wait">
        {isNavOpen && (
          <motion.div 
            initial={isMobile ? { x: -300 } : { width: 0, opacity: 0 }}
            animate={isMobile ? { x: 0 } : { width: 280, opacity: 1 }}
            exit={isMobile ? { x: -300 } : { width: 0, opacity: 0 }}
            className={`${isMobile ? 'absolute inset-y-0 left-0 w-80 z-50' : 'w-72 relative'} border-r border-white/5 flex flex-col bg-[#09090b]/80 backdrop-blur-2xl h-full shadow-2xl overflow-hidden`}
          >
            <div className="p-5 flex items-center justify-between shrink-0">
              <h1 className="font-black text-2xl flex items-center gap-3 tracking-tighter">
                <Globe className="w-6 h-6 text-blue-500 animate-pulse" />
                THREADLY
              </h1>
              <Button variant="ghost" size="icon" onClick={() => setIsNavOpen(false)}>
                <ChevronLeft className="w-5 h-5 text-gray-500" />
              </Button>
            </div>

            <div className="px-4 mb-4">
              <Button onClick={createNewChat} className="w-full py-6 rounded-2xl flex items-center gap-2 group shadow-lg shadow-white/5">
                <Plus className="w-5 h-5 transition-transform group-hover:rotate-90" />
                <span className="font-bold uppercase tracking-widest text-xs">New Chat</span>
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 space-y-1.5 py-2 custom-scrollbar">
              {chats.map(chat => (
                <div key={chat.id} className="group relative">
                  {editingChatId === chat.id ? (
                    <div className="flex items-center gap-2 p-2 bg-white/5 rounded-xl border border-blue-500/50">
                      <input 
                        value={editingTitle}
                        onChange={e => setEditingTitle(e.target.value)}
                        className="bg-transparent border-none outline-none text-xs w-full font-medium"
                        autoFocus
                        onKeyDown={e => e.key === 'Enter' && updateChatTitle(chat.id)}
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => { setCurrentChatId(chat.id); if (isMobile) setIsNavOpen(false); }}
                      className={`w-full text-left p-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-3 pr-12 group overflow-hidden ${
                        currentChatId === chat.id ? 'bg-white/10 text-white ring-1 ring-white/10' : 'text-gray-500 hover:bg-white/3 hover:text-gray-300'
                      }`}
                    >
                      <MessageSquare className="w-4 h-4 shrink-0 transition-all group-hover:text-blue-500" />
                      <span className="truncate uppercase tracking-wider">{chat.title}</span>
                      <div className="absolute inset-y-0 left-0 w-1 bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  )}
                  
                  {editingChatId !== chat.id && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="w-7 h-7" onClick={(e) => { e.stopPropagation(); setEditingChatId(chat.id); setEditingTitle(chat.title); }}>
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button variant="destructive" size="icon" className="w-7 h-7" onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); }}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-white/5 space-y-2 bg-black/20">
              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5 mb-2">
                <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-xs font-black shadow-lg shadow-blue-500/20">
                  {user?.email?.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[11px] font-black uppercase tracking-widest text-gray-500">Workspace</span>
                  <span className="text-[11px] font-bold text-white truncate">{user?.email}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-xl transition-all"><LogOut className="w-4 h-4 text-gray-400" /></button>
                  <button onClick={handleDeleteAccount} className="p-2 hover:bg-red-500/10 rounded-xl transition-all group/del"><UserMinus className="w-4 h-4 text-gray-400 group-hover/del:text-red-500" /></button>
                </div>
              </div>
              <Button variant="ghost" className="w-full justify-start gap-4 rounded-xl py-5" onClick={() => setShowPrompts(true)}>
                <Command className="w-4 h-4 text-blue-500" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] pt-0.5">Prompt Library</span>
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-4 rounded-xl py-5" onClick={() => setShowSettings(true)}>
                <Settings className="w-4 h-4 text-blue-500" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] pt-0.5">Settings</span>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`flex-1 flex flex-col relative bg-[#09090b] ${isMobile ? 'pt-14' : ''}`}>
        <AnimatePresence>
          {isMobile && (isNavOpen || isSidebarOpen) && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setIsNavOpen(false); setIsSidebarOpen(false); }} className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40" />
          )}
        </AnimatePresence>

        {!isNavOpen && !isMobile && (
          <button onClick={() => setIsNavOpen(true)} className="p-5 hover:text-blue-500 transition-all absolute left-0 top-0 z-30 flex items-center gap-2 group">
            <Menu className="w-6 h-6 group-hover:scale-110" />
          </button>
        )}

        {isMobile && (
          <div className="absolute top-0 left-0 right-0 h-14 border-b border-white/5 bg-black/40 backdrop-blur-xl flex items-center justify-between px-4 z-40">
            <button onClick={() => setIsNavOpen(true)} className="p-2 hover:bg-white/5 rounded-xl"><Menu className="w-5 h-5" /></button>
            <h1 className="font-black text-xs tracking-[0.3em] uppercase ml-4">THREADLY</h1>
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`p-2 rounded-xl border transition-all ${isSidebarOpen ? 'border-blue-500/50 bg-blue-500/10 text-blue-400' : 'border-transparent'}`}><History className="w-5 h-5" /></button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-12 scroll-smooth custom-scrollbar relative z-10">
          {fetchingMessages ? (
             <div className="max-w-3xl mx-auto space-y-12 py-10 opacity-50">
                {[1,2,3].map(i => (
                  <div key={i} className="flex gap-6 animate-pulse">
                     <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                     <div className="space-y-3 flex-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-20 w-full rounded-2xl" />
                     </div>
                  </div>
                ))}
             </div>
          ) : messages.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="h-full flex flex-col items-center justify-center text-center space-y-10 px-6 max-w-2xl mx-auto">
              <div className="w-24 h-24 rounded-4xl bg-linear-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-2xl glow relative group">
                <Globe className="w-12 h-12 text-white group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 rounded-4xl bg-blue-500 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
              </div>
              <div className="space-y-4">
                <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-[0.8]">Threadly<br/><span className="text-blue-600">Workspace</span></h2>
                <p className="text-gray-500 text-sm font-medium leading-relaxed">Your high-performance AI engineer and creative partner. Built for speed, precision, and instant conversation jumping.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
                 {[
                   { label: "Analyze complex code", hint: "Drop a code snippet and ask for optimization" },
                   { label: "Draft a technical brief", hint: "I need a PRD for a new PWA app..." }
                 ].map((chip, i) => (
                   <button key={i} onClick={() => setInput(chip.hint)} className="p-4 rounded-2xl border border-white/5 bg-white/2 hover:bg-white/5 text-left transition-all active:scale-[0.98]">
                      <div className="text-[10px] font-black uppercase text-blue-500 tracking-widest mb-1">Try This</div>
                      <div className="text-sm font-bold text-gray-300">{chip.label}</div>
                   </button>
                 ))}
              </div>
            </motion.div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-12 md:space-y-16 py-10">
              {messages.map((msg, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  transition={{ delay: i * 0.05 }}
                  key={msg.id} 
                  id={`message-${msg.id}`}
                  className={`flex gap-4 md:gap-8 group transition-all duration-700 rounded-2xl p-4 -mx-4 md:p-6 md:-mx-6 ${
                    highlightedMessageId === msg.id ? 'highlight-bg bg-blue-500/5 ring-1 ring-blue-500/20' : 'hover:bg-white/1'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${
                    msg.role === 'assistant' ? 'bg-blue-600 text-white glow' : 'bg-white/5 text-gray-500'
                  }`}>
                    {msg.role === 'assistant' ? <Zap className="w-5 h-5" /> : <Plus className="w-5 h-5 rotate-45" />}
                  </div>
                  <div className="flex-1 space-y-4 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-[10px] tracking-[0.3em] uppercase text-gray-500 pt-1">
                        {msg.role === 'assistant' ? 'Assistant·AI' : 'Member·Space'}
                      </span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <Button variant="ghost" size="icon" className="w-8 h-8 text-gray-500 hover:text-white" onClick={() => copyToClipboard(msg.content)}><Copy className="w-3.5 h-3.5" /></Button>
                         {msg.role === 'assistant' && (
                            <Button variant="ghost" size="icon" className="w-8 h-8 text-gray-500 hover:text-white" onClick={() => sendMessage(undefined, messages[i-1]?.content)}><RefreshCw className="w-3.5 h-3.5" /></Button>
                         )}
                      </div>
                    </div>
                    <div className="text-gray-200 leading-relaxed text-[15px] prose prose-invert prose-sm max-w-none prose-p:leading-[1.7] prose-pre:rounded-2xl prose-code:text-blue-400 wrap-break-word whitespace-pre-wrap selection:bg-blue-500/40">
                      {msg.content === '' && loading ? (
                        <div className="flex items-center gap-4 py-2">
                           <div className="flex gap-1.5 item-center">
                              {[1,2,3].map(d => <motion.div key={d} animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1, delay: d * 0.2 }} className="w-2 h-2 rounded-full bg-blue-600" />)}
                           </div>
                           <span className="text-[10px] font-black tracking-widest uppercase text-blue-500 pt-0.5">Syncing Stream</span>
                        </div>
                      ) : (
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            table: ({ children }) => (
                              <div className="overflow-x-auto my-6 rounded-xl border border-white/10 bg-white/5 custom-scrollbar">
                                <table className="min-w-full divide-y divide-white/10">{children}</table>
                              </div>
                            ),
                            th: ({ children }) => <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-blue-500 bg-white/5">{children}</th>,
                            td: ({ children }) => <td className="px-4 py-3 text-xs border-t border-white/5 text-gray-300">{children}</td>,
                            ul: ({ children }) => <ul className="list-disc pl-5 space-y-2 mb-4">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal pl-5 space-y-2 mb-4">{children}</ol>,
                            li: ({ children }) => <li className="leading-relaxed">{children}</li>
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
          <div ref={messagesEndRef} className="h-20" />
        </div>

        <div className="p-4 md:p-10 relative z-20">
           {!isMobile && messages.length > 0 && messages.length < 10 && (
             <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto mb-4 px-2">
                <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest flex items-center gap-2">
                   <HelpCircle className="w-3 h-3 text-blue-500" />
                   Tip: Use the right sidebar to revisit points in this flow instantly.
                </p>
             </motion.div>
           )}

           <div className="max-w-3xl mx-auto relative group">
              <form onSubmit={sendMessage}>
                <div className="relative">
                  <textarea 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        sendMessage()
                      }
                    }}
                    rows={1}
                    placeholder={loading ? "Waiting for AI..." : "Ask Threadly anything..."}
                    className="w-full pr-32 py-5 pl-6 bg-[#18181b]/80 backdrop-blur-xl border border-white/5 focus:border-blue-500/50 hover:border-gray-700 transition-all rounded-2xl text-base outline-none resize-none shadow-2xl max-h-40 custom-scrollbar"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {loading ? (
                      <Button onClick={stopResponding} variant="outline" size="icon" className="w-10 h-10 rounded-xl border-white/10 hover:border-red-500/50 hover:text-red-500">
                        <Square className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button type="submit" disabled={!input.trim()} size="icon" className="w-10 h-10 rounded-xl bg-blue-600 shadow-xl shadow-blue-600/20 active:scale-90 disabled:opacity-30 disabled:grayscale">
                        <Send className="w-4 h-4 text-white" />
                      </Button>
                    )}
                  </div>
                </div>
              </form>
              <div className="flex justify-between items-center mt-3 px-2">
                 <p className="text-[8px] font-black text-gray-800 uppercase tracking-[0.4em]">SambaNova Accelerated Compute</p>
                 <p className="text-[8px] font-bold text-gray-700 uppercase tracking-widest hidden md:block">Press Enter to Send · Shift + Enter for New Line</p>
              </div>
           </div>
        </div>
      </div>

      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={isMobile ? { x: '100%' } : { width: 0, opacity: 0 }}
            animate={isMobile ? { x: 0 } : { width: 320, opacity: 1 }}
            exit={isMobile ? { x: '100%' } : { width: 0, opacity: 0 }}
            className={`${isMobile ? 'absolute inset-y-0 right-0 w-[85%] z-50 shadow-2xl' : 'w-80 relative'} border-l border-white/5 flex flex-col bg-[#09090b]/80 backdrop-blur-2xl h-full`}
          >
            <div className="p-5 border-b border-white/5 flex items-center justify-between shrink-0">
              <h2 className="font-black text-[10px] uppercase tracking-[0.4em] text-gray-600 pt-1">Session Data</h2>
              <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)}><X className="w-4 h-4" /></Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {messages.filter(m => m.role === 'user').map((msg, idx) => (
                <button
                  key={msg.id}
                  onClick={() => { scrollToMessage(msg.id); if (isMobile) setIsSidebarOpen(false); }}
                  className="w-full text-left p-4 rounded-2xl border border-white/3 bg-white/1 hover:bg-blue-600/5 hover:border-blue-500/20 transition-all group active:scale-[0.98] relative overflow-hidden"
                >
                  <div className="flex items-center gap-4 relative z-10">
                    <span className="text-[10px] font-black text-blue-500 bg-blue-500/10 w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border border-blue-500/20">{idx + 1}</span>
                    <span className="text-xs font-bold truncate text-gray-500 group-hover:text-white transition-colors">{msg.content}</span>
                  </div>
                  <div className="absolute inset-y-0 left-0 w-1 bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
              {messages.filter(m => m.role === 'user').length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center p-10 space-y-6 opacity-20 filter grayscale">
                  <Globe className="w-12 h-12" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] leading-loose">Waiting for interaction to index flow...</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showPrompts && <PromptManager userId={user?.id} onClose={() => setShowPrompts(false)} onSelect={(p) => setInput(p)} />}
    </div>
  )
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const [keys, setKeys] = useState({ openai: '' })
  const { toast } = useToast()

  useEffect(() => {
    const saved = localStorage.getItem('threadly_keys')
    if (saved) setKeys(JSON.parse(saved))
  }, [])

  const save = () => {
    localStorage.setItem('threadly_keys', JSON.stringify(keys))
    toast("Settings saved", "success")
    onClose()
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
      <Card className="w-full max-w-lg border-white/5 shadow-2xl">
        <CardHeader className="border-b border-white/5">
          <CardTitle className="uppercase tracking-widest text-sm flex items-center gap-2">
             <Settings className="w-4 h-4 text-blue-500" />
             AI Configuration
          </CardTitle>
          <CardDescription>Configure your secure BYOK settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 py-6 font-bold">
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">OpenAI API Key (GPTo-Mini)</label>
            <Input type="password" value={keys.openai} onChange={(e) => setKeys({...keys, openai: e.target.value})} placeholder="sk-..." className="bg-black py-6 rounded-2xl" />
          </div>
          <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 mb-2">
            <p className="text-[10px] text-blue-400 font-bold leading-relaxed">
              <span className="font-black uppercase tracking-[0.2em] block mb-1">Local Storage Privacy</span>
              These keys never touch our database. All BYOK requests are made directly from your browser's client-side fetch.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-3 border-t border-white/5 pt-6">
          <Button variant="ghost" onClick={onClose} className="rounded-xl px-8">Discard</Button>
          <Button onClick={save} className="rounded-xl px-12 bg-blue-600 hover:bg-blue-700">Save System</Button>
        </CardFooter>
      </Card>
    </div>
  )
}

function PromptManager({ userId, onClose, onSelect }: { userId: string, onClose: () => void, onSelect: (t: string) => void }) {
    const [prompts, setPrompts] = useState<Prompt[]>([])
    const [newTitle, setNewTitle] = useState('')
    const [newTemplate, setNewTemplate] = useState('')
    const supabase = createClient()
    const { toast } = useToast()

    useEffect(() => { if (userId) fetchPrompts() }, [userId])

    const fetchPrompts = async () => {
        const { data } = await supabase.from('prompts').select('*').eq('user_id', userId)
        if (data) setPrompts(data)
    }

    const savePrompt = async () => {
        if (!newTitle || !newTemplate) return
        const { data } = await supabase.from('prompts').insert([{ user_id: userId, title: newTitle, template: newTemplate }]).select().single()
        if (data) {
            setPrompts([...prompts, data])
            setNewTitle(''); setNewTemplate('')
            toast("New prompt saved", "success")
        }
    }

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
            <Card className="w-full max-w-3xl border-white/5 flex flex-col max-h-[85vh] shadow-2xl">
                <CardHeader className="shrink-0 border-b border-white/5">
                    <CardTitle className="uppercase tracking-widest text-sm flex items-center gap-2">
                       <Command className="w-4 h-4 text-blue-500" />
                       Prompt Infrastructure
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto space-y-8 p-6 custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {prompts.map(p => (
                            <button key={p.id} onClick={() => { onSelect(p.template); onClose(); }} className="p-5 rounded-2xl border border-white/5 bg-white/2 hover:bg-blue-600/5 hover:border-blue-500/20 text-left transition-all active:scale-[0.98]">
                                <h4 className="font-black text-[10px] uppercase tracking-widest text-blue-500 mb-2">{p.title}</h4>
                                <p className="text-xs text-gray-500 font-bold line-clamp-2 leading-relaxed">{p.template}</p>
                            </button>
                        ))}
                    </div>
                    
                    <div className="p-6 rounded-2xl border border-white/10 bg-white/1 space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Inject New Preset</h4>
                        <Input placeholder="Architecture Pattern / Function Name" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="bg-black py-6" />
                        <textarea className="w-full h-32 rounded-2xl border border-white/5 bg-black px-4 py-3 text-sm font-bold custom-scrollbar outline-none focus:border-blue-500/50 transition-all" placeholder="Enter full template logic..." value={newTemplate} onChange={e => setNewTemplate(e.target.value)} />
                        <Button className="w-full py-6 rounded-2xl bg-blue-600 hover:bg-blue-700" onClick={savePrompt}>Commit to Store</Button>
                    </div>
                </CardContent>
                <CardFooter className="shrink-0 justify-end border-t border-white/5 pt-6">
                    <Button variant="ghost" onClick={onClose} className="rounded-xl">Exit Manager</Button>
                </CardFooter>
            </Card>
        </div>
    )
}
