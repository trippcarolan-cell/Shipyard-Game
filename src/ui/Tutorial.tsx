import { useEffect, useLayoutEffect, useState } from 'react'
import type { GameState } from '../state/types'
import {
  TUTORIAL_COPY,
  TUTORIAL_DONE_TOAST,
  shouldShowTutorialCard,
  tutorialTargets,
  type TutorialStepId,
} from './tutorial'

type Rect = { x: number; y: number; w: number; h: number }

const CARD_WIDTH = 352
const CARD_EST_HEIGHT = 168
const HOLE_PAD = 6
const VIEW_PAD = 16

function measureTargets(ids: string[]): Rect[] {
  const seen = new Set<Element>()
  const rects: Rect[] = []
  for (const id of ids) {
    const nodes = document.querySelectorAll(`[data-tutorial="${id}"]`)
    nodes.forEach((el) => {
      if (seen.has(el)) return
      seen.add(el)
      const r = el.getBoundingClientRect()
      if (r.width < 2 || r.height < 2) return
      rects.push({ x: r.left, y: r.top, w: r.width, h: r.height })
    })
  }
  return rects
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function placeCard(rects: Rect[]): { top: number; left: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const cardH = CARD_EST_HEIGHT
  const cardW = CARD_WIDTH
  if (rects.length === 0) {
    return { top: Math.max(VIEW_PAD, vh / 2 - cardH / 2), left: Math.max(VIEW_PAD, vw / 2 - cardW / 2) }
  }
  const primary = rects[0]!
  const right = primary.x + primary.w
  const bottom = primary.y + primary.h

  if (right + VIEW_PAD + cardW <= vw - VIEW_PAD) {
    return { top: clamp(primary.y, VIEW_PAD, vh - cardH - VIEW_PAD), left: right + VIEW_PAD }
  }
  if (primary.x - VIEW_PAD - cardW >= VIEW_PAD) {
    return { top: clamp(primary.y, VIEW_PAD, vh - cardH - VIEW_PAD), left: primary.x - VIEW_PAD - cardW }
  }
  if (bottom + VIEW_PAD + cardH <= vh - VIEW_PAD) {
    return { top: bottom + VIEW_PAD, left: clamp(primary.x, VIEW_PAD, vw - cardW - VIEW_PAD) }
  }
  if (primary.y - VIEW_PAD - cardH >= VIEW_PAD) {
    return { top: primary.y - VIEW_PAD - cardH, left: clamp(primary.x, VIEW_PAD, vw - cardW - VIEW_PAD) }
  }
  return { top: VIEW_PAD, left: VIEW_PAD }
}

function Spotlight({ rects, vw, vh }: { rects: Rect[]; vw: number; vh: number }) {
  const holes = rects.map((r) => ({
    x: r.x - HOLE_PAD,
    y: r.y - HOLE_PAD,
    w: r.w + HOLE_PAD * 2,
    h: r.h + HOLE_PAD * 2,
  }))
  return (
    <svg
      className="pointer-events-none fixed inset-0 z-40"
      width={vw}
      height={vh}
      aria-hidden
    >
      <defs>
        <mask id="drydock-tutorial-mask">
          <rect width="100%" height="100%" fill="white" />
          {holes.map((h, i) => (
            <rect key={i} x={h.x} y={h.y} width={h.w} height={h.h} fill="black" />
          ))}
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill="rgba(18,20,23,0.72)"
        mask="url(#drydock-tutorial-mask)"
      />
      {holes.map((h, i) => (
        <rect
          key={i}
          x={h.x}
          y={h.y}
          width={h.w}
          height={h.h}
          fill="none"
          stroke="#b33b2f"
          strokeWidth="2"
        />
      ))}
    </svg>
  )
}

export function Tutorial({
  step,
  run,
  onSkip,
  onGotIt,
  onDoneShown,
}: {
  step: TutorialStepId
  run: GameState
  onSkip: () => void
  onGotIt: () => void
  onDoneShown: () => void
}) {
  const show = shouldShowTutorialCard(step, run)
  const targetKey = tutorialTargets(step).join('|')
  const [rects, setRects] = useState<Rect[]>([])
  const [viewport, setViewport] = useState({ vw: 0, vh: 0 })

  useLayoutEffect(() => {
    if (!show || step === 'done') return
    const ids = targetKey.length === 0 ? [] : targetKey.split('|')
    const measure = () => {
      setViewport({ vw: window.innerWidth, vh: window.innerHeight })
      setRects(measureTargets(ids))
    }
    measure()
    const obs = new MutationObserver(measure)
    obs.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      obs.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [show, step, targetKey])

  useEffect(() => {
    if (step === 'done') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onSkip()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, onSkip])

  useEffect(() => {
    if (step !== 'done') return
    const t = window.setTimeout(() => onDoneShown(), 4200)
    return () => window.clearTimeout(t)
  }, [step, onDoneShown])

  if (step === 'done') {
    return (
      <div
        className="tutorial-toast pointer-events-none fixed bottom-8 left-1/2 z-50 -translate-x-1/2 border border-steel-700 bg-steel-800 px-4 py-2 text-sm text-steel-300"
        role="status"
      >
        {TUTORIAL_DONE_TOAST}
      </div>
    )
  }

  if (!show) return null

  const copy = TUTORIAL_COPY[step]
  const pos = placeCard(rects)

  return (
    <>
      <Spotlight rects={rects} vw={viewport.vw} vh={viewport.vh} />
      <div
        role="dialog"
        aria-labelledby="drydock-tutorial-title"
        className="pointer-events-auto fixed z-50 w-[22rem] border border-steel-700 border-l-2 border-l-oxide bg-steel-800"
        style={{ top: pos.top, left: pos.left }}
      >
        <div className="flex items-start justify-between gap-3 border-b border-steel-700 px-3 py-2">
          <div
            id="drydock-tutorial-title"
            className="text-[11px] font-semibold uppercase tracking-[0.25em] text-steel-300"
          >
            {copy.title}
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="shrink-0 text-[10px] uppercase tracking-wider text-steel-500 hover:text-oxide"
          >
            Skip briefing
          </button>
        </div>
        <div className="px-3 py-3 text-sm leading-snug text-steel-400">{copy.body}</div>
        {step === 'rush' && (
          <div className="border-t border-steel-700 px-3 py-2">
            <button
              type="button"
              onClick={onGotIt}
              className="border border-steel-700 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-steel-400 hover:border-oxide hover:text-oxide"
            >
              Got it
            </button>
          </div>
        )}
      </div>
    </>
  )
}
