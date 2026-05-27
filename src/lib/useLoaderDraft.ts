import { useEffect, useRef, useState } from 'react'
import type { CustomPathStep, LoaderOptions } from './types'
import { DEFAULT_OPTIONS } from './types'
import { generateCustomFrames } from './patterns'

const DRAFT_KEY = 'loader-studio:draft:v1'

interface DraftData {
  options: LoaderOptions
  mode: 'preset' | 'custom'
  selectedPreset: string
  customPath: CustomPathStep[]
  hiddenCells: string[]
}

export function useLoaderDraft(
  options: LoaderOptions,
  mode: 'preset' | 'custom',
  selectedPreset: string,
  customPath: CustomPathStep[],
  hiddenCells: string[],
  setOptions: (o: LoaderOptions) => void,
  setMode: (m: 'preset' | 'custom') => void,
  setSelectedPreset: (p: string) => void,
  setCustomPath: (p: CustomPathStep[]) => void,
  setCustomFrames: (f: number[][][]) => void,
  setHiddenCells: (h: string[]) => void,
) {
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saved' | 'restored'>('idle')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const restoredRef = useRef(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const draft: DraftData = JSON.parse(raw)
      const draftOptions = draft.options ? { ...DEFAULT_OPTIONS, ...draft.options } : undefined
      if (draftOptions) setOptions(draftOptions)
      if (draft.mode) setMode(draft.mode)
      if (draft.selectedPreset) setSelectedPreset(draft.selectedPreset)
      if (draft.customPath) {
        setCustomPath(draft.customPath)
        setCustomFrames(generateCustomFrames(draft.customPath, draftOptions?.gridSize ?? DEFAULT_OPTIONS.gridSize))
      }
      if (draft.hiddenCells) setHiddenCells(draft.hiddenCells)
      setTimeout(() => setDraftStatus('restored'), 0)
    } catch {
      // ignore corrupted drafts
    }
  }, [setOptions, setMode, setSelectedPreset, setCustomPath, setCustomFrames, setHiddenCells])

  useEffect(() => {
    if (draftStatus === 'restored' && !restoredRef.current) {
      restoredRef.current = true
      const timer = setTimeout(() => setDraftStatus('idle'), 100)
      return () => clearTimeout(timer)
    }
  }, [draftStatus])

  useEffect(() => {
    if (draftStatus === 'restored') return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const draft: DraftData = { options, mode, selectedPreset, customPath, hiddenCells }
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
        setDraftStatus('saved')
      } catch {
        // quota exceeded or storage unavailable
      }
    }, 600)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, mode, selectedPreset, customPath, hiddenCells])

  return draftStatus
}
