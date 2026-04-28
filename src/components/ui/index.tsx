'use client'

import * as React from "react"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { motion, AnimatePresence } from "framer-motion"
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// --- BUTTON ---
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline'
  size?: 'sm' | 'md' | 'lg' | 'icon'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: 'bg-[#0a84ff] text-white hover:bg-[#2997ff] active:scale-[0.97]',
      secondary: 'bg-transparent border border-[#0a84ff] text-[#0a84ff] hover:bg-[#0a84ff]/5 active:scale-[0.97]',
      ghost: 'bg-transparent text-white/72 hover:text-white hover:bg-white/5 active:scale-[0.97]',
      destructive: 'bg-[#ff453a]/10 text-[#ff453a] hover:bg-[#ff453a] hover:text-white active:scale-[0.97]',
      outline: 'bg-transparent border border-white/8 text-white hover:bg-white/5 active:scale-[0.97]',
    }
    
    const sizes = {
      sm: 'px-4 py-2 text-xs font-semibold tracking-tight',
      md: 'px-6 py-3 text-sm font-semibold tracking-tight',
      lg: 'px-8 py-4 text-base font-semibold tracking-tight',
      icon: 'p-2.5',
    }
    
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-full font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a84ff]/30 disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

// --- INPUT ---
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "flex h-12 w-full rounded-[14px] border border-white/8 bg-[#1c1c1e] px-4 py-2 text-sm text-white placeholder:text-white/48 focus:border-[#0a84ff] focus:ring-4 focus:ring-[#0a84ff]/10 outline-none transition-all disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

// --- CARD ---
export const Card = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("rounded-[18px] border border-white/8 bg-[#1c1c1e] text-white overflow-hidden shadow-sm", className)} {...props} />
)
export const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 p-8", className)} {...props} />
)
export const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn("font-bold text-2xl tracking-tight text-white", className)} {...props} />
)
export const CardDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-base text-white/72 leading-relaxed", className)} {...props} />
)
export const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-8 pt-0", className)} {...props} />
)
export const CardFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex items-center p-8 pt-0", className)} {...props} />
)

// --- SKELETON ---
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-2xl bg-white/5", className)}
      {...props}
    />
  )
}

// --- TOAST SYSTEM ---
type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  message: string
  type: ToastType
}

const ToastContext = React.createContext<{
  toast: (message: string, type?: ToastType) => void
} | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const toast = React.useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3500)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-8 right-8 z-50 flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              className={cn(
                "flex items-center gap-4 px-5 py-4 rounded-[18px] border shadow-2xl pointer-events-auto min-w-[320px] backdrop-blur-xl",
                t.type === 'success' ? "bg-[#32d74b]/10 border-[#32d74b]/20 text-[#32d74b]" :
                t.type === 'error' ? "bg-[#ff453a]/10 border-[#ff453a]/20 text-[#ff453a]" :
                t.type === 'warning' ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                "bg-[#1c1c1e]/90 border-white/8 text-white"
              )}
            >
              <div className="shrink-0">
                {t.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
                {t.type === 'error' && <AlertCircle className="w-5 h-5" />}
                {t.type === 'warning' && <AlertCircle className="w-5 h-5" />}
                {t.type === 'info' && <Info className="w-5 h-5" />}
              </div>
              <span className="text-sm font-bold tracking-tight">{t.message}</span>
              <button 
                onClick={() => setToasts(prev => prev.filter(toast => toast.id !== t.id))}
                className="ml-auto p-1.5 hover:bg-white/5 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-white/48" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) throw new Error("useToast must be used within ToastProvider")
  return context
}
