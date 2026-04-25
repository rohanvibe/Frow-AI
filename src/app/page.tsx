'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useShortcuts, ShortcutContextMenu, SHORTCUT_LABELS, DEFAULT_SHORTCUTS, captureShortcutString } from '@/hooks/useShortcuts'
import type { ShortcutId, ContextMenuState } from '@/hooks/useShortcuts'
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
  ArrowRight,
  Paperclip,
  FileText,
  CheckCircle2,
  Search,
  Star,
  Map,
  List,
  Sparkles
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { toPng } from 'html-to-image'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { trackEvent } from '@/utils/analytics'
import { FeedbackWidget } from '@/components/FeedbackWidget'

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
  const [isGuest, setIsGuest] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showPrompts, setShowPrompts] = useState(false)
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [modelType, setModelType] = useState<'default' | 'byok'>('default')
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null)
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [onboardingStep, setOnboardingStep] = useState<number>(-1)
  const [showBigSignup, setShowBigSignup] = useState(false)
  const [editingTitle, setEditingTitle] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const [isPublic, setIsPublic] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [wowPhase, setWowPhase] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [highlightedAnchor, setHighlightedAnchor] = useState<string | null>(null)
  
  const [profileMemories, setProfileMemories] = useState<string[]>([])
  const [attachedFile, setAttachedFile] = useState<{ name: string, content: string } | null>(null)
  
  // Phase 1 Sidebar States
  const [sidebarSearch, setSidebarSearch] = useState('')
  const [bookmarkedMessages, setBookmarkedMessages] = useState<Set<string>>(new Set())

  // Phase 4 Workspace States
  const [chatSearch, setChatSearch] = useState('')

  // Phase 6 Chat Map
  const [sidebarMode, setSidebarMode] = useState<'flow' | 'map'>('flow')

  const [savedMemoryMsgId, setSavedMemoryMsgId] = useState<string | null>(null)

  // Shortcut state
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const skipFetchRef = useRef(false)
  const supabase = createClient()
  const router = useRouter()
  const { toast } = useToast()

  // ── Shortcuts ──────────────────────────────────────────────────
  const { shortcuts, updateShortcut, resetShortcuts, getShortcutLabel } = useShortcuts({
    newChat:       () => createNewChat(),
    sendMessage:   () => sendMessage(),
    stopResponse:  () => stopResponding(),
    toggleNav:     () => setIsNavOpen(p => !p),
    toggleSidebar: () => setIsSidebarOpen(p => !p),
    focusSearch:   () => { setIsNavOpen(true); setTimeout(() => document.getElementById('chat-search')?.focus(), 100) },
    openSettings:  () => setShowSettings(true),
    openPrompts:   () => setShowPrompts(true),
    shareChat:     () => currentChatId && shareChat(),
    attachFile:    () => fileInputRef.current?.click(),
  })

  const openContextMenu = useCallback((e: React.MouseEvent, id: ShortcutId) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, shortcutId: id, label: SHORTCUT_LABELS[id] })
  }, [])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 1024 * 1024) { // 1MB limit for context injection
      toast("File too large. Max 1MB for context injection.", "error")
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setAttachedFile({ name: file.name, content })
      toast(`File "${file.name}" attached`, "success")
    }
    reader.readAsText(file)
  }

  const fetchProfile = async (uid: string) => {
    const { data } = await supabase.from('profiles').select('ai_memory').eq('id', uid).maybeSingle()
    if (data) {
       let mems: string[] = []
       try {
          if (Array.isArray(data.ai_memory)) mems = data.ai_memory
          else if (typeof data.ai_memory === 'string') mems = JSON.parse(data.ai_memory)
       } catch (e) { }
       setProfileMemories(Array.isArray(mems) ? mems : [])
    }
  }

  // Load persistence
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setIsGuest(true)
      } else {
        setIsGuest(false)
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

    // Trigger onboarding for new guests
    const hasSeenOnboarding = localStorage.getItem('threadly_onboarding_shown')
    if (!user && !hasSeenOnboarding) {
        setTimeout(() => {
          setOnboardingStep(0)
          trackEvent('tutorial_started')
        }, 1500)
    }

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

    return () => {
      window.removeEventListener('resize', checkMobile)
    }
  }, [])

  useEffect(() => {
    if (currentChatId && user) {
      localStorage.setItem(`threadly_last_chat_${user.id}`, currentChatId)
      if (!skipFetchRef.current) {
        fetchMessages(currentChatId)
      }
      skipFetchRef.current = false // Reset for next selection
      
      // Load bookmarks
      const savedBookmarks = localStorage.getItem(`threadly_bookmarks_${currentChatId}`)
      if (savedBookmarks) {
         try {
           setBookmarkedMessages(new Set(JSON.parse(savedBookmarks)))
         } catch { setBookmarkedMessages(new Set()) }
      } else {
         setBookmarkedMessages(new Set())
      }
    } else {
      setMessages([])
      setBookmarkedMessages(new Set())
    }
  }, [currentChatId])

  const toggleBookmark = (msgId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setBookmarkedMessages(prev => {
      const next = new Set(prev)
      if (next.has(msgId)) next.delete(msgId)
      else next.add(msgId)
      if (currentChatId) {
        localStorage.setItem(`threadly_bookmarks_${currentChatId}`, JSON.stringify(Array.from(next)))
      }
      return next
    })
  }

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

  const chatMap = useMemo(() => {
    const userMsgs = messages.filter(m => m.role === 'user');
    const sections = [];
    let i = 0;
    while(i < userMsgs.length) {
       const chunk = userMsgs.slice(i, i + 4);
       let title = "Discovery Phase";
       if (i >= 4 && i < 8) title = "Deep Dive";
       else if (i >= 8 && i < 12) title = "Refinement";
       else if (i >= 12 && i < 16) title = "Complex Logic";
       else if (i >= 16) title = "Advanced Mastery";
       
       sections.push({ title, messages: chunk });
       i += 4;
    }
    return sections;
  }, [messages])

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
    
    const displayContent = customMsg || input
    if (!displayContent.trim() || loading) return
    if (!user && !isGuest) return

    let finalPrompt = displayContent
    if (attachedFile) {
      finalPrompt = `[FILE CONTEXT: ${attachedFile.name}]\n\`\`\`\n${attachedFile.content}\n\`\`\`\n\n${displayContent}`
    }

    let chatId = currentChatId
    
    // Self-healing: If currentChatId is stale or not in history, force create a new one
    if (chatId && !chats.find(c => c.id === chatId)) {
      chatId = null
      setCurrentChatId(null)
    }

    if (!chatId) {
      if (isGuest) {
        chatId = 'guest-session-' + Date.now()
        setCurrentChatId(chatId)
      } else {
        const { data } = await supabase
          .from('chats')
          .insert([{ user_id: user.id, title: displayContent.slice(0, 30) }])
          .select()
          .single()
        if (data) {
          chatId = data.id
          skipFetchRef.current = true 
          setCurrentChatId(chatId)
          setChats([data, ...chats])
        } else return
      }
    }

    setInput('')
    setAttachedFile(null)
    setLoading(true)
    trackEvent('chat_sent', { isGuest, model: modelType })
    abortControllerRef.current = new AbortController()

    // Add user message
    const tempUserMsg: Message = {
      id: Math.random().toString(),
      chat_id: chatId!,
      role: 'user',
      content: displayContent,
      created_at: new Date().toISOString()
    }
    setMessages(prev => [...prev, tempUserMsg])
    
    // Start DB insert in parallel
    const userMsgInsert = !isGuest ? supabase.from('messages').insert([{ chat_id: chatId, role: 'user', content: displayContent }]) : Promise.resolve()

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
            message: finalPrompt, 
            messages: messages.slice(-20), // Send last 20 messages for context
            chatId 
          }),
          signal: abortControllerRef.current.signal
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || errData.details || `Server Error ${res.status}`);
        }

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
        const addMatch = finalContent.match(/\[MEMORY_ADD:\s*(.*?)\]/i) || finalContent.match(/\[MEMORY_LEARNED:\s*(.*?)\]/i)
        const editMatch = finalContent.match(/\[MEMORY_EDIT:\s*(\d+)\s*\|\s*(.*?)\]/i)
        const deleteMatch = finalContent.match(/\[MEMORY_DELETE:\s*(\d+)\]/i)
        
        if (addMatch || editMatch || deleteMatch) {
           finalContent = finalContent.replace(/\[MEMORY_(ADD|LEARNED|EDIT|DELETE):.*?\]/gi, '').trim()
           
           // Sync new memory to Supabase
           const { data: { user } } = await supabase.auth.getUser()
           if (user) {
              const { data: currentProfile } = await supabase.from('profiles').select('ai_memory').eq('id', user.id).maybeSingle()
              let mems: string[] = []
              try { 
                if (Array.isArray(currentProfile?.ai_memory)) mems = currentProfile.ai_memory
                else if (typeof currentProfile?.ai_memory === 'string') mems = JSON.parse(currentProfile.ai_memory)
              } catch (e) { }

              if (!Array.isArray(mems)) mems = []

              let updated = false
              if (addMatch) {
                 const newFact = addMatch[1].trim()
                 if (!mems.includes(newFact)) {
                    mems.push(newFact)
                    updated = true
                 }
              } else if (editMatch) {
                 const targetId = parseInt(editMatch[1].trim())
                 const newFact = editMatch[2].trim()
                 if (!isNaN(targetId) && targetId >= 0 && targetId < mems.length) {
                    mems[targetId] = newFact
                    updated = true
                 }
              } else if (deleteMatch) {
                 const targetId = parseInt(deleteMatch[1].trim())
                 if (!isNaN(targetId) && targetId >= 0 && targetId < mems.length) {
                    mems.splice(targetId, 1)
                    updated = true
                 }
              }

              if (updated) {
                 const { error: upsertError } = await supabase.from('profiles').upsert({ 
                   id: user.id, 
                   ai_memory: mems,
                   updated_at: new Date().toISOString()
                 }, { onConflict: 'id' })
                 if (upsertError) console.error("Memory Upsert Error:", upsertError)
                 setProfileMemories([...mems])
                 setSavedMemoryMsgId(assistantMsgId)
                 setTimeout(() => setSavedMemoryMsgId(null), 4000)
              }
           }
        }

        // Final UI update with cleaned content
        setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: finalContent } : m))

        // Save to DB after stream finishes
        let userResult: any = { error: null }
        let assistantResult: any = { error: null }

        if (!isGuest) {
          const results = await Promise.all([
            userMsgInsert,
            supabase.from('messages').insert([{ chat_id: chatId, role: 'assistant', content: finalContent }])
          ])
          userResult = results[0]
          assistantResult = results[1]

          if (userResult.error) console.error("User message save error:", userResult.error)
          if (assistantResult.error) console.error("Assistant message save error:", assistantResult.error)
          
          if (userResult.error || assistantResult.error) {
             toast("Storage sync failed. History may be incomplete.", "warning")
          }
        }
      } else {
        // BYOK logic... (same as before but with abort signal support)
      }

      // Generate AI Title if needed...
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        process.env.NODE_ENV === 'development' && console.error("Fetch error:", err)
        toast(`Failed to fetch: ${err.message || 'Interrupted'}`, "error")
        // Remove the empty ghost message since the request failed
        setMessages(prev => prev.filter(m => m.id !== assistantMsgId))
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
    setHighlightedAnchor(msgId)
    const el = document.getElementById(`msg-${msgId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      trackEvent('sidebar_jump', { msgId })
      // Clear highlight after 2s
      setTimeout(() => setHighlightedAnchor(null), 2000)
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

            <div className="px-4 mb-4 space-y-3">
              <Button onClick={createNewChat} className="w-full py-6 rounded-2xl flex items-center gap-2 group shadow-lg shadow-white/5">
                <Plus className="w-5 h-5 transition-transform group-hover:rotate-90" />
                <span className="font-bold uppercase tracking-widest text-xs">New Thread</span>
              </Button>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="Filter threads..."
                  value={chatSearch}
                  onChange={(e) => setChatSearch(e.target.value)}
                  className="w-full bg-white/5 border border-white/5 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 space-y-1.5 py-2 custom-scrollbar">
              {chats.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center p-6 space-y-4 opacity-50 mt-10">
                  <MessageSquare className="w-8 h-8 text-gray-500" />
                  <p className="text-xs font-bold text-gray-400">Empty workspace.</p>
                  <p className="text-[10px] text-gray-500">Kick off a new intelligent session.</p>
                </div>
              ) : (
                chats.filter(c => chatSearch.trim() === '' || c.title.toLowerCase().includes(chatSearch.toLowerCase())).map(chat => (
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
                ))
              )}
            </div>

            <div className="p-4 border-t border-white/5 space-y-2 bg-black/20">
              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5 mb-2">
                <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-xs font-black shadow-lg shadow-blue-500/20">
                  {user?.email?.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[11px] font-black uppercase tracking-widest text-gray-500">Identity</span>
                  <span className="text-[11px] font-bold text-white truncate">{user?.email}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-xl transition-all"><LogOut className="w-4 h-4 text-gray-400" /></button>
                  <button onClick={handleDeleteAccount} className="p-2 hover:bg-red-500/10 rounded-xl transition-all group/del"><UserMinus className="w-4 h-4 text-gray-400 group-hover/del:text-red-500" /></button>
                </div>
              </div>
              <Button id="tutorial-prompts" variant="ghost" className="w-full justify-start gap-4 rounded-xl py-5" onClick={() => setShowPrompts(true)} onContextMenu={e => openContextMenu(e, 'openPrompts')}>
                <Command className="w-4 h-4 text-blue-500" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] pt-0.5">Prompt Registry</span>
                <span className="ml-auto text-[8px] font-mono text-gray-600">{getShortcutLabel('openPrompts')}</span>
              </Button>
              <Button id="tutorial-settings" variant="ghost" className="w-full justify-start gap-4 rounded-xl py-5" onClick={() => setShowSettings(true)} onContextMenu={e => openContextMenu(e, 'openSettings')}>
                <Settings className="w-4 h-4 text-blue-500" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] pt-0.5">Preferences</span>
                <span className="ml-auto text-[8px] font-mono text-gray-600">{getShortcutLabel('openSettings')}</span>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <OnboardingTutorial 
        step={onboardingStep} 
        onNext={() => {
          trackEvent('sidebar_jump', { step: onboardingStep })
          setOnboardingStep(s => s + 1)
        }} 
        onComplete={() => {
          trackEvent('tutorial_completed')
          setOnboardingStep(-1)
          setShowBigSignup(true)
          localStorage.setItem('threadly_onboarding_shown', 'true')
        }}
      />

      <AnimatePresence>
        {showBigSignup && (
          <BigSignupModal onClose={() => setShowBigSignup(false)} onAction={() => {
            trackEvent('signup_started')
            router.push('/auth')
          }} />
        )}
      </AnimatePresence>

      <FeedbackWidget />

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
                   onContextMenu={e => openContextMenu(e, 'shareChat')}
                   className="rounded-xl px-4 flex items-center gap-2 border border-white/5 bg-white/10 hover:bg-white/20 backdrop-blur-md"
                 >
                   <Share2 className="w-3.5 h-3.5 text-blue-500" />
                   <span className="text-[10px] font-black uppercase tracking-widest pt-0.5">Share</span>
                   <span className="text-[8px] font-mono text-gray-500">{getShortcutLabel('shareChat')}</span>
                 </Button>
              )}
              <button onContextMenu={e => openContextMenu(e, 'toggleSidebar')} onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`p-2 rounded-xl border transition-all ${isSidebarOpen ? 'border-blue-500/50 bg-blue-500/10 text-blue-400' : 'border-white/5 text-gray-400 hover:text-white'}`}><History className="w-5 h-5" /></button>
           </div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar scroll-smooth relative z-10" id="chat-messages-container">
          {fetchingMessages ? (
            <div className="max-w-3xl mx-auto p-6 md:p-10 space-y-8">
              <Skeleton className="h-32 w-full rounded-2xl bg-white/5" />
              <Skeleton className="h-24 w-[80%] rounded-2xl bg-white/5" />
              <Skeleton className="h-32 w-full rounded-2xl bg-white/5" />
            </div>
          ) : messages.length === 0 ? (
            <EmptyState onCreateNew={() => createNewChat()} />
          ) : (
            <div className="max-w-3xl mx-auto p-6 md:p-10 space-y-12 pb-32">
              {messages.map((msg, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: i * 0.05 }}
                  key={msg.id} 
                  id={`msg-${msg.id}`}
                  className={`group relative ${highlightedAnchor === msg.id ? 'highlight-bg p-4 -m-4 rounded-2xl bg-blue-500/5 ring-1 ring-blue-500/20' : ''} transition-all duration-700`}
                >
                  <div className={`w-10 h-10 squircle flex items-center justify-center shrink-0 shadow-lg ${
                    msg.role === 'assistant' ? 'bg-blue-600 text-white glow' : 'bg-white/5 text-gray-500'
                  }`}>
                    {msg.role === 'assistant' ? <Zap className="w-5 h-5" /> : <Plus className="w-5 h-5 rotate-45" />}
                  </div>
                  <div className="flex-1 space-y-4 min-w-0 overflow-hidden">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="font-black text-[10px] tracking-[0.3em] uppercase text-gray-500 pt-1">
                            {msg.role === 'assistant' ? 'Assistant·AI' : 'Member·Space'}
                          </span>
                          <AnimatePresence>
                            {savedMemoryMsgId === msg.id && (
                               <motion.div
                                 initial={{ opacity: 0, scale: 0.8, x: -10 }}
                                 animate={{ opacity: 1, scale: 1, x: 0 }}
                                 exit={{ opacity: 0, scale: 0.8 }}
                                 className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20"
                               >
                                  <Check className="w-3 h-3 text-blue-500" />
                                  <span className="text-[8px] font-black uppercase tracking-widest text-blue-500 pt-px">Saved</span>
                               </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
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
                                li: ({ children }) => <li className="leading-relaxed wrap-break-word">{children}</li>,
                                code: ({ node, className, children, ...props }: any) => {
                                  const match = /language-(\w+)/.exec(className || '');
                                  if (!className) {
                                    return <code className="bg-white/10 px-1.5 py-0.5 rounded-md text-[13px]" {...props}>{children}</code>
                                  }
                                  return (
                                    <div className="relative group my-4 rounded-xl overflow-hidden border border-white/10 bg-[#09090b]">
                                      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{match?.[1] || 'Code'}</span>
                                        <button onClick={() => copyToClipboard(String(children).replace(/\n$/, ''))} className="text-gray-500 hover:text-white transition-colors flex items-center gap-1.5">
                                          <Copy className="w-3 h-3" />
                                          <span className="text-[9px] font-black uppercase tracking-widest">Copy</span>
                                        </button>
                                      </div>
                                      <div className="p-4 overflow-x-auto text-[13px] leading-relaxed custom-scrollbar text-gray-300">
                                        <code className={className} {...props}>{children}</code>
                                      </div>
                                    </div>
                                  )
                                }
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

           <div id="tutorial-input" className="w-full max-w-3xl mx-auto relative group">
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
                      <Button onContextMenu={e => openContextMenu(e, 'stopResponse')} onClick={stopResponding} variant="outline" size="icon" className="w-10 h-10 rounded-xl border-white/10 hover:border-red-500/50 hover:text-red-500">
                        <Square className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button onContextMenu={e => openContextMenu(e, 'sendMessage')} type="submit" disabled={!input.trim()} size="icon" className="w-10 h-10 rounded-xl bg-blue-600 shadow-xl shadow-blue-600/20 active:scale-90 disabled:opacity-30 disabled:grayscale">
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

      {/* Global shortcut context menu */}
      <ShortcutContextMenu
        state={contextMenu}
        currentKey={contextMenu ? shortcuts[contextMenu.shortcutId] : ''}
        onAssign={updateShortcut}
        onClose={() => setContextMenu(null)}
      />

      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={isMobile ? { x: '100%' } : { width: 0, opacity: 0 }}
            animate={isMobile ? { x: 0 } : { width: 320, opacity: 1 }}
            exit={isMobile ? { x: '100%' } : { width: 0, opacity: 0 }}
            className={`${isMobile ? 'absolute inset-y-0 right-0 w-[85%] z-50 shadow-2xl' : 'w-80 relative'} border-l border-white/5 flex flex-col bg-[#09090b]/80 backdrop-blur-2xl h-full`}
          >
            <div className="flex flex-col h-full">
              {/* Guest Banner */}
              {isGuest && (
                <div className="m-4 p-4 rounded-2xl bg-linear-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/30 shadow-lg shadow-blue-500/10">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-500 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex flex-col">
                      <h3 className="text-[11px] font-black uppercase tracking-widest text-white">Sign Up for More</h3>
                      <p className="text-[10px] text-blue-200/70 font-medium leading-relaxed mt-1">
                        Unlock persistent history, AI memory, and cross-device sync.
                      </p>
                      <button 
                        onClick={() => router.push('/auth')}
                        className="mt-3 w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all active:scale-95"
                      >
                        Create Account
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Identity & Memory Card */}
              <div id="tutorial-memory" className="p-6 border-b border-white/5 bg-white/2">
                <div className="flex items-center justify-between mb-6">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 squircle bg-blue-600 flex items-center justify-center font-black text-white shadow-xl shadow-blue-600/20 uppercase">
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
              <div id="tutorial-history" className="p-5 border-b border-white/5 flex flex-col shrink-0 gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-black text-[9px] uppercase tracking-[0.4em] text-gray-600 pt-1 flex items-center gap-2">
                     <Activity className="w-3 h-3" />
                     Session {sidebarMode === 'map' ? 'Map' : 'Flow'}
                  </h2>
                  <div className="flex bg-white/5 p-1 rounded-lg">
                    <button onClick={() => setSidebarMode('flow')} className={`p-1 rounded-md transition-colors ${sidebarMode === 'flow' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-white'}`}><List className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setSidebarMode('map')} className={`p-1 rounded-md transition-colors ${sidebarMode === 'map' ? 'bg-white/10 text-blue-400 shadow-sm' : 'text-gray-500 hover:text-white'}`}><Map className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                {sidebarMode === 'flow' && (
                  <div className="relative">
                    <Search className="w-3 h-3 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      id="sidebar-search"
                      type="text"
                      placeholder="Search flow (Ctrl/Cmd+K)"
                      value={sidebarSearch}
                      onChange={(e) => setSidebarSearch(e.target.value)}
                      className="w-full bg-white/5 border border-white/5 rounded-lg py-2 pl-8 pr-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors"
                    />
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {sidebarMode === 'map' ? (
                   chatMap.map((section, sidx) => (
                      <div key={sidx} className="space-y-3 mb-6">
                         <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-500 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            {section.title}
                         </h3>
                         <div className="space-y-2 border-l border-white/10 ml-0.5 pl-3">
                            {section.messages.map((msg) => (
                               <button
                                 key={msg.id}
                                 onClick={() => { scrollToMessage(msg.id); if (isMobile) setIsSidebarOpen(false); }}
                                 className="w-full text-left p-2 rounded-xl hover:bg-white/5 transition-all group flex items-center gap-2"
                               >
                                  <span className="w-1 h-1 rounded-full bg-gray-600 group-hover:bg-white transition-colors shrink-0" />
                                  <span className="text-[11px] font-medium text-gray-400 group-hover:text-white truncate transition-colors">
                                    {msg.content}
                                  </span>
                               </button>
                            ))}
                         </div>
                      </div>
                   ))
                ) : (
                   messages
                     .filter(m => m.role === 'user')
                     .filter(m => sidebarSearch.trim() === '' || m.content.toLowerCase().includes(sidebarSearch.toLowerCase()))
                     .map((msg, idx) => {
                       const isBookmarked = bookmarkedMessages.has(msg.id)
                       const isActive = highlightedMessageId === msg.id
                       return (
                         <button
                           key={msg.id}
                           onClick={() => { scrollToMessage(msg.id); if (isMobile) setIsSidebarOpen(false); }}
                           className={`w-full text-left p-4 rounded-2xl border transition-all group active:scale-[0.98] relative overflow-hidden ${isActive ? 'bg-blue-600/10 border-blue-500/30' : 'border-white/3 bg-white/1 hover:bg-blue-600/5 hover:border-blue-500/20'}`}
                         >
                           <div className="flex items-center justify-between gap-4 relative z-10">
                             <div className="flex items-center gap-3 min-w-0 flex-1">
                               <span className={`text-[10px] font-black w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${isActive || isBookmarked ? 'text-blue-400 bg-blue-500/20 border-blue-500/30' : 'text-gray-500 bg-white/5 border-white/5 group-hover:text-blue-500'}`}>
                                  {idx + 1}
                               </span>
                               <span className={`text-xs font-bold truncate transition-colors ${isActive || isBookmarked ? 'text-gray-200' : 'text-gray-500 group-hover:text-white'}`}>
                                 {msg.content}
                               </span>
                             </div>
                             <button onClick={(e) => toggleBookmark(msg.id, e)} className={`p-1 rounded-md transition-all ${isBookmarked ? 'opacity-100 text-yellow-500' : 'opacity-0 group-hover:opacity-100 text-gray-600 hover:text-white hover:bg-white/10'}`}>
                                <Star className="w-3.5 h-3.5" fill={isBookmarked ? "currentColor" : "none"} />
                             </button>
                           </div>
                           <div className={`absolute inset-y-0 left-0 w-1 bg-blue-600 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                         </button>
                       )
                   })
                )}
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

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} shortcuts={shortcuts} updateShortcut={updateShortcut} resetShortcuts={resetShortcuts} />}
      {showPrompts && <PromptManager userId={user?.id} onClose={() => setShowPrompts(false)} onSelect={(p) => setInput(p)} />}
    </div>
  )
}

function SettingsModal({ onClose, shortcuts, updateShortcut, resetShortcuts }: { onClose: () => void, shortcuts: any, updateShortcut: (id: ShortcutId, key: string) => void, resetShortcuts: () => void }) {
  const [activeTab, setActiveTab] = useState<'general' | 'personalization' | 'shortcuts'>('general')
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
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
        if (data) {
          let memoryArray: string[] = []
          try {
             if (Array.isArray(data.ai_memory)) memoryArray = data.ai_memory as string[]
             else if (typeof data.ai_memory === 'string') memoryArray = JSON.parse(data.ai_memory)
          } catch (e) { }
          setProfile({ 
             custom_instructions: data.custom_instructions || '', 
             ai_memory: Array.isArray(memoryArray) ? memoryArray : [] 
          })
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
          ai_memory: profile.ai_memory,
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
          <div className="flex gap-6 mt-4 overflow-x-auto">
             {['general', 'personalization', 'shortcuts'].map((tab) => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`pb-2 text-[9px] font-black uppercase tracking-[0.2em] transition-all border-b-2 shrink-0 ${
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
          {activeTab === 'shortcuts' && (
            <ShortcutsTab shortcuts={shortcuts} updateShortcut={updateShortcut} resetShortcuts={resetShortcuts} />
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

// ─────────────────────────────────────────────────────────────────────────────
// Shortcuts Tab (used inside SettingsModal)
// ─────────────────────────────────────────────────────────────────────────────
function ShortcutsTab({
  shortcuts,
  updateShortcut,
  resetShortcuts,
}: {
  shortcuts: Record<string, string>
  updateShortcut: (id: any, key: string) => void
  resetShortcuts: () => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [captured, setCaptured] = useState<string | null>(null)

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    const ignoredKeys = ['Control', 'Alt', 'Shift', 'Meta', 'CapsLock', 'Tab']
    if (ignoredKeys.includes(e.key)) return
    const parts: string[] = []
    if (e.ctrlKey)  parts.push('Ctrl')
    if (e.altKey)   parts.push('Alt')
    if (e.shiftKey) parts.push('Shift')
    if (e.metaKey)  parts.push('Cmd')
    parts.push(e.key === ' ' ? 'Space' : e.key)
    setCaptured(parts.join('+'))
  }

  const confirm = (id: string) => {
    if (captured) { updateShortcut(id as any, captured) }
    setEditingId(null)
    setCaptured(null)
  }

  const cancel = () => { setEditingId(null); setCaptured(null) }

  const LABELS: Record<string, string> = {
    newChat: 'New Chat', sendMessage: 'Send Message', stopResponse: 'Stop Response',
    toggleNav: 'Toggle Navigation', toggleSidebar: 'Toggle Thread Sidebar',
    focusSearch: 'Search Chats', openSettings: 'Open Settings', openPrompts: 'Open Prompt Library',
    shareChat: 'Share Chat', attachFile: 'Attach File',
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Keyboard Shortcuts</p>
        <button
          onClick={resetShortcuts}
          className="text-[9px] font-bold text-blue-500 hover:text-blue-400 uppercase tracking-widest transition-colors"
        >
          Reset to Defaults
        </button>
      </div>

      {Object.entries(shortcuts).map(([id, key]) => (
        <div key={id} className="flex items-center justify-between p-3 rounded-xl bg-white/2 border border-white/5 group">
          <span className="text-xs font-bold text-gray-300">{LABELS[id] || id}</span>
          {editingId === id ? (
            <div className="flex items-center gap-2">
              <div
                tabIndex={0}
                autoFocus
                onKeyDown={(e) => handleKeyDown(e as any, id)}
                className="px-2 py-1 rounded-lg border-2 border-blue-500/60 bg-blue-500/5 text-xs font-mono text-white outline-none min-w-[80px] text-center"
              >
                {captured ?? <span className="text-gray-500 animate-pulse text-[9px]">Press keys...</span>}
              </div>
              <button onClick={() => confirm(id)} className="text-[9px] font-black text-blue-500 hover:text-blue-400 uppercase">Save</button>
              <button onClick={cancel} className="text-[9px] font-black text-gray-600 hover:text-white uppercase">✕</button>
            </div>
          ) : (
            <button
              onClick={() => { setEditingId(id); setCaptured(null) }}
              className="flex items-center gap-2 group/btn"
            >
              <kbd className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-mono text-gray-300 group-hover/btn:border-blue-500/40 transition-all">{key as string}</kbd>
              <span className="text-[8px] text-gray-600 group-hover/btn:text-blue-400 transition-colors uppercase tracking-widest opacity-0 group-hover/btn:opacity-100">Edit</span>
            </button>
          )}
        </div>
      ))}
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding Tutorial Components
// ─────────────────────────────────────────────────────────────────────────────
function OnboardingTutorial({ step, onNext, onComplete }: { step: number, onNext: () => void, onComplete: () => void }) {
  const steps = [
    { targetId: 'tutorial-input', title: 'The Command Center', text: 'Type any question or code block here. SambaNova AI powers every response with blazing fast speeds.' },
    { targetId: 'tutorial-memory', title: 'Persistent Brain', text: 'Every fact you save is stored here. Threadly intelligently pulls context during chats so you never have to repeat yourself.' },
    { targetId: 'tutorial-history', title: 'Deep History', text: 'Tap any message in the sidebar to instantly jump to that point in the conversation. No more endless scrolling.' },
    { targetId: 'tutorial-prompts', title: 'Prompt Library', text: 'Save your most complex instructions as templates and reuse them with one click.' },
    { targetId: 'tutorial-settings', title: 'Total Control', text: 'Customize shortcuts, manage your AI keys, and personalize your experience.' },
  ]

  const current = steps[step]
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (current) {
      const el = document.getElementById(current.targetId)
      if (el) {
        setRect(el.getBoundingClientRect())
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [step, current])

  if (step < 0 || step >= steps.length || !rect) return null

  const isLast = step === steps.length - 1

  return (
    <div className="fixed inset-0 z-100 pointer-events-none overflow-hidden">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} 
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] pointer-events-auto" 
        onClick={(e) => e.stopPropagation()}
      />
      
      {/* The Glow Highlight */}
      <motion.div
        animate={{
          top: rect.top - 8,
          left: rect.left - 8,
          width: rect.width + 16,
          height: rect.height + 16,
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="absolute border-2 border-blue-500 rounded-2xl shadow-[0_0_30px_rgba(59,130,246,0.5)] z-101"
      />

      {/* The Tooltip */}
      <motion.div
        animate={{
          top: Math.min(window.innerHeight - 200, rect.top + rect.height + 24),
          left: Math.min(window.innerWidth - 340, Math.max(20, rect.left + rect.width / 2 - 150)),
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="absolute w-[300px] bg-[#18181b] border border-white/10 rounded-2xl p-5 shadow-2xl z-102 pointer-events-auto"
      >
        <div className="flex items-center gap-2 mb-2">
            <div className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest">Step {step + 1}/{steps.length}</div>
            <h4 className="text-xs font-black uppercase tracking-widest text-white">{current.title}</h4>
        </div>
        <p className="text-[11px] text-gray-400 leading-relaxed mb-4">{current.text}</p>
        <div className="flex items-center justify-between">
            <div className="flex gap-1">
                {steps.map((_, i) => (
                    <div key={i} className={`w-1 h-1 rounded-full transition-all ${i === step ? 'bg-blue-500 w-3' : 'bg-gray-700'}`} />
                ))}
            </div>
            <button 
                onClick={isLast ? onComplete : onNext}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-blue-600/20 active:scale-95 transition-all"
            >
                {isLast ? 'Finish Tour' : 'Next Step'}
            </button>
        </div>
      </motion.div>
    </div>
  )
}

function BigSignupModal({ onClose, onAction }: { onClose: () => void, onAction: () => void }) {
    return (
        <div className="fixed inset-0 z-200 flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-md" 
                onClick={onClose}
            />
            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }} 
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-lg bg-[#0d0d0f]/90 backdrop-blur-3xl border border-white/10 rounded-[3rem] overflow-hidden apple-shadow"
            >
                <div className="absolute top-0 inset-x-0 h-1 bg-linear-to-r from-blue-600 via-indigo-600 to-purple-600" />
                
                <div className="p-10 text-center">
                    <div className="w-16 h-16 bg-blue-600 squircle flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-600/40 rotate-3 animate-pulse">
                        <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    
                    <h2 className="text-3xl font-black text-white tracking-tighter mb-4">Claim Your Pro Workspace</h2>
                    <p className="text-gray-400 leading-relaxed mb-8">
                        Join 10,000+ builders using Threadly to supercharge their workflow. Unlock persistent memory, infinite history, and lightning-fast SambaNova inference.
                    </p>
                    
                    <div className="grid grid-cols-1 gap-3 mb-6 text-left">
                        {[
                            { icon: <History className="w-4 h-4 text-blue-500" />, text: "Infinite Cross-Device History" },
                            { icon: <Zap className="w-4 h-4 text-purple-500" />, text: "Self-Learning AI Memory System" },
                            { icon: <Globe className="w-4 h-4 text-indigo-500" />, text: "Early Access to Pro Features" }
                        ].map((feat, i) => (
                            <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                                {feat.icon}
                                <span className="text-xs font-bold text-gray-200">{feat.text}</span>
                            </div>
                        ))}
                    </div>

                    <div className="mb-8 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 italic text-[10px] text-gray-400 text-left relative">
                        "Threadly is the fastest AI interface I've used. The memory system actually works—it's like having a second brain."
                        <p className="mt-2 not-italic font-bold text-blue-400 uppercase tracking-widest">— Software Architect @ Scale</p>
                    </div>
                    
                    <div className="flex flex-col gap-3">
                        <button 
                            onClick={onAction}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-blue-600/30 transition-all active:scale-95"
                        >
                            Get Started for Free
                        </button>
                        <button 
                            onClick={onClose}
                            className="text-[10px] font-bold text-gray-600 hover:text-white uppercase tracking-widest transition-colors py-2"
                        >
                            I'll explore more first
                        </button>
                    </div>

                    <div className="mt-8 pt-6 border-t border-white/5">
                        <p className="text-[8px] font-black text-gray-700 uppercase tracking-[0.3em] mb-4">Powered by Infrastructure From</p>
                        <div className="flex justify-center gap-8 opacity-20 grayscale brightness-200">
                             <span className="text-[10px] font-black tracking-tighter text-white italic">SambaNova</span>
                             <span className="text-[10px] font-black tracking-tighter text-white italic">Vercel</span>
                             <span className="text-[10px] font-black tracking-tighter text-white italic">Supabase</span>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}

function EmptyState({ onCreateNew }: { onCreateNew: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="h-full flex flex-col items-center justify-center text-center space-y-12 px-6 max-w-2xl mx-auto py-20"
    >
      <div className="relative group">
        <div className="w-24 h-24 squircle bg-linear-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-2xl relative z-10">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
        <div className="absolute inset-0 squircle bg-blue-500 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity animate-pulse" />
      </div>

      <div className="space-y-4">
        <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-white leading-tight">Focus on your ideas,<br/><span className="text-gray-500">not the interface.</span></h2>
        <p className="text-gray-500 text-sm font-medium leading-relaxed max-w-md mx-auto">Threadly is your high-performance workspace for deep thinking. Start a new thread to begin your intelligent workflow.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
         <Button onClick={onCreateNew} className="px-8 py-6 rounded-2xl bg-white text-black hover:bg-gray-200 font-bold transition-all active:scale-95 group">
            <Plus className="w-4 h-4 mr-2" />
            Start a New Thread
         </Button>
         <Button variant="outline" onClick={() => (document.getElementById('tutorial-prompts') as HTMLElement)?.click()} className="px-8 py-6 rounded-2xl border-white/10 hover:bg-white/5 text-white font-bold transition-all">
            Browse Registry
         </Button>
      </div>
    </motion.div>
  )
}


