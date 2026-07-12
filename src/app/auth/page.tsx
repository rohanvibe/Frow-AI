'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { Button, Input } from '@/components/ui'
import { trackEvent } from '@/utils/analytics'
import { Globe, ArrowRight, Zap, Sparkles, Command } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (isSignUp) {
      trackEvent('signup_started', { method: 'email' })
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else {
        trackEvent('signup_completed', { method: 'email' })
        setError('Check your email for the confirmation link!')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else router.push('/')
    }
    setLoading(false)
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError(null)
    trackEvent('signup_started', { method: 'google' })
    localStorage.setItem('google_login_pending', 'true')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center surface-foundation p-6 relative overflow-hidden selection:bg-blue-500/30">
      <div id="spotlight" />
      <div className="fixed inset-0 pointer-events-none z-10 grain-texture opacity-[0.03]" />

      <div className="w-full max-w-6xl mx-auto flex flex-col lg:flex-row items-center justify-center gap-16 relative z-20">
        
        {/* Left Side: Mascot & Branding (Hidden on mobile) */}
        <motion.div 
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200, delay: 0.1 }}
          className="hidden lg:flex flex-col items-center justify-center w-1/2 max-w-md text-center"
        >
          <motion.div
            animate={{ y: [-15, 15, -15] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="w-full aspect-square relative cursor-pointer group"
          >
            <div className="absolute inset-0 bg-purple-500/20 blur-[100px] rounded-full group-hover:bg-pink-500/30 transition-colors duration-700" />
            <img src="/Frow.svg" alt="Frow Mascot" className="w-full h-full object-contain drop-shadow-[0_0_40px_rgba(0,240,255,0.4)] group-hover:scale-105 group-hover:-rotate-2 transition-all duration-500 relative z-10" />
          </motion.div>
          <div className="space-y-4 mt-8 relative z-20">
            <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tighter leading-tight">
              Save Your <br/> <span className="bg-gradient-to-r from-purple-400 via-magenta-400 to-pink-400 bg-clip-text text-transparent">Progress.</span>
            </h1>
            <p className="text-gray-400 font-medium text-lg leading-relaxed max-w-sm mx-auto">
              Create a free account to save your chat history, custom tools, and securely access your work from anywhere.
            </p>
          </div>
        </motion.div>

        {/* Right Side: Auth Form */}
        <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 220 }}
        className="w-full max-w-lg relative z-20"
      >
          {/* Mobile Branding (Only visible on smaller screens) */}
          <div className="flex lg:hidden flex-col items-center gap-3 mb-10">
            <div className="w-12 h-12 rounded-xl bg-(--apple-blue) flex items-center justify-center shadow-lg shadow-purple-500/20">
              <img src="/Frow.svg" alt="Frow" className="w-8 h-8 object-contain" />
            </div>
            <span className="text-xl font-black tracking-tight text-white uppercase">Frow</span>
          </div>

        <div className="bg-(--surface) rounded-(--radius-lg) p-8 md:p-10 space-y-8 border border-white/5 shadow-xl">
          <div className="space-y-2 text-center">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-white">
              {isSignUp ? 'Save Your Workspace' : 'Sign In'}
            </h2>
            <p className="text-(--apple-gray) font-medium text-[15px] leading-relaxed">
              {isSignUp ? 'Create an account to protect your work and access it anywhere.' : 'Welcome back to your workspace.'}
            </p>
          </div>

          <div className="space-y-6">
            <Button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-6 rounded-(--radius-pill) bg-white text-black font-semibold tracking-tight text-[14px] hover:bg-gray-100 transition-all active:scale-[0.98] border-none flex items-center justify-center gap-3"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
              <div className="relative flex justify-center text-[11px]"><span className="bg-[#000000] px-4 text-(--apple-gray) font-medium tracking-tight">Or continue with</span></div>
            </div>

            <form onSubmit={handleAuth} className="space-y-6">
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[12px] font-semibold tracking-tight text-(--apple-gray) pl-1">Email Address</label>
                  <Input
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full bg-(--surface-tertiary) border-none rounded-(--radius-md) py-6 px-6 text-[15px] font-medium text-white placeholder-gray-700 focus:ring-1 focus:ring-blue-500/30 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[12px] font-semibold tracking-tight text-(--apple-gray) pl-1">Password</label>
                  <Input
                    type="password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-(--surface-tertiary) border-none rounded-(--radius-md) py-6 px-6 text-[15px] font-medium text-white placeholder-gray-700 focus:ring-1 focus:ring-blue-500/30 outline-none transition-all"
                  />
                </div>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`text-[11px] font-bold tracking-tight text-center ${typeof error === 'string' && error.includes('Check your email') ? 'text-green-500' : 'text-red-500'}`}
                >
                  {error}
                </motion.p>
              )}

              <div className="space-y-4 pt-2">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full py-6 rounded-(--radius-pill) bg-(--apple-blue) text-white font-semibold tracking-tight text-[15px] hover:bg-blue-600 transition-all active:scale-[0.98] border-none"
                >
                  {loading ? 'Processing...' : isSignUp ? 'Save Workspace' : 'Enter Workspace'}
                </Button>

                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="w-full text-center text-[12px] font-medium tracking-tight text-(--apple-gray) hover:text-white transition-colors py-2"
                >
                  {isSignUp ? 'Already have an account? Sign In' : "New to Frow? Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-3 gap-6 opacity-30 filter grayscale hover:grayscale-0 transition-all duration-500">
          {[
            { icon: Zap, label: "Fast AI" },
            { icon: Sparkles, label: "Smart Memory" },
            { icon: Command, label: "Pro Tools" }
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center gap-3 group">
              <item.icon className="w-5 h-5 text-gray-400 group-hover:text-blue-400 transition-colors" />
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 group-hover:text-white transition-colors">{item.label}</span>
            </div>
          ))}
        </div>
      </motion.div>
      </div>
    </div>
  )
}


