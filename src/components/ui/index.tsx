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
      primary: 'bg-white text-black hover:bg-gray-200 shadow-sm',
      secondary: 'bg-[#27272a] text-white hover:bg-[#3f3f46]',
      ghost: 'bg-transparent text-white hover:bg-white/5',
      destructive: 'bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white',
      outline: 'bg-transparent border border-[#27272a] text-white hover:bg-white/5',
    }
    
    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
      icon: 'p-2',
    }
    
    return (
      <motion.button
        ref={ref as any}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className={cn(
          "inline-flex items-center justify-center rounded-xl font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        {...(props as any)}
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
          "flex h-11 w-full rounded-xl border border-[#27272a] bg-[#18181b] px-4 py-1 text-sm shadow-sm transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
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
  <div className={cn("rounded-2xl border border-[#27272a] bg-[#09090b] text-white shadow-xl overflow-hidden", className)} {...props} />
)
export const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
)
export const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn("font-bold text-lg leading-none tracking-tight", className)} {...props} />
)
export const CardDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-sm text-gray-500", className)} {...props} />
)
export const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-6 pt-0", className)} {...props} />
)
export const CardFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex items-center p-6 pt-0", className)} {...props} />
)

// --- SKELETON ---
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-white/5", className)}
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
    }, 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl pointer-events-auto min-w-[280px]",
                t.type === 'success' ? "bg-green-500/10 border-green-500/20 text-green-400" :
                t.type === 'error' ? "bg-red-500/10 border-red-500/20 text-red-400" :
                t.type === 'warning' ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                "bg-[#18181b] border-[#27272a] text-white"
              )}
            >
              {t.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
              {t.type === 'error' && <AlertCircle className="w-4 h-4" />}
              {t.type === 'warning' && <AlertCircle className="w-4 h-4" />}
              {t.type === 'info' && <Info className="w-4 h-4" />}
              <span className="text-sm font-medium">{t.message}</span>
              <button 
                onClick={() => setToasts(prev => prev.filter(toast => toast.id !== t.id))}
                className="ml-auto p-1 hover:bg-white/10 rounded-md transition-colors"
              >
                <X className="w-3 h-3" />
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

export { Logo } from "./Logo"
