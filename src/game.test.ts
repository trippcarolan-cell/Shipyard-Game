import { describe, expect, it } from 'vitest'
import { play, reducer } from './state/reducer'
import type { Action, AppState, GameState } from './state/types'
import { createInitialState } from './sim/initialState'
import { tickWeek } from './sim/tick'

const SEED = 'drydock-m0'
const CREW_IDS = ['alden', 'briggs', 'cho', 'dunn'] as const

function start(seed = SEED): AppState {
  return reducer(undefined, { type: 'START_RUN', seed })
}

function assignAll(state: AppState, stage: 'assembly' | 'cutting' | 'erection' | 'outfitting'): AppState {
  const hullId = state.run?.hulls[0]?.id
  if (!hullId) return state
  let s = state
  for (const crewId of CREW_IDS) {
    s = reducer(s, { type: 'ASSIGN_CREW', crewId, hullId, stage })
  }
  return s
}

function assignToCurrent(state: AppState): AppState {
  const hull = state.run?.hulls[0]
  if (!hull || !state.run) return state
  let s = state
  for (const crew of state.run.crews) {
    if (crew.walkoffWeeksLeft > 0) continue
    s = reducer(s, { type: 'ASSIGN_CREW', crewId: crew.id, hullId: hull.id, stage: hull.stage })
  }
  return s
}

function rushDeliverInherited(state: AppState): AppState {
  let s = reducer(state, { type: 'TOGGLE_RUSH', hullId: 'hull-1' })
  for (let i = 0; i < 20; i++) {
    const run = s.run
    if (!run || run.ended || run.hullsDelivered > 0 || !run.hulls[0]) break
    if (run.week > 14) break
    s = assignToCurrent(s)
    s = reducer(s, { type: 'CONTINUE' })
  }
  return s
}

describe('DRYDOCK M0', () => {
  it('two runs with the same seed and action list produce identical JSON', () => {
    const actions: Action[] = [
      { type: 'START_RUN', seed: SEED },
      { type: 'ASSIGN_CREW', crewId: 'alden', hullId: 'hull-1', stage: 'assembly' },
      { type: 'ASSIGN_CREW', crewId: 'briggs', hullId: 'hull-1', stage: 'assembly' },
      { type: 'ASSIGN_CREW', crewId: 'cho', hullId: 'hull-1', stage: 'assembly' },
      { type: 'ASSIGN_CREW', crewId: 'dunn', hullId: 'hull-1', stage: 'assembly' },
      { type: 'CONTINUE' },
      { type: 'ASSIGN_CREW', crewId: 'alden', hullId: 'hull-1', stage: 'erection' },
      { type: 'STEP_WEEK' },
    ]
    const a = play(actions)
    const b = play(actions)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('assigning all four crews to assembly then Continue halts on stage_complete in weeks 2–6', () => {
    let s = start()
    s = assignAll(s, 'assembly')
    s = reducer(s, { type: 'CONTINUE' })
    const run = s.run as GameState
    expect(run.ended).toBe(false)
    expect(run.week).toBeLessThan(48)
    expect(run.haltReason?.type).toBe('stage_complete')
    if (run.haltReason?.type === 'stage_complete') {
      expect(run.haltReason.stage).toBe('assembly')
    }
    expect(run.week).toBeGreaterThanOrEqual(2)
    expect(run.week).toBeLessThanOrEqual(6)
    expect(run.hulls[0]?.stage).toBe('erection')
  })

  it('all four crews rushing the inherited hull delivers by week 14', () => {
    let s = rushDeliverInherited(start())
    const run = s.run as GameState
    expect(run.hullsDelivered).toBeGreaterThanOrEqual(1)
    expect(run.week).toBeLessThanOrEqual(14)
  })

  it('after delivering the inherited hull, Continue with a free berth does not halt on contract_expiring every week; a final-week halt fires at most once per offer', () => {
    let s = rushDeliverInherited(start())
    const delivered = s.run as GameState
    expect(delivered.hullsDelivered).toBeGreaterThanOrEqual(1)
    expect(delivered.hulls.length).toBe(0)
    expect(delivered.berthOccupiedBy).toBeNull()

    // Prove Continue is not a weekly contract_expiring spam: young offers skip until final week.
    s = {
      ...s,
      run: {
        ...delivered,
        offers: delivered.offers.map((o) => ({ ...o, age: 0 })),
      },
    }
    const weekBefore = s.run!.week
    s = reducer(s, { type: 'CONTINUE' })
    const afterSkip = s.run as GameState
    expect(afterSkip.week).toBeGreaterThan(weekBefore + 1)
    if (afterSkip.haltReason?.type === 'contract_expiring') {
      expect(afterSkip.week - weekBefore).toBeGreaterThan(1)
    }

    const seen = new Set<string>()
    for (let i = 0; i < 6; i++) {
      const run = s.run as GameState
      if (!run || run.ended) break
      if (run.haltReason?.type === 'contract_expiring') {
        expect(seen.has(run.haltReason.offerId)).toBe(false)
        seen.add(run.haltReason.offerId)
      }
      s = reducer(s, { type: 'CONTINUE' })
    }
    const last = s.run as GameState
    if (last.haltReason?.type === 'contract_expiring') {
      expect(seen.has(last.haltReason.offerId)).toBe(false)
    }
  })

  it('accepting a contract reduces offer count (slot empty) rather than immediately refilling to 3', () => {
    let s = rushDeliverInherited(start())
    const before = s.run as GameState
    expect(before.hulls.length).toBe(0)
    expect(before.offers.length).toBeGreaterThan(0)
    const offerCount = before.offers.length
    const offerId = before.offers[0]!.id
    s = reducer(s, { type: 'ACCEPT_CONTRACT', offerId })
    const after = s.run as GameState
    expect(after.offers.length).toBe(offerCount - 1)
    expect(after.offers.find((o) => o.id === offerId)).toBeUndefined()
    expect(after.hulls.length).toBe(1)
  })

  it('cash_warning does not re-fire on a second Continue while cash remains negative but has not crossed a new band', () => {
    let s = start()
    s = reducer(s, { type: 'ASSIGN_CREW', crewId: 'alden', hullId: 'hull-1', stage: 'assembly' })
    s = {
      ...s,
      run: { ...(s.run as GameState), cash: 100, cashBand: 'ok' },
    }
    s = reducer(s, { type: 'CONTINUE' })
    const first = s.run as GameState
    expect(first.haltReason?.type).toBe('cash_warning')
    expect(first.cash).toBeLessThan(0)
    expect(first.cashBand).toBe('warning')
    s = reducer(s, { type: 'CONTINUE' })
    const second = s.run as GameState
    expect(second.haltReason?.type).not.toBe('cash_warning')
    expect(second.cash).toBeLessThan(0)
    expect(second.cashBand).not.toBe('ok')
  })

  it('tickWeek cash edge only fires on a downward band cross', () => {
    let run = createInitialState(SEED)
    run = { ...run, cash: 50, cashBand: 'ok' }
    const first = tickWeek(run)
    expect(first.haltReason?.type).toBe('cash_warning')
    expect(first.cashBand).toBe('warning')
    const second = tickWeek(first)
    expect(second.haltReason?.type).not.toBe('cash_warning')
    expect(second.cashBand).toBe('warning')
  })
})
