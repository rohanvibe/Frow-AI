'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export type ShortcutId =
  | 'newChat'
  | 'sendMessage'
  | 'stopResponse'
  | 'toggleNav'
  | 'toggleSidebar'
  | 'focusSearch'
  | 'openSettings'
  | 'openPrompts'
  | 'shareChat'
  | 'attachFile'

export type ShortcutDef = {
  id: ShortcutId
  label: string
  defaultKey: string       // e.g. "Ctrl+N"
  key: string              // Current active key (user-assigned or default)
  action: () => void
}

export type ShortcutMap = Record<ShortcutId, string>

// ─────────────────────────────────────────────────────────────────────────────
// Default key bindings
// ─────────────────────────────────────────────────────────────────────────────
export const DEFAULT_SHORTCUTS: ShortcutMap = {
  newChat:       'Ctrl+Alt+N',
  sendMessage:   'Enter',
  stopResponse:  'Escape',
  toggleNav:     'Ctrl+B',
  toggleSidebar: 'Ctrl+\\',
  focusSearch:   'Ctrl+K',
  openSettings:  'Ctrl+,',
  openPrompts:   'Ctrl+P',
  shareChat:     'Ctrl+Shift+S',
  attachFile:    'Ctrl+Shift+A',
}

export const SHORTCUT_LABELS: Record<ShortcutId, string> = {
  newChat:       'New Chat',
  sendMessage:   'Send Message',
  stopResponse:  'Stop Response',
  toggleNav:     'Toggle Navigation',
  toggleSidebar: 'Toggle Thread Sidebar',
  focusSearch:   'Search Chats',
  openSettings:  'Open Settings',
  openPrompts:   'Open Prompt Library',
  shareChat:     'Share Chat',
  attachFile:    'Attach File',
}

const STORAGE_KEY = 'Frow_shortcuts_v1'

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────
export function useShortcuts(actions: Record<ShortcutId, () => void>) {
  const [shortcuts, setShortcuts] = useState<ShortcutMap>(() => {
    if (typeof window === 'undefined') return DEFAULT_SHORTCUTS
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? { ...DEFAULT_SHORTCUTS, ...JSON.parse(saved) } : DEFAULT_SHORTCUTS
    } catch { return DEFAULT_SHORTCUTS }
  })

  // Persist to localStorage whenever map changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts))
  }, [shortcuts])

  const actionsRef = useRef(actions)
  useEffect(() => { actionsRef.current = actions }, [actions])

  // ── Parse a key string into a modifier + key combo ──
  const parseKey = (keyStr: string) => {
    const parts = keyStr.split('+')
    const key = parts[parts.length - 1].toLowerCase()
    return {
      ctrl:  parts.some(p => p.toLowerCase() === 'ctrl'),
      alt:   parts.some(p => p.toLowerCase() === 'alt'),
      shift: parts.some(p => p.toLowerCase() === 'shift'),
      meta:  parts.some(p => p.toLowerCase() === 'cmd' || p.toLowerCase() === 'meta'),
      key,
    }
  }

  // ── Global keydown listener ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea  
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      for (const [id, keyStr] of Object.entries(shortcuts) as [ShortcutId, string][]) {
        const parsed = parseKey(keyStr)
        const matches =
          parsed.key === e.key.toLowerCase() &&
          parsed.ctrl  === e.ctrlKey &&
          parsed.shift === e.shiftKey &&
          parsed.alt   === e.altKey &&
          (parsed.meta ? e.metaKey : true)

        if (matches) {
          e.preventDefault()
          actionsRef.current[id]?.()
          break
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts])

  const updateShortcut = useCallback((id: ShortcutId, newKey: string) => {
    setShortcuts(prev => ({ ...prev, [id]: newKey }))
  }, [])

  const resetShortcuts = useCallback(() => {
    setShortcuts(DEFAULT_SHORTCUTS)
  }, [])

  const getShortcutLabel = useCallback((id: ShortcutId) => {
    return shortcuts[id] || DEFAULT_SHORTCUTS[id]
  }, [shortcuts])

  return { shortcuts, updateShortcut, resetShortcuts, getShortcutLabel }
}

// ─────────────────────────────────────────────────────────────────────────────
// Capture shortcut from a KeyboardEvent
// ─────────────────────────────────────────────────────────────────────────────
export function captureShortcutString(e: React.KeyboardEvent): string | null {
  const ignoredKeys = ['Control', 'Alt', 'Shift', 'Meta', 'CapsLock', 'Tab']
  if (ignoredKeys.includes(e.key)) return null

  const parts: string[] = []
  if (e.ctrlKey)  parts.push('Ctrl')
  if (e.altKey)   parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (e.metaKey)  parts.push('Cmd')
  parts.push(e.key === ' ' ? 'Space' : e.key)
  return parts.join('+')
}

// ─────────────────────────────────────────────────────────────────────────────
// Right-Click Shortcut Assigner Context Menu
// ─────────────────────────────────────────────────────────────────────────────
export type ContextMenuState = {
  x: number
  y: number
  shortcutId: ShortcutId
  label: string
} | null

export function ShortcutContextMenu({
  state,
  currentKey,
  onAssign,
  onClose,
}: {
  state: ContextMenuState
  currentKey: string
  onAssign: (id: ShortcutId, key: string) => void
  onClose: () => void
}) {
  const [capturing, setCapturing] = useState(false)
  const [captured, setCaptured] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!state) return
    setCaptured(null)
    setCapturing(false)
  }, [state])

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [onClose])

  if (!state) return null

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const str = captureShortcutString(e)
    if (str) setCaptured(str)
  }

  const confirm = () => {
    if (captured && state) {
      onAssign(state.shortcutId, captured)
      onClose()
    }
  }

  return (
    <div
      ref={menuRef}
      style={{ left: state.x, top: state.y }}
      className="fixed z-999 bg-[#18181b] border border-white/10 rounded-2xl shadow-2xl shadow-black/60 backdrop-blur-xl overflow-hidden w-72"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Assign Shortcut</span>
        <button onClick={onClose} className="text-gray-600 hover:text-white transition-colors text-xs">✕</button>
      </div>

      <div className="p-4 space-y-4">
        {/* Button name */}
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Button</p>
          <p className="text-sm font-bold text-white">{state.label}</p>
        </div>

        {/* Current */}
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Current Shortcut</p>
          <kbd className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-gray-300">{currentKey}</kbd>
        </div>

        {/* Capture area */}
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">New Shortcut</p>
          {capturing ? (
            <div
              tabIndex={0}
              autoFocus
              onKeyDown={handleKeyDown}
              className="w-full px-3 py-2.5 rounded-xl border-2 border-blue-500/60 bg-blue-500/5 text-sm font-mono text-white outline-none focus:ring-0 cursor-text"
            >
              {captured
                ? <span className="text-blue-400 font-bold">{captured}</span>
                : <span className="text-gray-500 animate-pulse">Press any key combo...</span>
              }
            </div>
          ) : (
            <button
              onClick={() => setCapturing(true)}
              className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/5 text-xs font-bold text-gray-400 hover:text-white hover:border-blue-500/40 transition-all text-left"
            >
              Click here and press key combo
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-all"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={!captured}
            className="flex-1 py-2 rounded-xl bg-blue-600 disabled:opacity-30 text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-500 transition-all"
          >
            Assign
          </button>
        </div>
      </div>
    </div>
  )
}

