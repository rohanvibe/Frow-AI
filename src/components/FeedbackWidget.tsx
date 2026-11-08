'use client'

import { forwardRef, useImperativeHandle, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Bug, X, Send, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui'
import { trackEvent } from '@/utils/analytics'

export type FeedbackWidgetHandle = {
  open: (initialMessage?: string) => void
}

export const FeedbackWidget = forwardRef<FeedbackWidgetHandle>(function FeedbackWidget(_props, ref) {
  const [isOpen, setIsOpen] = useState(false)
  const [type, setType] = useState<'feedback' | 'bug'>('feedback')
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  useImperativeHandle(ref, () => ({
    open: (initialMessage = '') => {
      setType('feedback')
      setMessage(initialMessage)
      setSubmitted(false)
      setIsOpen(true)
    },
  }), [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return
    
    setLoading(true)
    // Simulate API call
    await new Promise(r => setTimeout(r, 1000))
    
    trackEvent(type === 'feedback' ? 'feedback_submitted' : 'feedback_submitted', { type, length: message.length })
    
    setSubmitted(true)
    setLoading(false)
    setMessage('')
    
    setTimeout(() => {
      setSubmitted(false)
      setIsOpen(false)
    }, 2000)
  }

  return (
    <div className="fixed bottom-6 right-6 z-100]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="absolute bottom-16 right-0 w-80 bg-[#18181b] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-4 bg-white/5 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-white flex items-center gap-2">
                {type === 'feedback' ? <MessageSquare className="w-3 h-3 text-blue-500" /> : <Bug className="w-3 h-3 text-red-500" />}
                {type === 'feedback' ? 'Share Feedback' : 'Report a Bug'}
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4">
              {submitted ? (
                <div className="py-8 text-center space-y-3">
                  <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
                  <p className="text-xs font-bold text-white uppercase tracking-widest">Received! Thank you.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => setType('feedback')}
                      className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${type === 'feedback' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-500'}`}
                    >
                      Feedback
                    </button>
                    <button 
                      type="button"
                      onClick={() => setType('bug')}
                      className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${type === 'bug' ? 'bg-red-600 text-white' : 'bg-white/5 text-gray-500'}`}
                    >
                      Bug
                    </button>
                  </div>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={type === 'feedback' ? "What's on your mind?" : "What went wrong?"}
                    className="w-full h-32 bg-black/50 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-blue-500/50 resize-none"
                    required
                  />
                  <Button type="submit" disabled={loading} className="w-full h-10 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest gap-2">
                    {loading ? 'Sending...' : (
                      <>
                        <Send className="w-3 h-3" />
                        Submit
                      </>
                    )}
                  </Button>
                </form>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open feedback"
        className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-600/30 border border-white/10"
      >
        <MessageSquare className="w-6 h-6" />
      </motion.button>
    </div>
  )
})
