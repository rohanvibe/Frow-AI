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
  ArrowDown,
  Paperclip,
  FileText,
  CheckCircle2,
  Search,
  Star,
  Map,
  List,
  Sparkles,
  Sun,
  Moon,
  Monitor,
  MousePointer2
} from 'lucide-react'
import { motion, AnimatePresence, useScroll, useMotionValue, useSpring, useTransform, useMotionValueEvent } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import mermaid from 'mermaid'
import { toPng } from 'html-to-image'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { trackEvent } from '@/utils/analytics'
import { DEMO_CONVERSATION, DEMO_SIDEBAR_ITEMS } from '@/utils/demo-data'
// Feature test
import { FeedbackWidget } from '@/components/FeedbackWidget'



// --- Premium Components ---

function PythonSandbox({ code }: { code: string }) {
  const [output, setOutput] = useState<string>('')
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const workerRef = useRef<Worker | null>(null)

  const runCode = () => {
    setIsRunning(true)
    setError(null)
    setOutput('')

    if (!workerRef.current) {
      workerRef.current = new Worker('/python-worker.js')
    }

    workerRef.current.onmessage = (e) => {
      const { type, output, error } = e.data
      if (type === 'success') {
        setOutput(output)
      } else {
        setError(error)
      }
      setIsRunning(false)
    }

    workerRef.current.onerror = (err) => {
      setError('Worker Error: ' + err.message)
      setIsRunning(false)
    }

    workerRef.current.postMessage({ code })
  }

  // Cleanup worker on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate()
      }
    }
  }, [])

  return (
    <div className="my-6 rounded-(--radius-lg) bg-(--surface) border border-(--border-color) overflow-hidden shadow-2xl">
      <div className="px-4 py-3 bg-(--surface-secondary) border-b border-(--border-color) flex items-center justify-between">
        <div className="flex items-center gap-2">
           <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
           <span className="text-[10px] font-black uppercase tracking-widest text-(--apple-gray)">
             {isRunning ? 'Python Executing (Background)...' : 'Python 3.11 Sandbox'}
           </span>
        </div>
        <Button 
          size="sm" 
          onClick={runCode} 
          disabled={isRunning}
          className="h-8 rounded-full bg-(--foreground) text-(--background) hover:opacity-90 text-[10px] font-black uppercase px-4 transition-all shadow-sm active:scale-95"
        >
          {isRunning ? 'Running...' : 'Execute Code'}
        </Button>
      </div>
      <div className="p-5 text-[13px] font-mono text-(--foreground) bg-(--background)/40 max-h-[400px] overflow-y-auto custom-scrollbar">
        {output && <div className="text-(--apple-blue) mb-3 font-bold uppercase tracking-widest text-[9px] flex items-center gap-2"><CheckCircle2 className="w-3 h-3" /> Console Output:</div>}
        {output && <pre className="whitespace-pre-wrap leading-relaxed opacity-90">{output}</pre>}
        {error && <div className="text-red-500 mb-3 font-bold uppercase tracking-widest text-[9px] flex items-center gap-2"><X className="w-3 h-3" /> Execution Error:</div>}
        {error && <pre className="whitespace-pre-wrap text-red-400 bg-red-500/5 p-3 rounded-lg border border-red-500/10">{error}</pre>}
        {!output && !error && (
          <div className="flex flex-col items-center justify-center py-8 opacity-30">
            <Zap className="w-8 h-8 mb-2" />
            <span className="text-[11px] font-bold uppercase tracking-widest">Background Worker Ready</span>
          </div>
        )}
      </div>
    </div>
  )
}

function Calculator({ initialExpression = '' }: { initialExpression?: string }) {
  const [expression, setExpression] = useState(initialExpression)
  const [result, setResult] = useState<string | null>(null)

  // Auto-calculate on mount or expression change
  useEffect(() => {
    if (expression) {
      try {
        const clean = expression.replace(/×/g, '*').replace(/÷/g, '/')
        // eslint-disable-next-line no-eval
        const res = eval(clean)
        setResult(String(res))
      } catch (e) {
        setResult(null)
      }
    }
  }, [expression])

  const buttons = [
    ['f', '(', ')', 'C'],
    ['7', '8', '9', '÷'],
    ['4', '5', '6', '×'],
    ['1', '2', '3', '-'],
    ['0', '.', '=', '+']
  ]

  const handleAction = (val: string) => {
    if (val === 'C') {
      setExpression('')
      setResult(null)
    } else if (val === '=') {
      try {
        // Clean and compute
        const clean = expression.replace(/×/g, '*').replace(/÷/g, '/')
        // eslint-disable-next-line no-eval
        const res = eval(clean)
        setResult(String(res))
      } catch (e) {
        setResult('Error')
      }
    } else {
      setExpression(prev => prev + val)
    }
  }

  return (
    <div className="my-8 max-w-sm mx-auto rounded-[32px] bg-[#1c1c1e] border border-white/5 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] overflow-hidden">
      <div className="p-6 pb-2">
        <div className="flex items-center gap-2 mb-6 opacity-40">
           <div className="p-1 rounded-md bg-white/10">
              <Activity className="w-3 h-3 text-white" />
           </div>
           <span className="text-[10px] font-bold uppercase tracking-widest text-white">Threadly Instruments</span>
        </div>
        
        <div className="flex flex-col items-end min-h-[100px] justify-center px-2">
           <div className="text-[14px] text-white/40 font-medium mb-1 tracking-tight">{expression || '0'}</div>
           <div className={`text-4xl font-semibold tracking-tighter ${result === 'Error' ? 'text-red-500' : 'text-[#34c759]'} transition-all`}>
              {result !== null ? result : (expression ? '' : '0')}
           </div>
        </div>
      </div>

      <div className="p-4 grid grid-cols-4 gap-2 bg-black/20">
         {buttons.flat().map((btn) => (
           <button
             key={btn}
             onClick={() => handleAction(btn)}
             className={`h-14 rounded-2xl flex items-center justify-center text-lg font-medium transition-all active:scale-90 ${
               btn === '=' ? 'bg-[#34c759] text-white shadow-[0_8px_16px_rgba(52,199,89,0.3)]' :
               ['÷', '×', '-', '+'].includes(btn) ? 'bg-white/10 text-[#34c759] hover:bg-white/20' :
               ['f', '(', ')', 'C'].includes(btn) ? 'bg-white/5 text-white/60 hover:bg-white/10' :
               'bg-white/5 text-white hover:bg-white/10'
             }`}
           >
             {btn}
           </button>
         ))}
      </div>
      
      <div className="p-4 bg-black/40 flex items-center justify-center gap-2 border-t border-white/5 min-h-[60px]">
        {result && result !== 'Error' ? (
          <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2"
          >
             <span className="text-[12px] font-bold text-white/60">Final Result:</span>
             <span className="text-[14px] font-black text-white">{result}</span>
             <div className="w-5 h-5 rounded-full bg-[#34c759] flex items-center justify-center shadow-[0_0_12px_rgba(52,199,89,0.4)]">
                <Check className="w-3 h-3 text-white" />
             </div>
          </motion.div>
        ) : result === 'Error' ? (
          <span className="text-[12px] font-bold text-red-500 uppercase tracking-widest">Invalid Expression</span>
        ) : (
          <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Awaiting Input...</span>
        )}
      </div>
    </div>
  )
}

function Mermaid({ chart }: { chart: string }) {
  const [svg, setSvg] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const render = async () => {
      if (!chart) return
      setError(null)
      try {
        mermaid.initialize({ 
          startOnLoad: false, 
          theme: 'dark',
          securityLevel: 'loose',
          fontFamily: 'Inter, system-ui, sans-serif'
        })
        const id = 'mermaid-' + Math.random().toString(36).substring(7)
        
        // --- DEFENSIVE AUTO-FIX ENGINE ---
        let cleanChart = chart.replace(/```mermaid\n?|```/g, '').trim()
        
        // 1. Header Fallback (Default to graph TD if missing)
        const validHeaders = ['graph', 'flowchart', 'sequenceDiagram', 'gantt', 'classDiagram', 'stateDiagram', 'erDiagram', 'journey', 'pie', 'gitGraph', 'mindmap', 'timeline', 'quadrantChart', 'sankey', 'xychart']
        const firstWord = cleanChart.split(/[\s\n]/)[0]
        if (!validHeaders.includes(firstWord)) {
           cleanChart = 'graph TD\n' + cleanChart
        }

        // 2. Fix unquoted labels with special characters (common LLM failure)
        // Matches Node[Label (Text)] and converts to Node["Label (Text)"]
        cleanChart = cleanChart.replace(/([\[\(\{])\s*([^"\]\)\}]*?[\(\)\{\}\[\]].*?)\s*([\]\)\}])/g, '$1"$2"$3')

        // 3. Strip out any trailing junk or comments that might confuse the parser
        cleanChart = cleanChart.split('\n').filter(line => !line.trim().startsWith('```')).join('\n')

        const { svg: renderedSvg } = await mermaid.render(id, cleanChart)
        setSvg(renderedSvg)
      } catch (err: any) {
        console.error('Mermaid render error:', err)
        setError('Diagram has a syntax error. I will attempt to re-render in a simpler format next time.')
      }
    }
    render()
  }, [chart])

  if (error) return <div className="p-4 text-xs text-red-500 bg-red-500/10 rounded-xl border border-red-500/20 my-4">{error}</div>
  if (!svg) return <div className="p-4 text-xs text-(--apple-gray) animate-pulse bg-(--surface-secondary) rounded-xl border border-(--border-color) my-4">Drawing diagram...</div>

  return (
    <div 
      className="mermaid-wrapper my-6 p-6 bg-(--surface) rounded-(--radius-lg) border border-(--border-color) flex justify-center overflow-x-auto shadow-xl" 
      dangerouslySetInnerHTML={{ __html: svg }} 
    />
  )
}

function AppleTooltip({ text, children }: { text: string, children: React.ReactNode }) {
  return (
    <div className="group relative">
      {children}
      <AnimatePresence>
        <motion.div 
          initial={{ opacity: 0, y: 10, x: '-50%', scale: 0.95 }}
          whileHover={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="absolute bottom-full left-1/2 mb-2 pointer-events-none z-100 opacity-0 group-hover:opacity-100"
        >
          <div className="bg-(--surface-tertiary) border border-(--border-color) px-3 py-1.5 rounded-xl shadow-2xl glass no-border">
            <p className="text-[10px] font-black uppercase tracking-widest text-(--foreground) whitespace-nowrap">{text}</p>
          </div>
          <div className="w-2 h-2 bg-[#18181b] rotate-45 mx-auto -mt-1" />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function LandingPage({ onEnter, onTryDemo, mouseX, mouseY }: { onEnter: () => void, onTryDemo: () => void, mouseX: any, mouseY: any }) {
  const { scrollY } = useScroll()
  const scrollProgress = useTransform(scrollY, [0, 180], [0, 1])
  
  const outerPathLength = useTransform(scrollProgress, [0, 1], [0.5, 1])
  const middlePathLength = useTransform(scrollProgress, [0, 1], [0.5, 1])
  const innerPathLength = useTransform(scrollProgress, [0, 1], [0.5, 1])

  const [isHovered, setIsHovered] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  useMotionValueEvent(scrollY, "change", (latest) => {
    if (latest > 120) {
      setIsScrolled(true)
    } else {
      setIsScrolled(false)
    }
  })

  const isGlowActive = isHovered || isScrolled

  return (
    <div className="min-h-screen flex flex-col items-center p-6 text-center overflow-hidden relative bg-[#09090b]">
      
      {/* Curoky-inspired Background Accents */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[100%] h-[500px] bg-gradient-to-b from-purple-500/20 via-magenta-500/5 to-transparent blur-[120px] opacity-50" />
        <div className="absolute top-[10%] left-[10%] w-[30%] aspect-square bg-blue-600/10 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute top-[20%] right-[5%] w-[25%] aspect-square bg-purple-600/10 rounded-full blur-[140px]" />
        
        {/* Subtle Circuit Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay" 
             style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.2) 1px, transparent 0)', backgroundSize: '40px 40px' }} />
      </div>

      {/* Centered Pill Nav */}
      <motion.header 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed top-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-fit"
      >
        <nav className="flex items-center gap-1 px-2 py-1.5 rounded-full border border-white/10 bg-black/40 backdrop-blur-2xl shadow-2xl">
          <Button variant="ghost" size="sm" onClick={onEnter} className="rounded-full px-6 text-[13px] text-white hover:bg-white/10 border-none">Log In</Button>
          <Button size="sm" onClick={onEnter} className="rounded-full px-8 bg-white text-black text-[13px] font-bold border-none shadow-xl">Get Started</Button>
        </nav>
      </motion.header>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 220 }}
        className="max-w-5xl pt-24 space-y-12 relative z-10"
      >
        {/* Powered by AI Badge */}
        <div className="flex justify-center">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-2.5 px-6 py-2.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md shadow-xl"
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/80">Intelligent Research Infrastructure</span>
          </motion.div>
        </div>
        
        <div className="space-y-8">
          <h1 className="text-7xl md:text-[110px] font-black tracking-tighter leading-[0.85] text-white selection:bg-purple-500/30">
            {["Elevate", "Your Thought"].map((word, i) => (
              <motion.span 
                key={i}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1, type: "spring", damping: 15 }}
                className="inline-block mr-5 bg-gradient-to-b from-white via-white to-white/70 bg-clip-text text-transparent"
              >
                {word}
              </motion.span>
            ))}
            <br/> 
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 1 }}
              className="bg-gradient-to-r from-purple-400 via-magenta-400 to-pink-400 bg-clip-text text-transparent"
            >
              with Threadly AI
            </motion.span>
          </h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="text-xl md:text-2xl text-gray-400 font-medium max-w-3xl mx-auto leading-relaxed"
          >
            A high-leverage workspace for builders. <br className="hidden md:block" /> 
            Connect ideas, run simulations, and execute with precision.
          </motion.p>
        </div>

        {/* Action Buttons & Arch Portal Container */}
        <motion.div className="relative w-full flex flex-col items-center justify-center pt-2 group">
              {/* Curoky Glowing Arch Architecture (Positioned Behind) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[15%] w-full h-[400px] flex items-center justify-center z-0 pointer-events-none scale-110 md:scale-125">
            {/* Semicircle Arcs */}
            <motion.svg 
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              viewBox="0 0 800 800"
              initial="normal"
              animate={isGlowActive ? "hover" : "normal"}
              variants={{
                normal: { scale: 1, y: 0 },
                hover: { scale: 1.05, y: -10 }
              }}
              transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
              className="absolute top-0 w-[800px] h-[800px] opacity-80 pointer-events-auto cursor-pointer"
            >
              <motion.circle 
                cx="400" 
                cy="400" 
                r="398" 
                fill="transparent" 
                strokeWidth="3"
                transform="rotate(180 400 400)"
                pathLength={outerPathLength}
                variants={{
                  normal: { stroke: "rgba(168, 85, 247, 0.45)" },
                  hover: { stroke: "rgba(168, 85, 247, 0.85)" }
                }}
                transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
              />
            </motion.svg>

            <motion.svg 
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              viewBox="0 0 600 600"
              initial="normal"
              animate={isGlowActive ? "hover" : "normal"}
              variants={{
                normal: { scale: 1, y: 0 },
                hover: { scale: 1.10, y: -20 }
              }}
              transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
              className="absolute top-20 w-[600px] h-[600px] opacity-60 pointer-events-auto cursor-pointer"
            >
              <motion.circle 
                cx="300" 
                cy="300" 
                r="298.5" 
                fill="transparent" 
                strokeWidth="2"
                transform="rotate(180 300 300)"
                pathLength={middlePathLength}
                variants={{
                  normal: { stroke: "rgba(236, 72, 153, 0.35)" },
                  hover: { stroke: "rgba(236, 72, 153, 0.75)" }
                }}
                transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
              />
            </motion.svg>

            <motion.svg 
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              viewBox="0 0 400 400"
              initial="normal"
              animate={isGlowActive ? "hover" : "normal"}
              variants={{
                normal: { scale: 1, y: 0 },
                hover: { scale: 1.15, y: -30 }
              }}
              transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
              className="absolute top-40 w-[400px] h-[400px] opacity-40 pointer-events-auto cursor-pointer"
            >
              <motion.circle 
                cx="200" 
                cy="200" 
                r="198.5" 
                fill="transparent" 
                strokeWidth="2"
                transform="rotate(180 200 200)"
                pathLength={innerPathLength}
                variants={{
                  normal: { stroke: "rgba(244, 114, 182, 0.25)" },
                  hover: { stroke: "rgba(244, 114, 182, 0.6)" }
                }}
                transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
              />
            </motion.svg>

            {/* Core Hub Glow */}
            <motion.div 
              initial="normal"
              animate={isGlowActive ? "hover" : "normal"}
              variants={{
                normal: {
                  scale: 1,
                  opacity: 0.8,
                  backgroundColor: "rgba(147, 51, 234, 0.2)",
                },
                hover: {
                  scale: 1.4,
                  opacity: 1,
                  backgroundColor: "rgba(168, 85, 247, 0.4)",
                }
              }}
              transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
              className="absolute top-1/2 -translate-y-1/2 w-48 h-48 blur-[80px] rounded-full" 
            />
          </div>

          {/* Action Buttons (Positioned in Front with Comfortable Hover Magnet Target) */}
          <motion.div 
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1, type: "spring" }}
            className="flex flex-col md:flex-row items-center justify-center gap-6 relative z-10 px-24 py-16 pointer-events-auto"
          >
            <Button 
              onClick={onEnter} 
              className="w-full md:w-auto px-14 py-8 rounded-full bg-white text-black font-black tracking-tight text-[18px] hover:bg-gray-100 transition-all active:scale-[0.98] shadow-[0_0_50px_rgba(255,255,255,0.2)] border-none"
            >
              Start Chatting Free
            </Button>
            <Button 
              variant="ghost"
              onClick={onTryDemo} 
              className="w-full md:w-auto px-14 py-8 rounded-full bg-white/5 border border-white/10 text-white font-black tracking-tight text-[18px] hover:bg-white/10 transition-all active:scale-[0.98] backdrop-blur-xl"
            >
              Explore Demo
            </Button>
          </motion.div>
        </motion.div>
      </motion.div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl w-full py-40 relative z-10">
        {/* Feature Cards with Scroll Animations */}
        {[
          { icon: Map, title: "Thread Navigation", desc: "Instantly jump between prompts with a structured sidebar.", color: "text-purple-400" },
          { icon: Activity, title: "Real-time Instruments", desc: "Integrated calculators, diagrams, and background Python execution.", color: "text-magenta-400" },
          { icon: ShieldCheck, title: "Absolute Privacy", desc: "Local-first mindset. Your thoughts remain your own.", color: "text-pink-400" }
        ].map((f, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ delay: i * 0.15, type: "spring", damping: 20 }}
            whileHover={{ y: -8, backgroundColor: "rgba(255,255,255,0.03)", borderColor: "rgba(168,85,247,0.3)" }}
            className="p-12 rounded-[48px] bg-white/[0.01] text-left space-y-8 border border-white/5 transition-all duration-500 group cursor-default backdrop-blur-sm"
          >
            <motion.div 
              whileHover={{ rotate: 5, scale: 1.1 }}
              className={`w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors shadow-inner`}
            >
              <f.icon className={`w-8 h-8 ${f.color} transition-all duration-500 group-hover:drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]`} />
            </motion.div>
            <div className="space-y-4">
              <h3 className="text-xl font-black uppercase tracking-[0.2em] text-white/90 group-hover:text-white transition-colors">{f.title}</h3>
              <p className="text-lg text-gray-500 font-medium leading-relaxed group-hover:text-gray-300 transition-colors">{f.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function ShieldCheck(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

// Types
export type Message = {
  id: string
  chat_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
  images?: any[]
}

export type Chat = {
  id: string
  title: string
  created_at: string
}

export type Prompt = {
  id: string
  title: string
  template: string
}

export default function ChatPage() {
  const cleanDisplayContent = (content: string) => {
    return content
      .replace(/\[METADATA\][\s\S]*?\[\/METADATA\]/g, '') // Clean visual metadata
      .replace(/<expression>(.*?)<\/expression>/gi, '\n```calculator\n$1\n```\n') // Fail-safe for literal tags
      .replace(/\[MEMORY_(ADD|LEARNED|EDIT|DELETE):.*?\]/gi, '')
      .replace(/\n[a-z]+\|.*$/i, '')
      .trim()
  }

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
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')
  const [isDemo, setIsDemo] = useState(false)
  const [demoSidebarItems, setDemoSidebarItems] = useState(DEMO_SIDEBAR_ITEMS)
  const [showDemoTooltip, setShowDemoTooltip] = useState(false)
  const [demoInteractionCount, setDemoInteractionCount] = useState(0)
  const [showConversionModal, setShowConversionModal] = useState(false)
  
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX)
      mouseY.set(e.clientY)
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [mouseX, mouseY])

  // Initial load
  useEffect(() => {
    const savedTheme = localStorage.getItem('threadly_theme') as any
    if (savedTheme) setTheme(savedTheme)
  }, [])

  // Apply and Persist
  useEffect(() => {
    const root = window.document.documentElement
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const applyTheme = (t: string) => {
      root.classList.remove('light', 'dark')
      if (t === 'system') {
        const actual = mediaQuery.matches ? 'dark' : 'light'
        root.classList.add(actual)
      } else {
        root.classList.add(t)
      }
    }

    applyTheme(theme)
    localStorage.setItem('threadly_theme', theme)

    const handleChange = () => {
      if (theme === 'system') applyTheme('system')
    }
    
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])
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
  const [chatDrafts, setChatDrafts] = useState<Record<string, string>>({})
  const [chatScrolls, setChatScrolls] = useState<Record<string, number>>({})
  const [showJumpToBottom, setShowJumpToBottom] = useState(false)
  const [isSharedRecently, setIsSharedRecently] = useState(false)
  const [hasDiscoveredSidebar, setHasDiscoveredSidebar] = useState(true)

  useEffect(() => {
    if (currentChatId) {
       setInput(chatDrafts[currentChatId] || '')
       setTimeout(() => {
         const container = document.getElementById('chat-messages-container')
         if (container && chatScrolls[currentChatId] !== undefined) {
           container.scrollTop = chatScrolls[currentChatId]
         }
       }, 50)
    }
  }, [currentChatId])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [showLanding, setShowLanding] = useState(true)
  const [hasInteracted, setHasInteracted] = useState(false)

  useEffect(() => {
    if (user || chats.length > 0) setShowLanding(false)
  }, [user, chats])
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

        // Track return visit or google login completion
        const sessionKey = `threadly_session_${new Date().toISOString().split('T')[0]}`
        const sessionTracked = sessionStorage.getItem(sessionKey)
        
        if (!sessionTracked) {
          trackEvent('return_visit', { userId: user.id })
          sessionStorage.setItem(sessionKey, 'true')
        }

        if (localStorage.getItem('google_login_pending')) {
          trackEvent('google_login_completed', { userId: user.id })
          localStorage.removeItem('google_login_pending')
        }
      }
      if (typeof window !== 'undefined') {
        setHasDiscoveredSidebar(!!localStorage.getItem('threadly_sidebar_discovered'))
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
    } else if (!isDemo) {
      setMessages([])
      setBookmarkedMessages(new Set())
    }
  }, [currentChatId, isDemo])

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

    // Feature: Auto-focus Input
    if (!isMobile && !loading) {
       document.getElementById('chat-input')?.focus()
    }
  }, [messages, loading, currentChatId])

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
    if (isDemo) {
      setMessages(DEMO_CONVERSATION)
      return
    }
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
      trackEvent('chat_started', { method: 'button' })
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
     
     trackEvent('share_created', { chatId: currentChatId })
     
     if (navigator.share) {
        try {
           await navigator.share({ title: 'Threadly Chat Session', url })
        } catch (e) {
           copyToClipboard(url)
        }
     } else {
        copyToClipboard(url)
     }
     setIsSharedRecently(true)
     setTimeout(() => setIsSharedRecently(false), 2000)
     setSharing(false)
  }

  const exportAsImage = async (messageId?: string) => {
    const elementId = messageId ? `msg-${messageId}` : 'chat-messages-container'
    const element = document.getElementById(elementId)
    if (!element) return

    toast("Generating snapshot...", "info")
    try {
      // Use a slightly more robust sequence for mobile Browsers
      const dataUrl = await toPng(element, {
        cacheBust: true,
        backgroundColor: '#000000', // Match pure black dark mode
        pixelRatio: 2, 
        skipAutoScale: true,
        fontEmbedCSS: '', 
        style: {
          padding: '40px',
          borderRadius: '32px',
          margin: '0',
          background: '#000000'
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

    // Add user message immediately
    const tempUserMsg: Message = {
      id: Math.random().toString(),
      chat_id: currentChatId || '',
      role: 'user',
      content: displayContent,
      created_at: new Date().toISOString()
    }

    let finalPrompt = displayContent
    if (attachedFile) {
      finalPrompt = `[FILE CONTEXT: ${attachedFile.name}]\n\`\`\`\n${attachedFile.content}\n\`\`\`\n\n${displayContent}`
    }

    let wasJustCreated = false
    let chatId = currentChatId
    
    // Self-healing: If currentChatId is stale or not in history, force create a new one
    if (chatId && !chats.find(c => c.id === chatId)) {
      chatId = null
      setCurrentChatId(null)
    }

    if (!chatId) {
      trackEvent('chat_started', { method: 'auto' })
      if (isGuest) {
        chatId = 'guest-session-' + Date.now()
        tempUserMsg.chat_id = chatId
        setCurrentChatId(chatId)
      } else {
        const { data } = await supabase
          .from('chats')
          .insert([{ user_id: user.id, title: 'New Chat' }])
          .select()
          .single()
        if (data) {
          chatId = data.id
          tempUserMsg.chat_id = data.id as string
          wasJustCreated = true
          skipFetchRef.current = true 
          setCurrentChatId(chatId)
          setChats(prev => [data, ...prev])
        } else return
      }
    }

    // Force immediate naming for new chats or if the current title is poor
    const currentChat = chats.find(c => c.id === chatId)
    const isPoorTitle = !currentChat || currentChat.title === 'New Chat' || (typeof currentChat.title === 'string' && (currentChat.title.toLowerCase().includes('help') || currentChat.title.toLowerCase().includes('ai')))
    
    if (wasJustCreated || isPoorTitle) {
      fetch('/api/chat/title', {
        method: 'POST',
        body: JSON.stringify({ messages: [...messages, tempUserMsg].slice(-5) })
      }).then(res => res.json()).then(titleData => {
        if (titleData.title && titleData.title.toLowerCase() !== 'new chat' && typeof titleData.title === 'string' && !titleData.title.toLowerCase().includes('help')) {
           const newTitle = titleData.title;
           supabase.from('chats').update({ title: newTitle }).eq('id', chatId!).then(() => {
             setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: newTitle } : c))
           })
        }
      }).catch(err => console.error("Naming failed:", err))
    }

    setInput('')
    setAttachedFile(null)
    setLoading(true)
    if (messages.length === 0) {
      trackEvent('first_message_sent', { isGuest, model: modelType })
    }
    trackEvent('chat_sent', { isGuest, model: modelType })
    abortControllerRef.current = new AbortController()

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
      images: [],
      created_at: new Date().toISOString()
    }
    setMessages(prev => [...prev, tempAssistantMsg])

    if (messages.length === 0) {
      trackEvent('first_message_sent', { chatId, isGuest })
    }
    trackEvent('chat_sent', { chatId, isGuest })

    let finalContent = ''
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
        let detectedImages: any[] = []

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value)
          
          // PHASE 6: Parse structured metadata from the start of the stream
          if (chunk.includes('[METADATA]:')) {
            const lines = chunk.split('\n')
            const metadataLine = lines.find(l => l.startsWith('[METADATA]:'))
            if (metadataLine) {
              try {
                const metadata = JSON.parse(metadataLine.replace('[METADATA]:', ''))
                if (metadata.type === 'image_result') {
                  detectedImages = metadata.images
                }
              } catch (e) {
                console.error('Metadata parsing failed:', e)
              }
            }
            // Filter out the metadata line from the displayed content
            const cleanChunk = lines.filter(l => !l.startsWith('[METADATA]:')).join('\n')
            accumulatedContent += cleanChunk
          } else {
            accumulatedContent += chunk
          }

          setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: accumulatedContent, images: detectedImages } : m))
        }
        
        finalContent = accumulatedContent
        const memoryPatterns = [
           /\[MEMORY_(ADD|LEARNED|EDIT|DELETE):.*?\]/gi,
           /\n[a-z]+\|.*$/i, // Catch legacy tag|fact at the very end
        ]
        
        const addMatch = finalContent.match(/\[MEMORY_ADD:\s*(.*?)\]/i) || finalContent.match(/\[MEMORY_LEARNED:\s*(.*?)\]/i)
        const editMatch = finalContent.match(/\[MEMORY_EDIT:\s*(\d+)\s*\|\s*(.*?)\]/i)
        const deleteMatch = finalContent.match(/\[MEMORY_DELETE:\s*(\d+)\]/i)
        
        if (addMatch || editMatch || deleteMatch) {
           // Remove all memory tags
           memoryPatterns.forEach(pattern => {
              finalContent = finalContent.replace(pattern, '')
           })
           finalContent = finalContent.trim()
           
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

        // Secondary naming fallback (if first one failed or for existing New Chats)
        const currentChat = chats.find(c => c.id === chatId)
        if (currentChat?.title === 'New Chat' && !isGuest) {
           fetch('/api/chat/title', {
             method: 'POST',
             body: JSON.stringify({ messages: [...messages, { role: 'assistant', content: finalContent }] })
           }).then(res => res.json()).then(data => {
             if (data.title) {
               supabase.from('chats').update({ title: data.title }).eq('id', chatId!).then(() => {
                 setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: data.title } : c))
               })
             }
           }).catch(err => console.error("Title generation failed:", err))
        }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        process.env.NODE_ENV === 'development' && console.error("Fetch error:", err)
        toast(`Failed: ${err.message}`, "error")
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
    trackEvent('sidebar_click', { action: 'edit_message' })
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
      trackEvent('sidebar_click', { action: 'jump_to_message', msgId })
      
      if (isDemo) {
        setDemoInteractionCount(prev => prev + 1)
        trackEvent('demo_interaction', { msgId, count: demoInteractionCount + 1 })
        
        // Auto-advance tutorial if they click during the navigation step
        if (onboardingStep === 1) {
           setHasInteracted(true)
           // Stay on this step for 4 seconds so they see the result
           setTimeout(() => {
              setHasInteracted(false)
              setOnboardingStep(2)
           }, 4000)
        }

        // Show conversion modal after 3 interactions
        if (demoInteractionCount + 1 >= 3) {
           setShowBigSignup(true)
        }
      }
      
      // Clear highlight after 2s
      setTimeout(() => setHighlightedAnchor(null), 2000)
    }
  }

  const enterDemo = () => {
    // Force set everything at once to avoid race conditions
    const demoId = 'demo-chat'
    setIsDemo(true)
    setCurrentChatId(demoId)
    setMessages(DEMO_CONVERSATION)
    setChats([{ id: demoId, title: 'Lunar Base Infrastructure', created_at: new Date().toISOString() }])
    setShowLanding(false)
    trackEvent('demo_opened')
    
    // Trigger interactive onboarding for demo
    setTimeout(() => {
      setOnboardingStep(0)
    }, 500)
  }

  if (showLanding) {
    return <LandingPage onEnter={() => { setShowLanding(false); trackEvent('chat_started'); }} onTryDemo={enterDemo} mouseX={mouseX} mouseY={mouseY} />
  }

  return (
    <div className="flex h-dvh text-(--foreground) overflow-hidden relative font-sans selection:bg-blue-500/30">

      <AnimatePresence>
        {isNavOpen && (
          <motion.div 
            layout
            initial={isMobile ? { x: -300 } : { width: 0, opacity: 0 }}
            animate={isMobile ? { x: 0 } : { width: 280, opacity: 1 }}
            exit={isMobile ? { x: -300 } : { width: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 32, stiffness: 180 }}
            className={`${isMobile ? 'absolute inset-y-0 left-0 w-80 z-50' : 'w-72 relative'} border-r border-(--border-color) flex flex-col bg-(--surface-secondary)/80 backdrop-blur-2xl h-full shadow-2xl overflow-hidden`}
          >
            <div className="p-8 flex items-center justify-between shrink-0">
              <h1 className="font-bold text-xl flex items-center gap-3 tracking-tight text-(--foreground)">
                <div className="w-8 h-8 squircle bg-(--apple-blue) flex items-center justify-center shadow-lg shadow-blue-500/20">
                   <Globe className="w-4 h-4 text-(--background)" />
                </div>
                Threadly
              </h1>
              <AppleTooltip text="Dismiss">
                <Button variant="ghost" size="icon" className="rounded-xl hover:bg-white/5" onClick={() => { setIsNavOpen(false); }}>
                  <X className="w-4 h-4 text-gray-500" />
                </Button>
              </AppleTooltip>
            </div>

            <div className="px-8 mb-8 space-y-4">
              <motion.div whileTap={{ scale: 0.98 }}>
                <Button onClick={() => { createNewChat(); }} className="w-full py-7 rounded-2xl flex items-center gap-2 group shadow-2xl bg-white text-black hover:bg-gray-100 no-border font-bold text-[13px] tracking-tight">
                  <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
                  New Session
                </Button>
              </motion.div>
              <div className="relative group">
                <Search className="w-3.5 h-3.5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="text"
                  placeholder="Search thoughts..."
                  value={chatSearch}
                  onChange={(e) => setChatSearch(e.target.value)}
                  className="w-full bg-(--surface) border border-(--border-color) rounded-2xl py-3.5 pl-11 pr-4 text-[13px] font-medium text-(--foreground) placeholder-(--apple-gray) focus:ring-1 focus:ring-blue-500/30 outline-none transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 space-y-1.5 py-2 custom-scrollbar">
              {chats.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center p-6 space-y-4 mt-10">
                  <MessageSquare className="w-8 h-8 text-(--apple-gray)" />
                  <p className="text-xs font-bold text-(--apple-gray)">Empty workspace.</p>
                  <p className="text-[10px] text-(--apple-gray)/60">Kick off a new intelligent session.</p>
                </div>
              ) : (
                chats.filter(c => chatSearch.trim() === '' || (typeof c.title === 'string' && c.title.toLowerCase().includes(chatSearch.toLowerCase()))).map(chat => (
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
                      <motion.button
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => { 
                          setCurrentChatId(chat.id); 
                          if (isMobile) setIsNavOpen(false); 
                          trackEvent('sidebar_click', { action: 'select_chat', chat_id: chat.id });
                        }}
                        className={`w-full text-left p-4 rounded-2xl text-[13px] font-bold tracking-tight transition-all flex items-center gap-3 group relative overflow-hidden ${
                          currentChatId === chat.id ? 'bg-(--apple-blue)/10 text-(--apple-blue)' : 'text-(--apple-gray) hover:bg-(--surface-tertiary) hover:text-(--foreground)'
                        }`}
                      >
                        <MessageSquare className={`w-4 h-4 shrink-0 transition-all ${currentChatId === chat.id ? 'text-(--apple-blue) scale-110' : 'text-(--apple-gray) group-hover:text-gray-300'}`} />
                        <span className="truncate">{typeof chat.title === 'string' ? chat.title : JSON.stringify(chat.title)}</span>
                        {currentChatId === chat.id && (
                          <motion.div 
                            layoutId="active-chat-indicator"
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-(--apple-blue) rounded-r-full" 
                          />
                        )}
                      </motion.button>
                    )}
                    
                    {editingChatId !== chat.id && (
                      <div className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 transition-opacity ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <AppleTooltip text="Edit Title">
                          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={(e) => { e.stopPropagation(); setEditingChatId(chat.id); setEditingTitle(chat.title); }}>
                            <Edit2 className="w-3 h-3" />
                          </Button>
                        </AppleTooltip>
                        <AppleTooltip text="Delete Thread">
                          <Button variant="destructive" size="icon" className="w-7 h-7" onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); }}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </AppleTooltip>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-(--border-color) space-y-2">
              <div className="flex items-center gap-3 p-4 bg-(--surface) rounded-(--radius-md) border border-(--border-color) mb-4 shadow-sm">
                <div className="w-10 h-10 rounded-lg bg-(--apple-blue) flex items-center justify-center text-xs font-semibold text-white shadow-lg overflow-hidden">
                  {user?.user_metadata?.avatar_url ? (
                     <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                     user?.email?.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-(--apple-gray) mb-0.5">Account</span>
                  <span className="text-[13px] font-semibold text-(--foreground) truncate">{user?.email}</span>
                </div>
                <div className="flex items-center gap-1">
                  <AppleTooltip text="Log Out">
                    <button onClick={handleLogout} className="p-2 hover:bg-(--surface-tertiary) rounded-xl transition-all"><LogOut className="w-4 h-4 text-(--apple-gray)" /></button>
                  </AppleTooltip>
                  <AppleTooltip text="Delete Account">
                    <button onClick={handleDeleteAccount} className="p-2 hover:bg-red-500/5 rounded-xl transition-all group/del"><UserMinus className="w-4 h-4 text-(--apple-gray) group-hover/del:text-red-500" /></button>
                  </AppleTooltip>
                </div>
              </div>
              <Button id="tutorial-prompts" variant="ghost" className="w-full justify-start gap-4 rounded-xl py-6 hover:bg-(--surface-tertiary) text-(--foreground)" onClick={() => { setShowPrompts(true); }} onContextMenu={e => openContextMenu(e, 'openPrompts')}>
                <Command className="w-4 h-4 text-(--apple-blue)" />
                <span className="text-[13px] font-semibold tracking-tight">Saved Prompts</span>
                <span className="ml-auto text-[8px] font-mono text-(--apple-gray)">{getShortcutLabel('openPrompts')}</span>
              </Button>
              <Button id="tutorial-settings" variant="ghost" className="w-full justify-start gap-4 rounded-xl py-6 hover:bg-(--surface-tertiary) text-(--foreground)" onClick={() => { 
                trackEvent('byok_opened')
                setShowSettings(true); 
              }} onContextMenu={e => openContextMenu(e, 'openSettings')}>
                <Settings className="w-4 h-4 text-(--apple-blue)" />
                <span className="text-[13px] font-semibold tracking-tight">Settings</span>
                <span className="ml-auto text-[8px] font-mono text-(--apple-gray)">{getShortcutLabel('openSettings')}</span>
              </Button>

              <div className="pt-4 mt-2 border-t border-white/5">
                <div className="flex bg-(--surface-tertiary) p-1 rounded-xl items-center border border-white/5">
                  <button 
                    onClick={() => setTheme('light')} 
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${theme === 'light' ? 'bg-(--foreground) text-(--background) shadow-sm' : 'text-(--apple-gray) hover:text-(--foreground)'}`}
                  >
                    <Sun className="w-3.5 h-3.5" />
                    Light
                  </button>
                  <button 
                    onClick={() => setTheme('dark')} 
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${theme === 'dark' ? 'bg-(--foreground) text-(--background) shadow-sm' : 'text-(--apple-gray) hover:text-(--foreground)'}`}
                  >
                    <Moon className="w-3.5 h-3.5" />
                    Dark
                  </button>
                  <button 
                    onClick={() => setTheme('system')} 
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${theme === 'system' ? 'bg-(--foreground) text-(--background) shadow-sm' : 'text-(--apple-gray) hover:text-(--foreground)'}`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    Auto
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <OnboardingTutorial 
        step={onboardingStep} 
        isDemo={isDemo}
        hasInteracted={hasInteracted}
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

      <motion.div layout transition={{ type: 'spring', damping: 32, stiffness: 180 }} className={`flex-1 flex flex-col relative bg-(--background) ${isMobile ? 'pt-14' : ''}`}>
        <AnimatePresence>
          {isMobile && (isNavOpen || isSidebarOpen) && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setIsNavOpen(false); setIsSidebarOpen(false); }} className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40" />
          )}
        </AnimatePresence>

          <div className="flex items-center absolute left-6 top-6 z-30 gap-4">
            <button onClick={() => { setIsNavOpen(true); }} className="hover:text-(--apple-blue) transition-all flex items-center gap-2 group">
              <Menu className="w-6 h-6 group-hover:scale-110" />
            </button>
          </div>

        {isMobile && (
          <div className="absolute top-0 left-0 right-0 h-14 border-b border-(--border-color) bg-(--surface-secondary)/40 backdrop-blur-xl flex items-center justify-between px-4 z-40">
            <button onClick={() => { setIsNavOpen(true); }} className="p-2 hover:bg-(--surface-tertiary) rounded-xl"><Menu className="w-5 h-5 text-(--apple-gray)" /></button>
            <h1 className="font-bold text-[13px] tracking-tight text-(--foreground)">Threadly</h1>
            <div className="flex items-center gap-1">
               {currentChatId && (
                  <button onClick={() => { shareChat(); }} className="p-2 hover:bg-white/5 rounded-xl text-(--apple-blue) transition-all active:scale-95">
                     <Share2 className="w-5 h-5" />
                  </button>
               )}
                <button onClick={() => { createNewChat(); if (isMobile) setIsNavOpen(false); }} className="p-2 hover:bg-(--surface-tertiary) rounded-xl text-(--foreground) transition-all active:scale-95">
                   <Plus className="w-5 h-5" />
                </button>
                <button onClick={() => { setIsSidebarOpen(!isSidebarOpen); }} className={`p-2 rounded-xl transition-all ${isSidebarOpen ? 'text-(--apple-blue)' : 'text-(--apple-gray)'}`}><History className="w-5 h-5" /></button>
            </div>
          </div>
        )}

        {/* Desktop Header Actions */}
        {!isMobile && (
               <div className="absolute top-8 right-8 z-40 flex items-center gap-3">
              {currentChatId && (
                 <Button 
                   variant="ghost" 
                   size="sm" 
                   onClick={() => { shareChat(); }}
                   onContextMenu={e => openContextMenu(e, 'shareChat')}
                   className="rounded-(--radius-pill) px-5 py-5 flex items-center gap-2 border-none bg-white text-black hover:bg-gray-100 shadow-xl font-semibold text-[13px] transition-all"
                 >
                   {isSharedRecently ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Share2 className="w-3.5 h-3.5" />}
                   <span className={isSharedRecently ? "text-green-500" : ""}>{isSharedRecently ? 'Shared' : 'Share Chat'}</span>
                 </Button>
              )}
              <button 
               onContextMenu={e => openContextMenu(e, 'toggleSidebar')} 
               onClick={() => { setIsSidebarOpen(!isSidebarOpen); setHasDiscoveredSidebar(true); localStorage.setItem('threadly_sidebar_discovered', 'true'); }} 
               className={`relative p-3 rounded-(--radius-pill) transition-all shadow-xl ${isSidebarOpen ? 'bg-(--apple-blue) text-white' : 'bg-(--surface) text-(--apple-gray) hover:text-(--foreground)'}`}
              >
                {!hasDiscoveredSidebar && messages.length > 2 && (
                   <span className="absolute -top-1 -right-1 flex h-3 w-3">
                     <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                     <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                   </span>
                )}
                <History className="w-5 h-5" />
              </button>
           </div>
        )}

        {/* Conversation Minimap */}
        {!isMobile && messages.filter(m => m.role === 'user').length > 3 && (
           <div className="absolute right-6 top-32 bottom-40 w-4 z-40 opacity-30 hover:opacity-100 transition-opacity hidden md:block">
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-white/10 rounded-full" />
              {messages.filter(m => m.role === 'user').map((m, i, arr) => (
                <AppleTooltip key={m.id} text={m.content.slice(0, 40) + '...'}>
                  <button
                    onClick={() => scrollToMessage(m.id)}
                    className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-(--apple-gray) hover:bg-(--apple-blue) hover:scale-150 hover:shadow-[0_0_10px_rgba(37,99,235,0.5)] transition-all z-10"
                    style={{ top: `${(i / Math.max(1, arr.length - 1)) * 100}%` }}
                  />
                </AppleTooltip>
              ))}
           </div>
        )}

        <div 
           className={`flex-1 ${messages.length === 0 ? 'overflow-hidden' : 'overflow-y-auto'} custom-scrollbar scroll-smooth relative z-10`} 
           id="chat-messages-container"
           onScroll={(e) => {
              const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
              if (currentChatId) {
                 setChatScrolls(prev => ({ ...prev, [currentChatId]: scrollTop }))
              }
              setShowJumpToBottom(scrollHeight - scrollTop - clientHeight > 300)
           }}
        >
          {fetchingMessages ? (
            <div className="max-w-3xl mx-auto p-6 md:p-10 space-y-8">
              <Skeleton className="h-32 w-full rounded-2xl bg-white/5" />
              <Skeleton className="h-24 w-[80%] rounded-2xl bg-white/5" />
              <Skeleton className="h-32 w-full rounded-2xl bg-white/5" />
            </div>
          ) : messages.length === 0 ? (
            <EmptyState onCreateNew={() => createNewChat()} />
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-8 md:p-10 space-y-12 pb-32">
              <motion.div layout drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.05} className="space-y-12">
                <AnimatePresence mode="popLayout">
                  {messages.map((msg, i) => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, y: 10 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ type: 'spring', damping: 28, stiffness: 220, delay: i * 0.05 }}
                      key={msg.id} 
                      id={`msg-${msg.id}`}
                  className={`group relative ${highlightedAnchor === msg.id ? 'highlight-bg p-4 -m-4 rounded-2xl bg-blue-500/5 ring-1 ring-blue-500/20' : ''} transition-all duration-700`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-lg ${
                    msg.role === 'assistant' ? 'bg-(--apple-blue) text-white' : 'bg-(--surface) text-(--apple-gray)'
                  }`}>
                    {msg.role === 'assistant' ? <Zap className="w-5 h-5" /> : <Plus className="w-5 h-5 rotate-45" />}
                  </div>
                  <div className="flex-1 space-y-4 min-w-0 overflow-hidden">
                    <motion.div 
                      animate={msg.role === 'assistant' && loading && i === messages.length - 1 ? {
                        boxShadow: ["0 0 0px rgba(37,99,235,0)", "0 0 30px rgba(37,99,235,0.15)", "0 0 0px rgba(37,99,235,0)"],
                        borderColor: ["rgba(255,255,255,0.05)", "rgba(37,99,235,0.3)", "rgba(255,255,255,0.05)"]
                      } : {}}
                      transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                      className={`p-6 md:p-8 rounded-(--radius-lg) bg-(--surface) shadow-xl relative overflow-hidden border border-white/5 ${
                        msg.role === 'assistant' ? 'ring-1 ring-blue-500/10' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-[13px] tracking-tight text-(--apple-gray) pt-1">
                            {msg.role === 'assistant' ? 'Assistant' : 'You'}
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
                             className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm font-medium outline-none focus:border-blue-500/50 min-h-[100px] resize-none"
                             autoFocus
                           />
                           <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={cancelEdit} className="text-[10px] font-bold uppercase tracking-widest px-4">Cancel</Button>
                              <Button size="sm" onClick={() => submitEdit(msg.id)} className="bg-blue-600 hover:bg-blue-500 text-[10px] font-bold uppercase tracking-widest px-6 shadow-lg shadow-blue-500/20">Save & Resend</Button>
                           </div>
                        </div>
                      ) : (
                        <div className="text-(--foreground) leading-relaxed text-[17px] prose prose-sm max-w-none prose-p:leading-[1.45] prose-pre:rounded-(--radius-md) prose-code:text-(--apple-blue) break-words selection:bg-blue-500/40 dark:prose-invert">
                          {msg.content === '' && loading ? (
                             <div className="flex items-center gap-4 py-2">
                                <div className="flex gap-1.5 item-center">
                                   {[1,2,3].map(d => <motion.div key={d} animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1, delay: d * 0.2 }} className="w-2 h-2 rounded-full bg-blue-600" />)}
                                </div>
<span className="text-[10px] font-black tracking-widest uppercase text-blue-500 pt-0.5">Thinking...</span>
                             </div>
                          ) : (
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm, remarkMath]}
                              rehypePlugins={[rehypeKatex]}
                              components={{
                                table: ({ children }) => (
                                  <div className="w-full overflow-x-auto my-8 rounded-2xl border border-white/10 bg-white/2 shadow-2xl custom-scrollbar">
                                    <table className="min-w-full divide-y divide-white/5 border-collapse">{children}</table>
                                  </div>
                                ),
                                th: ({ children }) => <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-[0.2em] text-blue-400 bg-white/5 whitespace-nowrap">{children}</th>,
                                 td: ({ children }) => <td className="px-6 py-4 text-sm border-t border-white/5 text-gray-300 whitespace-nowrap min-w-[120px]">{children}</td>,
                                 ul: ({ children }) => <ul className="list-disc pl-5 space-y-2 mb-4 break-words">{children}</ul>,
                                 ol: ({ children }) => <ol className="list-decimal pl-5 space-y-2 mb-4 break-words">{children}</ol>,
                                 li: ({ children }) => <li className="leading-relaxed break-words">{children}</li>,
                                 code: ({ node, className, children, ...props }: any) => {
                                   const match = /language-(\w+)/.exec(className || '');
                                  if (match?.[1] === 'calculator') {
                                    return <Calculator initialExpression={String(children).replace(/\n$/, '')} />
                                  }
                                  if (match?.[1] === 'mermaid') {
                                    return <Mermaid chart={String(children).replace(/\n$/, '')} />
                                  }
                                  if (match?.[1] === 'python' || match?.[1] === 'py') {
                                    return (
                                      <div className="space-y-4">
                                        <div className="relative group my-4 rounded-xl overflow-hidden border border-white/10 bg-[#09090b]">
                                          <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Python Source</span>
                                            <button onClick={() => copyToClipboard(String(children).replace(/\n$/, ''))} className="text-gray-500 hover:text-white transition-colors flex items-center gap-1.5">
                                              <Copy className="w-3 h-3" />
                                              <span className="text-[9px] font-black uppercase tracking-widest">Copy</span>
                                            </button>
                                          </div>
                                          <div className="p-4 overflow-x-auto text-[13px] leading-relaxed custom-scrollbar text-gray-300">
                                            <code className={className} {...props}>{children}</code>
                                          </div>
                                        </div>
                                        <PythonSandbox code={String(children).replace(/\n$/, '')} />
                                      </div>
                                    )
                                  }
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
                              {cleanDisplayContent(msg.content)}
                            </ReactMarkdown>
                          )}

                          {/* PHASE 7: Deterministic Visual Rendering */}
                          {msg.role === 'assistant' && msg.images && msg.images.length > 0 && (
                            <div className="mt-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                               <div className="flex items-center gap-3 mb-2 px-1">
                                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Verified Visual Assets</span>
                               </div>
                               <div className="flex flex-col gap-12">
                                  {msg.images.map((img: any, idx: number) => {
                                    const aspectRatio = img.width && img.height ? img.width / img.height : 16/10;
                                    const maxWidth = img.width ? `${Math.min(img.width, 1200)}px` : '100%';
                                    
                                    return (
                                      <div 
                                        key={idx} 
                                        style={{ maxWidth }}
                                        className="group/img relative rounded-3xl overflow-hidden border border-(--border-color) bg-(--surface) shadow-2xl transition-all duration-500 hover:border-blue-500/40 hover:shadow-blue-500/20 mx-auto w-full"
                                      >
                                        <div 
                                          className="relative overflow-hidden bg-(--surface-secondary)"
                                          style={{ aspectRatio: aspectRatio.toString() }}
                                        >
                                          <img 
                                            src={`/api/proxy-image?url=${encodeURIComponent(img.url)}`}
                                            alt={img.alt}
                                            className="w-full h-full object-cover transition-all duration-1000 group-hover/img:scale-105"
                                            loading="lazy"
                                          />
                                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 group-hover/img:opacity-60 transition-opacity" />
                                          
                                          <div className="absolute bottom-0 inset-x-0 p-8 flex flex-col gap-2 translate-y-2 group-hover/img:translate-y-0 transition-transform">
                                            <p className="text-[14px] font-black uppercase tracking-[0.2em] text-white drop-shadow-2xl line-clamp-2">{img.alt}</p>
                                            <div className="flex items-center justify-between mt-2 border-t border-white/10 pt-4">
                                               <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{img.attribution || 'Visual Resource'}</span>
                                               <a 
                                                 href={img.source} 
                                                 target="_blank" 
                                                 rel="noopener noreferrer"
                                                 className="text-[10px] font-black text-blue-400 hover:text-white transition-colors uppercase tracking-widest flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 backdrop-blur-sm"
                                               >
                                                 Source <ExternalLink className="w-3 h-3" />
                                               </a>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                               </div>
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
          )}
          <div ref={messagesEndRef} className="h-20" />
        </div>

        <div className="p-4 md:p-12 relative z-20">
           <div id="tutorial-input" className="w-full max-w-4xl mx-auto relative group">
              <AnimatePresence>
                {showJumpToBottom && (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    onClick={scrollToBottom}
                    className="absolute -top-14 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-xl flex items-center gap-2 hover:bg-blue-500 transition-all z-50 hover:scale-105 active:scale-95"
                  >
                    <ArrowDown className="w-3 h-3" />
                    Return to latest
                  </motion.button>
                )}
              </AnimatePresence>
              <form onSubmit={sendMessage}>
                <div className="relative bg-(--surface) rounded-(--radius-lg) p-2 shadow-xl group-focus-within:ring-1 ring-blue-500/20 transition-all border border-(--border-color)">
                  <textarea 
                    id="chat-input"
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value)
                      if (currentChatId) {
                         setChatDrafts(prev => ({ ...prev, [currentChatId]: e.target.value }))
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
                        if (!e.shiftKey || (e.metaKey || e.ctrlKey)) {
                           e.preventDefault()
                           if (isMobile) e.currentTarget.blur()
                           sendMessage()
                        }
                      }
                    }}
                    rows={1}
                    placeholder={loading ? "Generating response..." : ["Ask anything...", "Continue where you left off...", "Find an old answer instantly...", "Study without losing context..."][(messages.length + (currentChatId ? 1 : 0)) % 4]}
                    className="w-full pr-24 md:pr-32 py-4 md:py-5 pl-6 md:pl-8 bg-transparent text-base md:text-[17px] outline-none resize-none custom-scrollbar placeholder:text-(--apple-gray) font-medium tracking-tight text-(--foreground)"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3">
                    {loading ? (
                      <Button onClick={stopResponding} variant="ghost" size="icon" className="w-12 h-12 rounded-(--radius-pill) bg-(--surface-tertiary) hover:bg-red-500/10 hover:text-red-500 transition-all">
                        <Square className="w-5 h-5 fill-current" />
                      </Button>
                    ) : (
                      <Button type="submit" disabled={!input.trim()} size="icon" className="w-12 h-12 rounded-(--radius-pill) bg-(--apple-blue) text-white shadow-lg active:scale-90 disabled:opacity-20 transition-all border-none" >
                        <ArrowRight className="w-6 h-6" />
                      </Button>
                    )}
                  </div>
                </div>
              </form>
              <div className="hidden md:flex justify-between items-center mt-6 px-4">
                 <div className="flex items-center gap-3">
                    <span className="text-[9px] font-black text-(--apple-gray) uppercase tracking-[0.4em]">Groq Llama-3.3</span>
                    <div className="w-1 h-1 rounded-full bg-(--apple-gray)" />
                    <span className="text-[9px] font-black text-(--apple-gray) uppercase tracking-[0.4em]">Optimized Inference</span>
                 </div>
                 <p className="text-[9px] font-bold text-(--apple-gray) uppercase tracking-widest opacity-50">⌘ + Enter to dispatch</p>
              </div>
           </div>
        </div>
      </motion.div>

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
            layout
            initial={isMobile ? { x: '100%' } : { width: 0, opacity: 0 }}
            animate={isMobile ? { x: 0 } : { width: 320, opacity: 1 }}
            exit={isMobile ? { x: '100%' } : { width: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 32, stiffness: 180 }}
            className={`${isMobile ? 'absolute inset-y-0 right-0 w-[85%] z-50' : 'w-80 relative'} border-l border-(--border-color) flex flex-col bg-(--surface-secondary)/80 backdrop-blur-3xl h-full shadow-2xl sidebar-tint`}
          >
            <div className="flex flex-col h-full">
              {/* Guest Banner */}
              {isGuest && (
                <div className="m-4 p-4 rounded-2xl bg-(--surface) border border-blue-500/30 shadow-lg shadow-blue-500/10">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-xl">
                      <Sparkles className="w-5 h-5 text-black" />
                    </div>
                    <div className="flex flex-col">
                      <h3 className="text-[13px] font-bold tracking-tight text-(--foreground)">Unlock Infinite Flow</h3>
                      <p className="text-[11px] text-(--apple-gray) font-medium leading-relaxed mt-1">
                        Persistent history, intelligent AI memory, and cross-device sync.
                      </p>
                      <button 
                        onClick={() => { 
                          trackEvent('signup_started', { location: 'guest_banner' });
                          router.push('/auth'); 
                        }}
                        className="mt-4 w-full py-2.5 bg-(--apple-blue) hover:bg-blue-600 text-white text-[11px] font-bold tracking-tight rounded-xl transition-all active:scale-95 shadow-lg"
                      >
                        Claim My Workspace
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Identity & Memory Card */}
              <div id="tutorial-memory" className="p-6 border-b border-(--border-color) bg-(--surface-secondary)">
                <div className="flex items-center justify-between mb-6">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 squircle bg-(--apple-blue) flex items-center justify-center font-bold text-white shadow-xl uppercase overflow-hidden">
                         {user?.user_metadata?.avatar_url ? (
                            <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                         ) : (
                            user?.email?.[0] || 'U'
                         )}
                      </div>
                      <div className="flex flex-col">
                         <span className="text-[14px] font-bold tracking-tight text-(--foreground) truncate max-w-[140px]">
                            {user?.user_metadata?.full_name || user?.email?.split('@')[0]}
                         </span>
                         <span className="text-[11px] font-medium tracking-tight text-(--apple-gray)">System Operator</span>
                      </div>
                   </div>
                   <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)} className="rounded-xl"><X className="w-4 h-4" /></Button>
                </div>

                {profileMemories.length > 0 && (
                   <div className="space-y-3">
                      <div className="flex items-center justify-between">
                         <h3 className="text-[11px] font-bold uppercase tracking-widest text-(--apple-blue)">Memory Store</h3>
                         <span className="text-[10px] font-bold bg-blue-500/10 text-(--apple-blue) px-2.5 py-1 rounded-full">{profileMemories.length} Facts</span>
                      </div>
                      <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto custom-scrollbar pr-2">
                         {profileMemories.slice(0, 5).map((mem, i) => {
                            const cleaned = typeof mem === 'string' ? (mem.includes('|') ? mem.split('|').slice(1).join('|').trim() : mem) : JSON.stringify(mem);
                            return (
                               <div key={i} className="px-3 py-1.5 rounded-xl bg-(--surface) text-[10px] font-medium text-(--apple-gray)">
                                  {cleaned.length > 25 ? cleaned.slice(0, 25) + '...' : cleaned}
                               </div>
                            );
                         })}
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
                  <div className="flex bg-(--surface-tertiary) p-1 rounded-lg">
                    <button onClick={() => setSidebarMode('flow')} className={`p-1 rounded-md transition-colors ${sidebarMode === 'flow' ? 'bg-(--foreground) text-(--background) shadow-sm' : 'text-(--apple-gray) hover:text-(--foreground)'}`}><List className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setSidebarMode('map')} className={`p-1 rounded-md transition-colors ${sidebarMode === 'map' ? 'bg-(--foreground) text-(--background) shadow-sm' : 'text-(--apple-gray) hover:text-(--foreground)'}`}><Map className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                {isDemo && showDemoTooltip && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 p-3 bg-blue-600 rounded-xl shadow-lg relative"
                  >
                    <p className="text-[10px] font-black text-white uppercase tracking-widest leading-relaxed">
                      💡 Click any item below to jump instantly to that part of the conversation.
                    </p>
                    <div className="absolute -top-1 left-4 w-2 h-2 bg-blue-600 rotate-45" />
                  </motion.div>
                )}
                {isDemo && (
                  <div className="space-y-2 mt-4">
                    {demoSidebarItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => scrollToMessage(item.targetId)}
                        className="w-full text-left p-4 rounded-2xl border border-blue-500/10 bg-blue-500/5 hover:bg-blue-600/10 hover:border-blue-500/30 transition-all group active:scale-[0.98] flex items-center gap-3"
                      >
                         <span className="text-[10px] font-black w-6 h-6 rounded-lg flex items-center justify-center shrink-0 bg-blue-500/20 text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
                            {item.label[0]}
                         </span>
                         <span className="text-[11px] font-bold text-gray-400 group-hover:text-white transition-colors">{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                {sidebarMode === 'flow' && !isDemo && (
                  <div className="relative">
                    <Search className="w-3 h-3 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      id="sidebar-search"
                      type="text"
                      placeholder="Search flow (Ctrl/Cmd+K)"
                      value={sidebarSearch}
                      onChange={(e) => setSidebarSearch(e.target.value)}
                      className="w-full bg-(--surface) border border-(--border-color) rounded-lg py-2 pl-8 pr-3 text-xs text-(--foreground) placeholder-(--apple-gray) focus:outline-none focus:border-blue-500/50 transition-colors shadow-sm"
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
                         <div className="space-y-2 border-l border-(--border-color) ml-0.5 pl-3">
                            {section.messages.map((msg) => (
                               <button
                                 key={msg.id}
                                 onClick={() => { 
                                   trackEvent('sidebar_click', { type: 'thread_anchor' });
                                   scrollToMessage(msg.id); 
                                   if (isMobile) setIsSidebarOpen(false); 
                                 }}
                                 onDoubleClick={() => copyToClipboard(window.location.href.split('#')[0] + '#msg-' + msg.id)}
                                 title="Double-click to copy direct link"
                                 className="w-full text-left p-2 rounded-xl hover:bg-(--surface-tertiary) transition-all group flex items-center gap-2"
                               >
                                  <span className="w-1 h-1 rounded-full bg-(--apple-gray) group-hover:bg-(--foreground) transition-colors shrink-0" />
                                  <span className="text-[11px] font-medium text-(--apple-gray) group-hover:text-(--foreground) truncate transition-colors">
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
                     .filter(m => sidebarSearch.trim() === '' || (typeof m.content === 'string' && m.content.toLowerCase().includes(sidebarSearch.toLowerCase())))
                     .map((msg, idx) => {
                       const isBookmarked = bookmarkedMessages.has(msg.id)
                       const isActive = highlightedMessageId === msg.id
                       return (
                         <button
                           key={msg.id}
                           onClick={() => { 
                             trackEvent('sidebar_click', { type: 'chat_select' });
                             scrollToMessage(msg.id); 
                             if (isMobile) setIsSidebarOpen(false); 
                           }}
                           onDoubleClick={() => copyToClipboard(window.location.href.split('#')[0] + '#msg-' + msg.id)}
                           title="Double-click to copy direct link"
                           className={`w-full text-left p-4 rounded-2xl border transition-all group active:scale-[0.98] relative overflow-hidden ${isActive ? 'bg-blue-600/10 border-blue-500/30' : 'border-white/3 bg-white/1 hover:bg-blue-600/5 hover:border-blue-500/20'}`}
                         >
                           <div className="flex items-center justify-between gap-4 relative z-10">
                             <div className="flex items-center gap-3 min-w-0 flex-1">
                               <span 
                                 onClick={(e) => { e.stopPropagation(); copyToClipboard(window.location.href.split('#')[0] + '#msg-' + msg.id); }}
                                 title="Click to copy direct link"
                                 className={`cursor-pointer active:scale-95 text-[10px] font-black w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${isActive || isBookmarked ? 'text-blue-400 bg-blue-500/20 border-blue-500/30' : 'text-gray-500 bg-white/5 border-white/5 group-hover:text-blue-500'}`}
                               >
                                  {idx + 1}
                               </span>
                               <span className={`text-xs font-bold truncate transition-colors ${isActive || isBookmarked ? 'text-gray-200' : 'text-gray-500 group-hover:text-white'}`}>
                                 {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}
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
    <div className="fixed inset-0 z-200 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-md" 
        onClick={onClose}
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 220 }}
        className="w-full max-w-2xl relative z-20"
      >
        <div className="glass rounded-[2.5rem] overflow-hidden apple-shadow border border-(--border-color) flex flex-col max-h-[85vh]">
          <div className="p-8 border-b border-(--border-color) flex items-center justify-between">
             <div className="flex items-center gap-4">
                <div className="w-10 h-10 squircle bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                   <Settings className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h3 className="text-sm font-black uppercase tracking-[0.3em] text-(--foreground)">Workspace Infrastructure</h3>
                   <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Configure your intelligent environment</p>
                </div>
             </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl hover:bg-(--surface-tertiary)"><X className="w-5 h-5 text-(--apple-gray)" /></Button>
          </div>

          <div className="flex bg-white/1 px-8 py-2 gap-8 border-b border-white/5">
             {['general', 'personalization', 'shortcuts'].map((tab) => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`py-4 text-[9px] font-black uppercase tracking-[0.4em] transition-all relative ${
                    activeTab === tab ? 'text-(--foreground)' : 'text-(--apple-gray) hover:text-(--foreground)'
                  }`}
                >
                  {tab}
                  {activeTab === tab && (
                     <motion.div layoutId="settings-tab" className="absolute bottom-0 inset-x-0 h-0.5 bg-blue-500 rounded-full" />
                  )}
                </button>
             ))}
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
            {activeTab === 'general' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ type: 'spring', damping: 30, stiffness: 250 }}
                className="space-y-6"
              >
                <div className="space-y-3">
                  <label className="text-[9px] font-black uppercase tracking-[0.4em] text-gray-500 ml-2">AI API Key</label>
                  <Input type="password" value={keys.openai} onChange={(e) => setKeys({...keys, openai: e.target.value})} placeholder="sk-••••••••••••••••••••••••" className="bg-white/5 py-8 rounded-2xl border-white/5 focus:ring-1 focus:ring-blue-500/30" />
                </div>
              </motion.div>
            )}

            {activeTab === 'personalization' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ type: 'spring', damping: 30, stiffness: 250 }}
                className="space-y-10"
              >
                <div className="space-y-4">
                  <label className="text-[9px] font-black uppercase tracking-[0.4em] text-gray-500 ml-2">AI Instructions</label>
                  <textarea 
                    value={profile.custom_instructions}
                    onChange={(e) => setProfile({...profile, custom_instructions: e.target.value})}
                    className="w-full bg-white/5 border border-white/5 rounded-3xl p-6 text-sm font-bold outline-none focus:border-blue-500/50 min-h-[160px] resize-none custom-scrollbar transition-all"
                    placeholder="Define how the AI should behave..."
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-[9px] font-black uppercase tracking-[0.4em] text-gray-500 ml-2">AI Memory</label>
                  <div className="flex gap-3">
                    <Input 
                      value={newMemory}
                      onChange={(e) => setNewMemory(e.target.value)}
                      placeholder="Save a fact..."
                      className="bg-white/5 border-white/5 rounded-2xl h-14 text-sm"
                      onKeyDown={(e) => e.key === 'Enter' && addMemory()}
                    />
                    <Button onClick={addMemory} className="h-14 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl px-6"><Plus className="w-5 h-5" /></Button>
                  </div>
                  <div className="space-y-3">
                    {profile.ai_memory.map((mem, idx) => (
                      <div key={idx} className="flex items-center justify-between p-5 rounded-2xl bg-white/2 border border-white/5 group hover:border-blue-500/20 transition-all">
                        <span className="text-xs font-bold text-gray-400">{typeof mem === 'string' ? mem : JSON.stringify(mem)}</span>
                        <button onClick={() => removeMemory(idx)} className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500/50 hover:text-red-500 p-2"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                    {profile.ai_memory.length === 0 && (
                      <div className="py-12 text-center border-2 border-dashed border-white/5 rounded-4xl">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-700">No memories saved</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
            
            {activeTab === 'shortcuts' && (
              <ShortcutsTab shortcuts={shortcuts} updateShortcut={updateShortcut} resetShortcuts={resetShortcuts} />
            )}
          </div>

          <div className="p-8 bg-white/1 border-t border-white/5 flex justify-end gap-4">
            <Button variant="ghost" onClick={onClose} className="font-black text-[10px] uppercase tracking-widest px-8 rounded-2xl opacity-40 hover:opacity-100 transition-opacity">Discard</Button>
            <Button 
              onClick={saveAll} 
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-2xl px-12 font-black text-[10px] uppercase tracking-widest shadow-2xl shadow-blue-500/20 active:scale-95 transition-all h-14 no-border"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-3" /> : <Zap className="w-4 h-4 mr-3" />}
              Save Changes
            </Button>
          </div>
        </div>
      </motion.div>
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
                       Prompt Library
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
                    <Button variant="ghost" onClick={onClose} className="rounded-xl">Close</Button>
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
    toggleNav: 'Toggle Sidebar', toggleSidebar: 'Toggle History',
    focusSearch: 'Search Chats', openSettings: 'Open Settings', openPrompts: 'Open Saved Prompts',
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
function OnboardingTutorial({ step, onNext, onComplete, isDemo, hasInteracted }: { step: number, onNext: () => void, onComplete: () => void, isDemo?: boolean, hasInteracted?: boolean }) {
  const steps = [
    { 
      targetId: 'tutorial-input', 
      title: 'Active Intelligence', 
      text: 'Threadly isn\'t just a chat. It\'s a workspace. Explore the Lunar Base conversation already indexed for you.',
      actionHint: 'Enter Workspace',
      requireAction: false
    },
    { 
      targetId: 'tutorial-history', 
      title: 'Navigation Magic', 
      text: 'Stop scrolling. Click any item in the sidebar to jump instantly to that part of the thread.',
      successText: 'Did you see that? You just jumped through time.',
      actionHint: 'Waiting for interaction...',
      requireAction: true
    },
    { 
      targetId: 'tutorial-memory', 
      title: 'Long-term Memory', 
      text: 'I remember your preferences, past work, and style across all sessions.',
      actionHint: 'I understand',
      requireAction: false
    },
  ]

  const current = steps[step]
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    const updateRect = () => {
      if (current) {
        const el = document.getElementById(current.targetId)
        if (el) {
          setRect(el.getBoundingClientRect())
          if (!isDemo) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }
    }
    updateRect()
    window.addEventListener('resize', updateRect)
    return () => window.removeEventListener('resize', updateRect)
  }, [step, current, isDemo])

  if (step < 0 || step >= steps.length || !rect) return null

  const isLast = step === steps.length - 1
  const isActionStep = current.requireAction && isDemo

  return (
    <div className={`fixed inset-0 z-100 ${isActionStep ? 'pointer-events-none' : 'pointer-events-auto'} overflow-hidden`}>
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} 
        className={`absolute inset-0 bg-black/40 ${isActionStep ? 'backdrop-blur-0' : 'backdrop-blur-[4px]'} transition-all duration-700`} 
        onClick={(e) => !isActionStep && e.stopPropagation()}
      />
      
      {/* The Glow Highlight */}
      <motion.div
        animate={{
          top: rect.top - 12,
          left: rect.left - 12,
          width: rect.width + 24,
          height: rect.height + 24,
        }}
        transition={{ type: 'spring', damping: 30, stiffness: 200 }}
        className="absolute border-2 border-blue-500 rounded-[24px] shadow-[0_0_40px_rgba(59,130,246,0.4)] z-101 will-change-transform"
      />

      {/* The Tooltip */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{
          opacity: 1, scale: 1,
          top: Math.min(window.innerHeight - 250, rect.top + rect.height + 32),
          left: Math.min(window.innerWidth - 360, Math.max(20, rect.left + rect.width / 2 - 160)),
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 180 }}
        className="absolute w-[320px] bg-[#1c1c1e] border border-white/10 rounded-[28px] p-6 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] z-102 pointer-events-auto overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-1 h-full bg-blue-600" />
        
        <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-blue-500" />
            </div>
            <h4 className="text-[13px] font-black uppercase tracking-widest text-white">{current.title}</h4>
        </div>
        
        <p className="text-[14px] text-gray-300 leading-relaxed font-medium mb-6">
          {hasInteracted && current.successText ? current.successText : current.text}
        </p>
        
        <div className="flex flex-col gap-3">
            {!isActionStep ? (
              <button 
                  onClick={isLast ? onComplete : onNext}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white text-[12px] font-black uppercase tracking-widest rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                  {current.actionHint}
                  <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <div className={`w-full py-4 ${hasInteracted ? 'bg-green-500/20 border-green-500/30 text-green-400' : 'bg-white/5 border-white/10 text-gray-400'} border text-[10px] font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 transition-all duration-500`}>
                 {hasInteracted ? (
                    <>
                       <CheckCircle2 className="w-3 h-3" />
                       Action Recorded!
                    </>
                 ) : (
                    <>
                       <MousePointer2 className="w-3 h-3 animate-pulse" />
                       Waiting for Sidebar Click...
                    </>
                 )}
              </div>
            )}
            {step > 0 && !isActionStep && (
               <button onClick={onComplete} className="text-[10px] font-bold text-gray-600 hover:text-white uppercase tracking-widest transition-colors">Skip Workspace Tour</button>
            )}
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
                transition={{ type: 'spring', damping: 28, stiffness: 220 }}
                className="relative w-full max-w-lg bg-(--surface) border border-white/5 rounded-(--radius-lg) overflow-hidden shadow-2xl"
            >
                <div className="absolute top-0 inset-x-0 h-1 bg-linear-to-r from-blue-600 via-indigo-600 to-purple-600" />
                
                <div className="p-10 text-center">
                    <div className="w-16 h-16 bg-(--apple-blue) rounded-xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-600/20">
                        <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    
                    <h2 className="text-3xl font-semibold text-white tracking-tight mb-4">Get More Power</h2>
                    <p className="text-(--apple-gray) leading-relaxed mb-8 text-[15px]">
                        Save your chats, use smarter memory, and get faster answers by creating an account.
                    </p>
                    
                    <div className="grid grid-cols-1 gap-3 mb-8 text-left">
                        {[
                            { icon: <History className="w-5 h-5 text-(--apple-blue)" />, text: "Infinite Cross-Device History" },
                            { icon: <Zap className="w-5 h-5 text-(--apple-orange)" />, text: "Self-Learning AI Memory" },
                            { icon: <Globe className="w-5 h-5 text-(--apple-green)" />, text: "Priority System Infrastructure" }
                        ].map((feat, i) => (
                            <div key={i} className="flex items-center gap-4 p-5 rounded-(--radius-md) bg-white/2 border border-white/5">
                                {feat.icon}
                                <span className="text-[14px] font-semibold text-gray-100">{feat.text}</span>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col gap-4">
                        <button 
                            onClick={() => { onAction(); }}
                            className="w-full py-5 bg-white text-black font-semibold rounded-(--radius-pill) shadow-xl hover:bg-gray-100 transition-all active:scale-[0.98]"
                        >
                            Create Account
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
                             <span className="text-[10px] font-black tracking-tighter text-white italic">Groq</span>
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
      initial={{ opacity: 0, scale: 0.95 }} 
      animate={{ opacity: 1, scale: 1 }} 
      transition={{ type: 'spring', damping: 28, stiffness: 220 }} 
      className="h-full flex flex-col items-center justify-center text-center space-y-6 md:space-y-8 px-6 max-w-2xl mx-auto py-10"
    >
      <motion.div 
        animate={{ y: [0, -10, 0], rotate: [0, 5, 0] }}
        transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
        className="relative group hidden md:block"
      >
        <div className="w-24 h-24 rounded-3xl bg-(--apple-blue) flex items-center justify-center shadow-2xl shadow-blue-500/40 relative z-10 overflow-hidden">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 12, ease: "linear" }}
            className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"
          />
          <Sparkles className="w-12 h-12 text-white relative z-10" />
        </div>
      </motion.div>

      <div className="space-y-2 md:space-y-4">
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-5xl md:text-7xl font-bold tracking-tight text-(--foreground) leading-tight"
        >
          Clear mind. <br/> <span className="text-(--apple-gray) opacity-50">Simple work.</span>
        </motion.h2>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="hidden md:block text-lg text-(--apple-gray) font-medium leading-relaxed max-w-lg mx-auto"
        >
          Welcome to your new workspace. Ask anything to get started.
        </motion.p>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="flex flex-col sm:flex-row gap-4 w-full justify-center"
      >
          <Button onClick={onCreateNew} size="lg" className="px-10 py-8 rounded-full bg-(--foreground) text-(--background) hover:opacity-90 font-bold transition-all shadow-2xl border-none">
            <Plus className="w-5 h-5 mr-2" />
            New Thread
          </Button>
          <Button variant="outline" size="lg" onClick={() => (document.getElementById('tutorial-prompts') as HTMLElement)?.click()} className="hidden md:flex px-10 py-8 rounded-full border-(--border-color) hover:bg-(--surface-tertiary) text-(--foreground) font-bold transition-all">
            Browse Registry
          </Button>
      </motion.div>
    </motion.div>
  )
}


