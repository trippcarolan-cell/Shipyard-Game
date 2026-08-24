import { config } from '../config'
import { createInitialState } from '../sim/initialState'
import { isProducing } from '../sim/output'
import {
  applyAccept,
  applyAssign,
  applyToggleRush,
  applyUnassign,
  compactSkippedText,
  insertLogAfterNew,
  tickWeek,
} from '../sim/tick'
import type { Action, AppState, GameState, HaltReason } from './types'

export const defaultState: AppState = {
  run: null,
  screen: 'start',
  seed: config.M0.defaultSeed,
}

function idleIncompleteHull(run: GameState): boolean {
  const hull = run.hulls.find((h) => !h.complete)
  if (!hull) return false
  return !run.crews.some((c) => isProducing(c, run.hulls))
}

function continueRun(run: GameState, oneWeek: boolean): GameState {
  if (!oneWeek && idleIncompleteHull(run)) {
    const halt: HaltReason = run.haltReason?.type === 'crews_idle'
      ? run.haltReason
      : run.haltReason ?? {
          type: 'crews_idle',
          message: 'Crews idle — assign a crew to continue',
        }
    return {
      ...run,
      haltReason: halt,
      haltReasons: run.haltReasons.length > 0 ? run.haltReasons : [halt],
    }
  }
  let current: GameState = {
    ...run,
    badges: [],
    haltReason: null,
    haltReasons: [],
  }
  const skipped: number[] = []
  while (!current.ended && current.week <= config.TIME.weeksPerRun) {
    const prevLogLength = current.log.length
    const next = tickWeek(current)
    const halted = next.ended || next.haltReason !== null
    if (halted) {
      let withLog = next
      if (skipped.length > 0) {
        withLog = insertLogAfterNew(
          next,
          prevLogLength,
          'info',
          compactSkippedText(skipped),
          skipped[skipped.length - 1] ?? next.week,
        )
      }
      return withLog
    }
    skipped.push(current.week)
    current = next
    if (oneWeek) return current
  }
  return current
}

export function reducer(state: AppState = defaultState, action: Action): AppState {
  switch (action.type) {
    case 'SET_SEED':
      return { ...state, seed: action.seed }
    case 'START_RUN': {
      const seed = action.seed.trim() || config.M0.defaultSeed
      return { run: createInitialState(seed), screen: 'game', seed }
    }
    case 'RETRY_SEED': {
      const seed = state.seed.trim() || config.M0.defaultSeed
      return { run: createInitialState(seed), screen: 'game', seed }
    }
    case 'NEW_SEED':
      return { run: null, screen: 'start', seed: state.seed }
    case 'ASSIGN_CREW': {
      if (!state.run || state.screen !== 'game') return state
      return { ...state, run: applyAssign(state.run, action.crewId, action.hullId, action.stage) }
    }
    case 'UNASSIGN_CREW': {
      if (!state.run || state.screen !== 'game') return state
      return { ...state, run: applyUnassign(state.run, action.crewId) }
    }
    case 'TOGGLE_RUSH': {
      if (!state.run || state.screen !== 'game') return state
      return { ...state, run: applyToggleRush(state.run, action.hullId) }
    }
    case 'ACCEPT_CONTRACT': {
      if (!state.run || state.screen !== 'game') return state
      return { ...state, run: applyAccept(state.run, action.offerId) }
    }
    case 'CONTINUE': {
      if (!state.run || state.screen !== 'game') return state
      const run = continueRun(state.run, false)
      if (run.ended) return { ...state, run, screen: 'end' }
      return { ...state, run }
    }
    case 'STEP_WEEK': {
      if (!state.run || state.screen !== 'game') return state
      const run = continueRun(state.run, true)
      if (run.ended) return { ...state, run, screen: 'end' }
      return { ...state, run }
    }
    default:
      return state
  }
}

export function play(actions: Action[], start: AppState = defaultState): AppState {
  return actions.reduce(reducer, start)
}
