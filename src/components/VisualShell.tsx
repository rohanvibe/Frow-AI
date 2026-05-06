'use client'

import { motion, useScroll } from 'framer-motion'
import { ReactNode } from 'react'

export function VisualShell({ children }: { children: ReactNode }) {
  const { scrollYProgress } = useScroll()

  return (
    <>
      {/* Scroll Progress Bar */}
      <motion.div 
        style={{ scaleX: scrollYProgress }}
        className="fixed top-0 left-0 right-0 h-1 bg-blue-600 origin-left z-[100] shadow-[0_0_15px_rgba(59,130,246,0.5)]"
      />

      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 90, 180, 270, 360],
            opacity: [0.1, 0.2, 0.1]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[20%] -left-[10%] w-[60%] aspect-square bg-blue-500/10 rounded-full blur-[120px]"
        />
        <motion.div 
          animate={{ 
            scale: [1.2, 1, 1.2],
            rotate: [360, 270, 180, 90, 0],
            opacity: [0.05, 0.15, 0.05]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-[20%] -right-[10%] w-[50%] aspect-square bg-indigo-500/10 rounded-full blur-[120px]"
        />
      </div>

      <div className="relative z-10 w-full h-full">
        {children}
      </div>
    </>
  )
}
