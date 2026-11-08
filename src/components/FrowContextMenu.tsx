'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ComponentType, KeyboardEvent as ReactKeyboardEvent, SVGProps } from 'react'
import { clampContextMenuPoint, type ContextMenuPoint } from '@/lib/chat/context-menu'

export type FrowContextMenuItem = {
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  onSelect: () => void
  disabled?: boolean
  separatorBefore?: boolean
  shortcut?: string
}

export type FrowContextMenuState = {
  point: ContextMenuPoint
  label: string
  items: FrowContextMenuItem[]
} | null

export function FrowContextMenu({
  state,
  onClose,
}: {
  state: FrowContextMenuState
  onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<ContextMenuPoint | null>(null)

  useLayoutEffect(() => {
    if (!state || !menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    setPosition(clampContextMenuPoint(
      state.point,
      rect.width,
      rect.height,
      window.innerWidth,
      window.innerHeight
    ))
    menuRef.current.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus()
  }, [state])

  useEffect(() => {
    if (!state) return
    const closeOutside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose()
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('resize', onClose)
    }
  }, [state, onClose])

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') || [])
    const activeIndex = items.indexOf(document.activeElement as HTMLButtonElement)
    let nextIndex = activeIndex

    if (event.key === 'ArrowDown') nextIndex = (activeIndex + 1) % items.length
    else if (event.key === 'ArrowUp') nextIndex = (activeIndex - 1 + items.length) % items.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = items.length - 1
    else return

    event.preventDefault()
    items[nextIndex]?.focus()
  }

  if (!state) return null

  return (
      <div
        key={`${state.label}-${state.point.x}-${state.point.y}`}
        ref={menuRef}
        role="menu"
        aria-label={state.label}
        onKeyDown={handleMenuKeyDown}
        style={{
          left: position?.x ?? state.point.x,
          top: position?.y ?? state.point.y,
          visibility: position ? 'visible' : 'hidden',
        }}
        className="frow-context-menu fixed z-999 w-64 max-h-[min(80vh,34rem)] overflow-y-auto rounded-lg border border-(--border-color) bg-(--surface) py-1.5 text-(--foreground) shadow-2xl shadow-black/30 backdrop-blur-xl outline-none"
      >
        {state.items.map((item, index) => {
          const Icon = item.icon
          return (
            <div key={`${item.label}-${index}`}>
              {item.separatorBefore && <div role="separator" className="my-1.5 border-t border-(--border-color)" />}
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                aria-label={item.label}
                onClick={() => {
                  onClose()
                  item.onSelect()
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium transition-colors hover:bg-(--surface-tertiary) focus-visible:bg-(--surface-tertiary) focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-(--apple-gray)" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.shortcut && <span className="text-[10px] text-(--apple-gray)">{item.shortcut}</span>}
              </button>
            </div>
          )
        })}
      </div>
  )
}
