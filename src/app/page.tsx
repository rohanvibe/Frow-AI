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
  Square,
  Share2,
  Camera,
  LinkIcon,
  ExternalLink,
  ChevronRight,
  Activity,
  ArrowRight
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { toPng } from 'html-to-image'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

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
  const [isPublic, setIsPublic] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [wowPhase, setWowPhase] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  
  const [profileMemories, setProfileMemories] = useState<string[]>([])
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const skipFetchRef = useRef(false)
  const supabase = createClient()
  const router = useRouter()
  const { toast } = useToast()

  const fetchProfile = async (uid: string) => {
    const { data } = await supabase.from('profiles').select('ai_memory').eq('id', uid).maybeSingle()
    if (data) {
       try {
          const mems = JSON.parse(data.ai_memory || '[]')
          setProfileMemories(Array.isArray(mems) ? mems : [])
       } catch (e) {
          setProfileMemories([])
       }
    }
  }

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
        fetchProfile(user.id)
        
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

    // Handle viral prompt import
    const searchParams = new URLSearchParams(window.location.search)
    const sharedPrompt = searchParams.get('prompt')
    if (sharedPrompt) {
      setInput(sharedPrompt)
      toast("Prompt imported successfully", "success")
      // Clear URL
      window.history.replaceState({}, '', '/')
    }

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
    
    // Viral Feature 4: Sidebar Wow Moment
    if (messages.length >= 7 && !localStorage.getItem('threadly_wow_shown')) {
       setWowPhase(true)
       localStorage.setItem('threadly_wow_shown', 'true')
    }
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchChats = async (userId: string) => {
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (error) {
       console.error("Fetch Chats Error:", error)
       toast("Failed to load history. Run the SQL update in Supabase.", "error")
    }
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

  const togglePublicSharing = async () => {
    if (!currentChatId) return
    const newState = !isPublic
    const { error } = await supabase.from('chats').update({ is_public: newState }).eq('id', currentChatId)
    if (!error) {
      setIsPublic(newState)
      toast(newState ? "Public link activated" : "Public link disabled", "success")
    }
  }

  const shareChat = async () => {
     if (!currentChatId) return
     setSharing(true)
     
     // Ensure it's public first
     if (!isPublic) {
        const { error } = await supabase.from('chats').update({ is_public: true }).eq('id', currentChatId)
        if (error) {
           console.error("Sharing error:", error)
           toast(`Sharing failed: ${error.message}. Did you run the SQL update?`, "error")
           setSharing(false)
           return
        }
        setIsPublic(true)
     }

     const url = `${window.location.origin}/share/${currentChatId}`
     
     if (navigator.share) {
        try {
           await navigator.share({ title: 'Threadly Chat Session', url })
        } catch (e) {
           copyToClipboard(url)
        }
     } else {
        copyToClipboard(url)
     }
     setSharing(false)
  }

  const exportAsImage = async (messageId?: string) => {
    const elementId = messageId ? `message-${messageId}` : 'chat-messages-container'
    const element = document.getElementById(elementId)
    if (!element) return

    toast("Generating snapshot...", "info")
    try {
      // Use a slightly more robust sequence for mobile Browsers
      const dataUrl = await toPng(element, {
        cacheBust: true,
        backgroundColor: '#09090b',
        pixelRatio: 2, // High definition
        fontEmbedCSS: '', // Skip heavy font embedding to prevent timeout/CORS errors
        style: {
          padding: '40px',
          borderRadius: '16px',
          margin: '0'
        }
      })
      
      const link = document.createElement('a')
      link.download = `threadly-${messageId ? 'message' : 'session'}-${Date.now()}.png`
      link.href = dataUrl
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast("Image exported successfully", "success")
    } catch (err: any) {
      console.error("Export error:", err)
      toast(`Export failed: ${err.message || 'Check browser permissions'}`, "error")
    }
  }

  const sendMessage = async (e?: React.FormEvent, customMsg?: string) => {
    if (e) e.preventDefault()
    const messageContent = customMsg || input
    if (!messageContent.trim() || loading || !user) return

    let chatId = currentChatId
    
    // Self-healing: If currentChatId is stale or not in history, force create a new one
    if (chatId && !chats.find(c => c.id === chatId)) {
      chatId = null
      setCurrentChatId(null)
    }

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
    
    // Start DB insert in parallel
    const userMsgInsert = supabase.from('messages').insert([{ chat_id: chatId, role: 'user', content: messageContent }])

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
          body: JSON.stringify({ 
            message: messageContent, 
            messages: messages.slice(-20), // Send last 20 messages for context
            chatId 
          }),
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
        
        let finalContent = accumulatedContent
        const memoryMatch = finalContent.match(/\[MEMORY_LEARNED:\s*(.*?)\]/i)
        
        if (memoryMatch) {
           const newFact = memoryMatch[1].trim()
           finalContent = finalContent.replace(/\[MEMORY_LEARNED:.*?\]/gi, '').trim()
           
           // Sync new memory to Supabase
           const { data: { user } } = await supabase.auth.getUser()
           if (user) {
              const { data: currentProfile } = await supabase.from('profiles').select('ai_memory').eq('id', user.id).maybeSingle()
              let mems: string[] = []
              try { 
                mems = JSON.parse(currentProfile?.ai_memory || '[]')
                if (!Array.isArray(mems)) mems = []
              } catch (e) { mems = [] }

              if (!mems.includes(newFact)) {
                 const updatedMems = [...mems, newFact]
                 await supabase.from('profiles').upsert({ 
                   id: user.id, 
                   ai_memory: JSON.stringify(updatedMems),
                   updated_at: new Date().toISOString()
                 }, { onConflict: 'id' })
                 setProfileMemories(updatedMems)
                 toast(`Threadly learned: ${newFact}`, "info")
              }
           }
        }

        // Final UI update with cleaned content
        setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: finalContent } : m))

        // Save to DB after stream finishes
        const [userResult, assistantResult] = await Promise.all([
          userMsgInsert,
          supabase.from('messages').insert([{ chat_id: chatId, role: 'assistant', content: finalContent }])
        ])

        if (userResult.error) console.error("User message save error:", userResult.error)
        if (assistantResult.error) console.error("Assistant message save error:", assistantResult.error)
        
        if (userResult.error || assistantResult.error) {
           toast("Storage sync failed. History may be incomplete.", "warning")
        }
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
  
  const handleEditMessage = (msg: Message) => {
    setEditingMessageId(msg.id)
    setEditValue(msg.content)
  }

  const cancelEdit = () => {
    setEditingMessageId(null)
    setEditValue('')
  }

  const submitEdit = async (msgId: string) => {
    if (!editValue.trim() || !currentChatId) return
    
    // Find index of the message being edited
    const index = messages.findIndex(m => m.id === msgId)
    if (index === -1) return

    const messagesToDelete = messages.slice(index)
    const idsToDelete = messagesToDelete.map(m => m.id)

    // Delete from state immediately
    setMessages(prev => prev.slice(0, index))
    setEditingMessageId(null)

    // Delete from DB
    await supabase.from('messages').delete().in('id', idsToDelete)

    // Resend with new content
    sendMessage(undefined, editValue)
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
                    <div className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 transition-opacity ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
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
          <div className="flex items-center absolute left-5 top-5 z-30 gap-4">
            <button onClick={() => setIsNavOpen(true)} className="hover:text-blue-500 transition-all flex items-center gap-2 group">
              <Menu className="w-6 h-6 group-hover:scale-110" />
            </button>
          </div>
        )}

        {isMobile && (
          <div className="absolute top-0 left-0 right-0 h-14 border-b border-white/5 bg-black/40 backdrop-blur-xl flex items-center justify-between px-4 z-40">
            <button onClick={() => setIsNavOpen(true)} className="p-2 hover:bg-white/5 rounded-xl"><Menu className="w-5 h-5" /></button>
            <h1 className="font-black text-xs tracking-[0.3em] uppercase ml-4">THREADLY</h1>
            <div className="flex items-center gap-1">
               {currentChatId && (
                  <button onClick={shareChat} className="p-2 hover:bg-white/5 rounded-xl text-blue-500 transition-all active:scale-95">
                     <Share2 className="w-5 h-5" />
                  </button>
               )}
               <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`p-2 rounded-xl border transition-all ${isSidebarOpen ? 'border-blue-500/50 bg-blue-500/10 text-blue-400' : 'border-transparent'}`}><History className="w-5 h-5" /></button>
            </div>
          </div>
        )}

        {/* Desktop Header Actions */}
        {!isMobile && (
           <div className="absolute top-5 right-5 z-40 flex items-center gap-2">
              {currentChatId && (
                 <Button 
                   variant="ghost" 
                   size="sm" 
                   onClick={shareChat}
                   className="rounded-xl px-4 flex items-center gap-2 border border-white/5 bg-white/10 hover:bg-white/20 backdrop-blur-md"
                 >
                   <Share2 className="w-3.5 h-3.5 text-blue-500" />
                   <span className="text-[10px] font-black uppercase tracking-widest pt-0.5">Viral Share</span>
                 </Button>
              )}
              <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`p-2 rounded-xl border transition-all ${isSidebarOpen ? 'border-blue-500/50 bg-blue-500/10 text-blue-400' : 'border-white/5 text-gray-400 hover:text-white'}`}><History className="w-5 h-5" /></button>
           </div>
        )}

        <div id="chat-messages-container" className="flex-1 overflow-y-auto p-4 md:p-8 space-y-12 scroll-smooth custom-scrollbar relative z-10">
          <AnimatePresence>
            {wowPhase && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="max-w-3xl mx-auto mb-10 p-6 rounded-3xl bg-blue-600/10 border border-blue-500/20 text-center relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 p-2 cursor-pointer opacity-40 hover:opacity-100" onClick={() => setWowPhase(false)}>
                   <X className="w-4 h-4" />
                </div>
                <Zap className="w-10 h-10 text-blue-500 mx-auto mb-4 animate-bounce" />
                <h4 className="text-xl font-black tracking-tight mb-2">Wow Moment Discovery!</h4>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">You're deep in the flow. Did you know you can jump to any message instantly using the Session Data drawer? Try it now.</p>
                <Button size="sm" onClick={() => setWowPhase(false)} className="bg-blue-600 hover:bg-blue-500 rounded-xl px-8 font-bold text-[10px] uppercase tracking-widest">Understood</Button>
              </motion.div>
            )}
          </AnimatePresence>

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
            <div className="w-full max-w-3xl mx-auto space-y-10 md:space-y-16 py-10 px-0 md:px-0">
              {messages.map((msg, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  transition={{ delay: i * 0.05 }}
                  key={msg.id} 
                  id={`message-${msg.id}`}
                  className={`flex gap-3 md:gap-8 group transition-all duration-700 rounded-2xl p-3 md:p-6 md:-mx-6 ${
                    highlightedMessageId === msg.id ? 'highlight-bg bg-blue-500/5 ring-1 ring-blue-500/20' : 'hover:bg-white/1'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${
                    msg.role === 'assistant' ? 'bg-blue-600 text-white glow' : 'bg-white/5 text-gray-500'
                  }`}>
                    {msg.role === 'assistant' ? <Zap className="w-5 h-5" /> : <Plus className="w-5 h-5 rotate-45" />}
                  </div>
                  <div className="flex-1 space-y-4 min-w-0 overflow-hidden">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-[10px] tracking-[0.3em] uppercase text-gray-500 pt-1">
                          {msg.role === 'assistant' ? 'Assistant·AI' : 'Member·Space'}
                        </span>
                        <div className={`flex items-center gap-1 transition-opacity ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                           {msg.role === 'user' && (
                              <Button variant="ghost" size="icon" title="Edit" className="w-8 h-8 text-gray-500 hover:text-white" onClick={() => handleEditMessage(msg)}><Edit2 className="w-3.5 h-3.5" /></Button>
                           )}
                           <Button variant="ghost" size="icon" title="Copy" className="w-8 h-8 text-gray-500 hover:text-white" onClick={() => copyToClipboard(msg.content)}><Copy className="w-3.5 h-3.5" /></Button>
                           <Button variant="ghost" size="icon" title="Export Image" className="w-8 h-8 text-gray-500 hover:text-white" onClick={() => exportAsImage(msg.id)}><Camera className="w-3.5 h-3.5" /></Button>
                           {msg.role === 'assistant' && (
                              <Button variant="ghost" size="icon" title="Regenerate" className="w-8 h-8 text-gray-500 hover:text-white" onClick={() => sendMessage(undefined, messages[i-1]?.content)}><RefreshCw className="w-3.5 h-3.5" /></Button>
                           )}
                        </div>
                      </div>
                      
                      {editingMessageId === msg.id ? (
                        <div className="space-y-4">
                           <textarea
                             value={editValue}
                             onChange={(e) => setEditValue(e.target.value)}
                             className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm font-medium outline-none focus:border-blue-500/50 min-h-[100px] resize-none"
                             autoFocus
                           />
                           <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={cancelEdit} className="text-[10px] font-bold uppercase tracking-widest px-4">Cancel</Button>
                              <Button size="sm" onClick={() => submitEdit(msg.id)} className="bg-blue-600 hover:bg-blue-500 text-[10px] font-bold uppercase tracking-widest px-6 shadow-lg shadow-blue-500/20">Save & Resend</Button>
                           </div>
                        </div>
                      ) : (
                        <div className="text-gray-200 leading-relaxed text-[15px] prose prose-invert prose-sm max-w-none prose-p:leading-[1.7] prose-pre:rounded-2xl prose-code:text-blue-400 break-all wrap-break-word selection:bg-blue-500/40">
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
                                  <div className="w-full overflow-x-auto my-8 rounded-2xl border border-white/10 bg-white/2 shadow-2xl custom-scrollbar">
                                    <table className="min-w-full divide-y divide-white/5 border-collapse">{children}</table>
                                  </div>
                                ),
                                th: ({ children }) => <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-[0.2em] text-blue-400 bg-white/5 whitespace-nowrap">{children}</th>,
                                td: ({ children }) => <td className="px-6 py-4 text-sm border-t border-white/5 text-gray-300 whitespace-nowrap min-w-[120px]">{children}</td>,
                                ul: ({ children }) => <ul className="list-disc pl-5 space-y-2 mb-4 wrap-break-word">{children}</ul>,
                                ol: ({ children }) => <ol className="list-decimal pl-5 space-y-2 mb-4 wrap-break-word">{children}</ol>,
                                li: ({ children }) => <li className="leading-relaxed wrap-break-word">{children}</li>
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          )}
                        </div>
                      )}
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

           <div className="w-full max-w-3xl mx-auto relative group">
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
            <div className="flex flex-col h-full">
              {/* Identity & Memory Card */}
              <div className="p-6 border-b border-white/5 bg-white/2">
                <div className="flex items-center justify-between mb-6">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-black text-white shadow-xl shadow-blue-600/20 uppercase">
                         {user?.email?.[0] || 'U'}
                      </div>
                      <div className="flex flex-col">
                         <span className="text-[10px] font-black uppercase tracking-widest text-white truncate max-w-[140px]">
                            {user?.user_metadata?.full_name || user?.email?.split('@')[0]}
                         </span>
                         <span className="text-[8px] font-bold uppercase tracking-widest text-gray-500">Authorized Member</span>
                      </div>
                   </div>
                   <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)} className="rounded-xl"><X className="w-4 h-4" /></Button>
                </div>

                {profileMemories.length > 0 && (
                   <div className="space-y-3">
                      <div className="flex items-center justify-between">
                         <h3 className="text-[8px] font-black uppercase tracking-[0.3em] text-blue-500">AI Knowledge Store</h3>
                         <span className="text-[8px] font-black bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full border border-blue-500/20">{profileMemories.length} Facts</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar pr-2">
                         {profileMemories.slice(0, 5).map((mem, i) => (
                            <div key={i} className="px-2 py-1 rounded-md bg-white/5 border border-white/5 text-[9px] font-bold text-gray-400">
                               {mem.length > 25 ? mem.slice(0, 25) + '...' : mem}
                            </div>
                         ))}
                         {profileMemories.length > 5 && (
                            <button onClick={() => setShowSettings(true)} className="text-[8px] font-bold text-blue-500 hover:underline pl-1">+ More</button>
                         )}
                      </div>
                   </div>
                )}
              </div>

              {/* Chat Index (Session Data) */}
              <div className="p-5 border-b border-white/5 flex items-center justify-between shrink-0">
                <h2 className="font-black text-[9px] uppercase tracking-[0.4em] text-gray-600 pt-1 flex items-center gap-2">
                   <Activity className="w-3 h-3" />
                   Session Flow
                </h2>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {messages.filter(m => m.role === 'user').map((msg, idx) => (
                  <button
                    key={msg.id}
                    onClick={() => { scrollToMessage(msg.id); if (isMobile) setIsSidebarOpen(false); }}
                    className="w-full text-left p-4 rounded-2xl border border-white/3 bg-white/1 hover:bg-blue-600/5 hover:border-blue-500/20 transition-all group active:scale-[0.98] relative overflow-hidden"
                  >
                    <div className="flex items-center gap-4 relative z-10">
                      <span className="text-[10px] font-black text-gray-500 group-hover:text-blue-500 bg-white/5 w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border border-white/5 transition-colors">{idx + 1}</span>
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
  const [activeTab, setActiveTab] = useState<'general' | 'personalization'>('general')
  const [keys, setKeys] = useState({ openai: '' })
  const [profile, setProfile] = useState({ custom_instructions: '', ai_memory: [] as string[] })
  const [newMemory, setNewMemory] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    // Load local keys
    const saved = localStorage.getItem('threadly_keys')
    if (saved) setKeys(JSON.parse(saved))

    // Load server profile
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        if (data) {
          try {
            const memoryArray = JSON.parse(data.ai_memory || '[]')
            setProfile({ custom_instructions: data.custom_instructions, ai_memory: Array.isArray(memoryArray) ? memoryArray : [] })
          } catch (e) {
            setProfile({ custom_instructions: data.custom_instructions, ai_memory: [] })
          }
        }
      }
    }
    loadProfile()
  }, [])

  const saveAll = async () => {
    setSaving(true)
    try {
      localStorage.setItem('threadly_keys', JSON.stringify(keys))
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { error } = await supabase.from('profiles').upsert({
          id: user.id,
          custom_instructions: profile.custom_instructions,
          ai_memory: JSON.stringify(profile.ai_memory),
          updated_at: new Date().toISOString()
        })
        if (error) throw error
      }
      toast("Configuration updated", "success")
      onClose()
    } catch (err: any) {
      toast(`Save failed: ${err.message}`, "error")
    } finally {
      setSaving(false)
    }
  }

  const addMemory = () => {
    if (!newMemory.trim()) return
    setProfile(prev => ({ ...prev, ai_memory: [...prev.ai_memory, newMemory.trim()] }))
    setNewMemory('')
  }

  const removeMemory = (index: number) => {
    setProfile(prev => ({ ...prev, ai_memory: prev.ai_memory.filter((_, i) => i !== index) }))
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 md:p-6 overflow-y-auto">
      <Card className="w-full max-w-xl border-white/5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        <CardHeader className="border-b border-white/5 pb-2">
          <div className="flex items-center justify-between mb-2">
             <CardTitle className="uppercase tracking-[0.3em] text-[10px] font-black flex items-center gap-2">
                <Settings className="w-4 h-4 text-blue-500" />
                Workspace Infrastructure
             </CardTitle>
             <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl"><X className="w-4 h-4" /></Button>
          </div>
          <div className="flex gap-6 mt-4">
             {['general', 'personalization'].map((tab) => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`pb-2 text-[9px] font-black uppercase tracking-[0.2em] transition-all border-b-2 ${
                    activeTab === tab ? 'border-blue-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {tab}
                </button>
             ))}
          </div>
        </CardHeader>

        <CardContent className="py-8 space-y-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {activeTab === 'general' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="space-y-3">
                <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">OpenAI API Key (BYOK Tunnel)</label>
                <Input type="password" value={keys.openai} onChange={(e) => setKeys({...keys, openai: e.target.value})} placeholder="sk-..." className="bg-black py-7 rounded-2xl border-white/5" />
              </div>
            </motion.div>
          )}

          {activeTab === 'personalization' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              <div className="space-y-4">
                <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 block mb-1">Custom Response Logic</label>
                <textarea 
                  value={profile.custom_instructions}
                  onChange={(e) => setProfile({...profile, custom_instructions: e.target.value})}
                  className="w-full bg-black border border-white/5 rounded-2xl p-5 text-sm font-bold outline-none focus:border-blue-500/50 min-h-[140px] resize-none custom-scrollbar transition-all"
                  placeholder="e.g. Always respond in TypeScript. Use a helpful engineer persona."
                />
              </div>

              <div className="space-y-4">
                <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 block mb-1">Managed AI Memory</label>
                <div className="flex gap-2">
                  <Input 
                    value={newMemory}
                    onChange={(e) => setNewMemory(e.target.value)}
                    placeholder="Fact to remember..."
                    className="bg-black border-white/5 rounded-xl h-12 text-xs"
                    onKeyDown={(e) => e.key === 'Enter' && addMemory()}
                  />
                  <Button onClick={addMemory} className="h-12 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4"><Plus className="w-4 h-4" /></Button>
                </div>
                <div className="space-y-2">
                  {profile.ai_memory.map((mem, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-white/2 border border-white/5 group">
                      <span className="text-xs font-bold text-gray-300">{mem}</span>
                      <button onClick={() => removeMemory(idx)} className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500/50 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                  {profile.ai_memory.length === 0 && (
                    <p className="text-[9px] text-gray-600 uppercase tracking-widest text-center py-4 italic">No memories recorded yet.</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </CardContent>

        <CardFooter className="border-t border-white/5 py-8 flex justify-end gap-3 px-8">
          <Button variant="ghost" onClick={onClose} className="font-black text-[9px] uppercase tracking-widest px-8 rounded-xl opacity-50 hover:opacity-100">Discard</Button>
          <Button 
            onClick={saveAll} 
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-500 rounded-xl px-12 font-black text-[9px] uppercase tracking-widest shadow-2xl shadow-blue-500/20 active:scale-95 transition-all h-12"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-2" /> : null}
            Commit All Changes
          </Button>
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

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        toast("Link copied to workspace clipboard", "success")
    }

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
                            <div key={p.id} className="p-5 rounded-2xl border border-white/5 bg-white/2 hover:bg-blue-600/5 hover:border-blue-500/20 text-left transition-all active:scale-[0.98] group relative">
                                <h4 className="font-black text-[10px] uppercase tracking-widest text-blue-500 mb-2">{p.title}</h4>
                                <p className="text-xs text-gray-500 font-bold line-clamp-2 leading-relaxed mb-4">{p.template}</p>
                                <div className="flex items-center gap-2">
                                   <Button size="sm" onClick={() => { onSelect(p.template); onClose(); }} className="h-8 rounded-lg bg-white text-black text-[9px] font-black uppercase px-4 hover:bg-gray-200">Use</Button>
                                   <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg border border-white/5 text-gray-500 hover:text-white" onClick={() => copyToClipboard(`${window.location.origin}/p/${p.id}`)}>
                                      <LinkIcon className="w-3.5 h-3.5" />
                                   </Button>
                                </div>
                            </div>
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
