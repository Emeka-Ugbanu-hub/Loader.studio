'use client'

import { createPortal } from 'react-dom'
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'

const OPEN_INFO_EVENT = 'loader-studio-info-open'
const CARD_WIDTH = 290
const EDGE_GAP = 12

interface Props {
  title: string
  children: ReactNode
}

export default function InfoTip({ title, children }: Props) {
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0, width: CARD_WIDTH })

  const updatePosition = useCallback(() => {
    const trigger = rootRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    const width = Math.min(CARD_WIDTH, window.innerWidth - EDGE_GAP * 2)
    const left = Math.min(
      Math.max(EDGE_GAP, rect.right - width),
      window.innerWidth - width - EDGE_GAP
    )

    setPosition({
      top: Math.min(rect.bottom + 8, window.innerHeight - EDGE_GAP),
      left,
      width,
    })
  }, [])

  useEffect(() => {
    const closeOtherTips = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== id) setOpen(false)
    }

    window.addEventListener(OPEN_INFO_EVENT, closeOtherTips as EventListener)
    return () => window.removeEventListener(OPEN_INFO_EVENT, closeOtherTips as EventListener)
  }, [id])

  useEffect(() => {
    if (!open) return

    updatePosition()

    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || cardRef.current?.contains(target)) return
      setOpen(false)
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('pointerdown', closeOnOutsideClick)
    window.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('pointerdown', closeOnOutsideClick)
      window.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, updatePosition])

  const toggleOpen = () => {
    setOpen((current) => {
      const next = !current
      if (next) {
        window.dispatchEvent(new CustomEvent(OPEN_INFO_EVENT, { detail: id }))
        requestAnimationFrame(updatePosition)
      }
      return next
    })
  }

  return (
    <div ref={rootRef} className="info-tip">
      <button
        type="button"
        className="info-trigger"
        aria-label={`${open ? 'Hide' : 'Show'} help for ${title}`}
        aria-expanded={open}
        onClick={toggleOpen}
      >
        i
      </button>
      {typeof document !== 'undefined' && open && createPortal(
        <div
          ref={cardRef}
          className="info-card"
          style={{
            top: position.top,
            left: position.left,
            width: position.width,
          }}
          role="dialog"
          aria-label={title}
        >
          <strong>{title}</strong>
          {children}
        </div>,
        document.body
      )}
    </div>
  )
}
