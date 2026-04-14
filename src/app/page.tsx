'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui'
import { 
  Plus, 
  Send, 
  Settings, 
  MessageSquare, 
  Menu, 
  ChevronRight, 
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
  UserMinus
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
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth')
      } else {
        setUser(user)
        fetchChats(user.id)
        fetchPrompts(user.id)
      }
    }
    checkUser()

    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (mobile) {
        setIsNavOpen(false)
        setIsSidebarOpen(false)
      } else {
        setIsNavOpen(true)
        setIsSidebarOpen(true)
      }
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    if (currentChatId) {
      fetchMessages(currentChatId)
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
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })
    if (data) setMessages(data)
  }

  const fetchPrompts = async (userId: string) => {
    const { data } = await supabase
      .from('prompts')
      .select('*')
      .eq('user_id', userId)
    if (data) setPrompts(data)
  }

  const createNewChat = async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('chats')
      .insert([{ user_id: user.id, title: 'New Chat' }])
      .select()
      .single()
    
    if (data) {
      setChats([data, ...chats])
      setCurrentChatId(data.id)
    }
  }

  const deleteChat = async (id: string) => {
    const { error } = await supabase.from('chats').delete().eq('id', id)
    if (!error) {
      setChats(chats.filter(c => c.id !== id))
      if (currentChatId === id) setCurrentChatId(null)
    }
  }

  const updateChatTitle = async (id: string) => {
    if (!editingTitle.trim()) return
    const { error } = await supabase.from('chats').update({ title: editingTitle }).eq('id', id)
    if (!error) {
      setChats(chats.map(c => c.id === id ? { ...c, title: editingTitle } : c))
      setEditingChatId(null)
    }
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
    } else {
        alert('Failed to delete account. You may need to sign in again.')
    }
    setLoading(false)
  }

  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!input.trim() || loading || !user) return

    let chatId = currentChatId
    if (!chatId) {
      const { data } = await supabase
        .from('chats')
        .insert([{ user_id: user.id, title: input.slice(0, 30) }])
        .select()
        .single()
      if (data) {
        chatId = data.id
        setCurrentChatId(chatId)
        setChats([data, ...chats])
      } else return
    }

    const userMessage = input
    setInput('')
    setLoading(true)

    // Add user message
    const tempUserMsg: Message = {
      id: Math.random().toString(),
      chat_id: chatId!,
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString()
    }
    setMessages(prev => [...prev, tempUserMsg])
    await supabase.from('messages').insert([{ chat_id: chatId, role: 'user', content: userMessage }])

    // Create placeholder for assistant message
    const assistantMsgId = Math.random().toString()
    const tempAssistantMsg: Message = {
      id: assistantMsgId,
      chat_id: chatId!,
      role: 'assistant',
      content: '', // Start empty for streaming
      created_at: new Date().toISOString()
    }
    setMessages(prev => [...prev, tempAssistantMsg])

    try {
      if (modelType === 'default') {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: userMessage, chatId })
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

          // Update messages state in real-time
          setMessages(prev => 
            prev.map(m => m.id === assistantMsgId ? { ...m, content: accumulatedContent } : m)
          )
        }
      } else {
        // BYOK Logic (frontend only)
        const keys = JSON.parse(localStorage.getItem('threadly_keys') || '{}')
        if (!keys.openai) {
           const err = "Please set your OpenAI API key in settings for BYOK mode."
           setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: err } : m))
        } else {
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${keys.openai}`
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [{ role: 'user', content: userMessage }],
              stream: true
            })
          })

          if (!res.body) return
          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          let accumulatedContent = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const chunk = decoder.decode(value)
            const lines = chunk.split('\n')
            for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    try {
                        const data = JSON.parse(line.slice(6))
                        const content = data.choices[0]?.delta?.content || ''
                        accumulatedContent += content
                        setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: accumulatedContent } : m))
                    } catch (e) {}
                }
            }
          }
          // Save finished BYOK message
          await supabase.from('messages').insert([{ chat_id: chatId, role: 'assistant', content: accumulatedContent }])
        }
      }

      // Generate AI Title if it's the first message or default title
      const currentChat = chats.find(c => c.id === chatId)
      if (currentChat && (currentChat.title === 'New Chat' || currentChat.title === userMessage.slice(0, 30))) {
        const titleRes = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            message: `Generate a very short (max 4 words) descriptive title for a chat starting with this message: "${userMessage}". Output ONLY the title.`,
            chatId,
            skipSave: true,
            stream: false
          })
        })
        const titleData = await titleRes.json()
        if (titleData.content) {
            const cleanTitle = titleData.content.replace(/["']/g, '').trim()
            await supabase.from('chats').update({ title: cleanTitle }).eq('id', chatId)
            setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: cleanTitle } : c))
        }
      }

    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
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
    <div className="flex h-dvh bg-[#09090b] text-white overflow-hidden relative">
      {/* Mobile Header (Hidden on Desktop) */}
      {isMobile && (
        <div className="absolute top-0 left-0 right-0 h-14 border-b border-[#27272a] bg-black/40 backdrop-blur-xl flex items-center justify-between px-4 z-40">
          <button onClick={() => setIsNavOpen(true)} className="p-2 hover:bg-white/5 rounded-lg active:scale-95 transition-all">
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="font-black text-sm tracking-tighter uppercase flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-500" />
            Threadly
          </h1>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`p-2 rounded-lg active:scale-95 transition-all ${isSidebarOpen ? 'text-blue-500 bg-blue-500/10' : ''}`}>
            <History className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Overlay for mobile sidebars */}
      <AnimatePresence>
        {isMobile && (isNavOpen || isSidebarOpen) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setIsNavOpen(false); setIsSidebarOpen(false); }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* Left Navigation (Chats) */}
      <AnimatePresence>
        {isNavOpen && (
          <motion.div 
            initial={isMobile ? { x: -300 } : { width: 0, opacity: 0 }}
            animate={isMobile ? { x: 0 } : { width: 256, opacity: 1 }}
            exit={isMobile ? { x: -300 } : { width: 0, opacity: 0 }}
            className={`${isMobile ? 'absolute inset-y-0 left-0 w-72 z-50' : 'w-64 relative'} border-r border-[#27272a] flex flex-col bg-[#09090b] h-full shadow-2xl overflow-hidden`}
          >
            <div className="p-4 border-b border-[#27272a] flex items-center justify-between shrink-0">
              <h1 className="font-bold text-xl flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-500" />
                Threadly
              </h1>
              <Button variant="ghost" size="sm" onClick={() => setIsNavOpen(false)} className="hover:bg-white/5">
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>

            <div className="px-3 pt-4 border-b border-[#27272a] pb-4 shrink-0">
              <div className="flex items-center gap-3 p-2 bg-white/2 rounded-xl border border-white/5">
                <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-xs font-bold shadow-lg glow shrink-0">
                  {user?.email?.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[12px] font-bold truncate">Member</span>
                  <span className="text-[10px] text-gray-500 truncate">{user?.email}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={handleLogout}
                    className="p-1.5 hover:bg-white/10 rounded-md text-gray-400 hover:text-white transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={handleDeleteAccount}
                    className="p-1.5 hover:bg-red-500/10 rounded-md text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-3 shrink-0">
              <Button className="w-full flex items-center gap-2 shadow-sm rounded-xl py-5" onClick={createNewChat}>
                <Plus className="w-4 h-4" />
                New Chat
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 space-y-1 py-2 custom-scrollbar">
              {chats.map(chat => (
                <div key={chat.id} className="group relative">
                  {editingChatId === chat.id ? (
                    <div className="flex items-center gap-2 p-2 bg-[#18181b] rounded-xl border border-blue-500/50">
                      <input 
                        value={editingTitle}
                        onChange={e => setEditingTitle(e.target.value)}
                        className="bg-transparent border-none outline-none text-xs w-full"
                        autoFocus
                        onKeyDown={e => e.key === 'Enter' && updateChatTitle(chat.id)}
                      />
                      <button onClick={() => updateChatTitle(chat.id)} className="text-green-500">
                        <Check className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setCurrentChatId(chat.id); if (isMobile) setIsNavOpen(false); }}
                      className={`w-full text-left p-3 rounded-xl text-sm transition-all flex items-center gap-3 pr-12 group ${
                        currentChatId === chat.id ? 'bg-white/10 text-white border border-white/5' : 'text-gray-400 hover:bg-white/3 border border-transparent'
                      }`}
                    >
                      <MessageSquare className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
                      <span className="truncate">{chat.title}</span>
                    </button>
                  )}
                  
                  {editingChatId !== chat.id && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setEditingChatId(chat.id); setEditingTitle(chat.title); }}
                        className="p-1.5 hover:bg-white/10 rounded-md text-gray-500 hover:text-white"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); }}
                        className="p-1.5 hover:bg-red-500/10 rounded-md text-gray-500 hover:text-red-500"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-[#27272a] space-y-2 shrink-0">
              <Button variant="ghost" className="w-full justify-start gap-3 rounded-xl" onClick={() => setShowPrompts(true)}>
                <Command className="w-4 h-4" />
                Prompts
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-3 rounded-xl" onClick={() => setShowSettings(true)}>
                <Settings className="w-4 h-4" />
                Settings
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isNavOpen && !isMobile && (
        <button 
          onClick={() => setIsNavOpen(true)}
          className="p-4 hover:text-blue-500 transition-colors absolute left-0 top-0 z-30 h-16 flex items-center"
        >
          <Menu className="w-6 h-6" />
        </button>
      )}

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col relative bg-[#09090b] h-full ${isMobile ? 'pt-14' : ''}`}>
        {/* Header (Desktop Only or always visible as sub-header) */}
        {!isMobile && (
          <header className="h-16 border-b border-[#27272a] flex items-center justify-between px-6 bg-black/20 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <div className="flex bg-[#18181b] rounded-full p-1 border border-[#27272a] shadow-inner">
                <button 
                  onClick={() => setModelType('default')}
                  className={`px-4 py-1 rounded-full text-xs font-medium transition-all ${modelType === 'default' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200'}`}
                >
                  SambaNova
                </button>
                <button 
                  onClick={() => setModelType('byok')}
                  className={`px-4 py-1 rounded-full text-xs font-medium transition-all ${modelType === 'byok' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200'}`}
                >
                  BYOK
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
               <Button variant="ghost" size="sm" onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={isSidebarOpen ? 'text-blue-500 bg-blue-500/10' : ''}>
                  <History className="w-5 h-5 mx-1" />
                  Navigation
               </Button>
            </div>
          </header>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 md:space-y-8 scroll-smooth custom-scrollbar">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-80 px-4">
              <div className="w-20 h-20 rounded-2xl bg-linear-to-tr from-blue-600 to-purple-600 flex items-center justify-center shadow-2xl glow animate-pulse">
                <Globe className="w-10 h-10 text-white" />
              </div>
              <div className="max-w-md space-y-2">
                <h2 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">Threadly</h2>
                <p className="text-gray-400 text-sm md:text-base">The high-performance AI workspace. Securely powered by SambaNova and your custom keys.</p>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-8 md:space-y-10 py-4 md:py-10">
              {messages.map(msg => (
                <div 
                  key={msg.id} 
                  id={`message-${msg.id}`}
                  className={`flex gap-4 md:gap-6 group transition-all duration-700 rounded-2xl p-4 -mx-2 md:-mx-4 ${
                    highlightedMessageId === msg.id ? 'bg-blue-500/5 ring-1 ring-blue-500/30' : 'hover:bg-white/1'
                  }`}
                >
                  <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${
                    msg.role === 'assistant' ? 'bg-blue-600 text-white glow' : 'bg-[#27272a] text-gray-400'
                  }`}>
                    {msg.role === 'assistant' ? <Zap className="w-4 h-4 md:w-5 md:h-5" /> : <Plus className="w-4 h-4 md:w-5 md:h-5 rotate-45" />}
                  </div>
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[10px] md:text-xs tracking-widest uppercase text-gray-500">
                        {msg.role === 'assistant' ? 'Assistant' : 'Member'}
                      </span>
                      <span className="text-[10px] text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-gray-200 leading-relaxed text-sm md:text-[15px] prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-[#18181b] prose-pre:border prose-pre:border-[#27272a] prose-code:text-blue-400 overflow-x-auto">
                      {msg.content === '' && loading ? (
                        <div className="flex items-center gap-2 text-blue-500 font-bold tracking-tighter italic">
                          <motion.div
                            animate={{ opacity: [0.4, 1, 0.4], y: [-1, 1, -1] }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                          >
                            THINKING...
                          </motion.div>
                        </div>
                      ) : (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div ref={messagesEndRef} className="h-10 md:h-20" />
        </div>

        {/* Input area */}
        <div className="p-4 md:p-6 border-t border-[#27272a] bg-[#09090b]/80 backdrop-blur-md">
           <form onSubmit={sendMessage} className="max-w-3xl mx-auto relative group">
              <Input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Message Threadly..."
                className="pr-12 md:pr-14 py-5 md:py-6 bg-[#18181b] border-[#27272a] focus:border-blue-500 hover:border-gray-700 transition-all rounded-2xl text-sm md:text-base"
              />
              <button 
                type="submit"
                disabled={loading}
                className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 p-2 md:p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-90 shadow-lg shadow-blue-500/20"
              >
                <Send className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
              </button>
           </form>
           <p className="text-[8px] md:text-[10px] text-center mt-3 text-gray-700 uppercase tracking-[0.3em] font-black pointer-events-none opacity-20">
             SambaNova Compute Service
           </p>
        </div>
      </div>

      {/* Right Sidebar (Navigation) */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={isMobile ? { x: '100%' } : { width: 0, opacity: 0 }}
            animate={isMobile ? { x: 0 } : { width: 300, opacity: 1 }}
            exit={isMobile ? { x: '100%' } : { width: 0, opacity: 0 }}
            className={`${isMobile ? 'absolute inset-y-0 right-0 w-[80%] z-50 shadow-2xl' : 'w-72 relative'} border-l border-[#27272a] flex flex-col bg-[#09090b] h-full`}
          >
            <div className="p-4 border-b border-[#27272a] flex items-center justify-between shrink-0">
              <h2 className="font-bold text-xs uppercase tracking-[0.2em] text-gray-500">Fast Navigation</h2>
              <Button variant="ghost" size="sm" onClick={() => setIsSidebarOpen(false)} className="hover:bg-white/5">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
              {messages.filter(m => m.role === 'user').map((msg, idx) => (
                <button
                  key={msg.id}
                  onClick={() => { scrollToMessage(msg.id); if (isMobile) setIsSidebarOpen(false); }}
                  className="w-full text-left p-3 rounded-xl border border-white/3 bg-white/1 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group active:scale-[0.98] relative overflow-hidden"
                >
                  <div className="flex items-center gap-3 relative z-10">
                    <span className="text-[10px] font-mono text-blue-500 font-black bg-blue-500/10 w-5 h-5 rounded-md flex items-center justify-center shrink-0 border border-blue-500/20">{idx + 1}</span>
                    <span className="text-xs truncate text-gray-400 group-hover:text-white transition-colors">{msg.content}</span>
                  </div>
                  <div className="absolute inset-y-0 left-0 w-1 bg-blue-600/0 group-hover:bg-blue-600/50 transition-all" />
                </button>
              ))}
              {messages.filter(m => m.role === 'user').length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 opacity-30">
                  <History className="w-8 h-8" />
                  <p className="text-xs font-bold uppercase tracking-widest leading-loose">Waiting for user messages to index...</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals placeholders */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showPrompts && <PromptManager userId={user?.id} onClose={() => setShowPrompts(false)} onSelect={(p) => setInput(p)} />}
    </div>
  )
}

// Sub-components (Simplified for now)
function SettingsModal({ onClose }: { onClose: () => void }) {
  const [keys, setKeys] = useState({ openai: '', anthropic: '' })

  useEffect(() => {
    const saved = localStorage.getItem('threadly_keys')
    if (saved) setKeys(JSON.parse(saved))
  }, [])

  const save = () => {
    localStorage.setItem('threadly_keys', JSON.stringify(keys))
    onClose()
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md border-[#27272a]">
        <CardHeader>
          <CardTitle>BYOK Settings</CardTitle>
          <CardDescription>Your keys are saved locally in your browser.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-gray-500">OpenAI API Key</label>
            <Input 
              type="password"
              value={keys.openai}
              onChange={(e) => setKeys({...keys, openai: e.target.value})}
              placeholder="sk-..."
            />
          </div>
          <p className="text-[10px] text-gray-500 italic">* These keys are never sent to the server. Requests will be made directly from your browser.</p>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save Changes</Button>
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

    useEffect(() => {
        if (userId) fetchPrompts()
    }, [userId])

    const fetchPrompts = async () => {
        const { data } = await supabase.from('prompts').select('*').eq('user_id', userId)
        if (data) setPrompts(data)
    }

    const savePrompt = async () => {
        if (!newTitle || !newTemplate) return
        const { data } = await supabase.from('prompts').insert([{ user_id: userId, title: newTitle, template: newTemplate }]).select().single()
        if (data) {
            setPrompts([...prompts, data])
            setNewTitle('')
            setNewTemplate('')
        }
    }

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <Card className="w-full max-w-2xl border-[#27272a] flex flex-col max-h-[80vh]">
                <CardHeader className="shrink-0">
                    <CardTitle>Saved Prompts</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        {prompts.map(p => (
                            <button 
                                key={p.id}
                                onClick={() => { onSelect(p.template); onClose(); }}
                                className="p-4 rounded-lg border border-[#27272a] bg-[#18181b] hover:border-blue-500 text-left transition-colors"
                            >
                                <h4 className="font-bold text-sm mb-1">{p.title}</h4>
                                <p className="text-xs text-gray-500 line-clamp-2">{p.template}</p>
                            </button>
                        ))}
                    </div>
                    
                    <div className="p-4 rounded-lg border border-dashed border-[#27272a] space-y-3">
                        <h4 className="text-sm font-bold">Add New Prompt</h4>
                        <Input placeholder="Prompt Title" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                        <textarea 
                            className="w-full h-24 rounded-md border border-[#27272a] bg-[#18181b] px-3 py-2 text-sm"
                            placeholder="Prompt template..."
                            value={newTemplate}
                            onChange={e => setNewTemplate(e.target.value)}
                        />
                        <Button className="w-full" onClick={savePrompt}>Save Prompt</Button>
                    </div>
                </CardContent>
                <CardFooter className="shrink-0 justify-end">
                    <Button variant="ghost" onClick={onClose}>Close</Button>
                </CardFooter>
            </Card>
        </div>
    )
}
