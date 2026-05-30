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

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 220 }}
        className="w-full max-w-lg relative z-20"
      >
        <div className="flex flex-col items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-(--apple-blue) flex items-center justify-center shadow-lg shadow-blue-500/10">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-semibold tracking-tight text-white">Threadly</span>
        </div>

        <div className="bg-(--surface) rounded-(--radius-lg) p-8 md:p-10 space-y-8 border border-white/5 shadow-xl">
          <div className="space-y-2 text-center">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-white">
              {isSignUp ? 'Create Account' : 'Sign In'}
            </h2>
            <p className="text-(--apple-gray) font-medium text-[15px] leading-relaxed">
              {isSignUp ? 'Join the next generation of intelligent workspace.' : 'Welcome back to your refined workspace.'}
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
                  {loading ? 'Processing...' : isSignUp ? 'Create Workspace' : 'Enter Workspace'}
                </Button>

                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="w-full text-center text-[12px] font-medium tracking-tight text-(--apple-gray) hover:text-white transition-colors py-2"
                >
                  {isSignUp ? 'Already have an account? Sign In' : "New to Threadly? Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-3 gap-6 opacity-20 filter grayscale">
          {[
            { icon: Zap, label: "Fast AI" },
            { icon: Sparkles, label: "Smart Memory" },
            { icon: Command, label: "Pro Tools" }
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center gap-3">
              <item.icon className="w-4 h-4 text-white" />
              <span className="text-[8px] font-black uppercase tracking-widest text-white">{item.label}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

