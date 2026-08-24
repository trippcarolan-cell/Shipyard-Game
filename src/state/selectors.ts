import { config, STAGES } from '../config'
import { hullAssignedCrews, isOverflow, isProducing, isWalkoff, stageWork } from '../sim/output'
import { projectHull } from '../sim/projection'
import type { Crew, GameState, Hull, StageId } from './types'

export function weeksToDeadline(state: GameState, hull: Hull): number {
  return hull.deadlineWeek - state.week
}

export function hullProjection(state: GameState, hull: Hull): number | null {
  return projectHull(state, hull)
}

export function stageProgress(hull: Hull): { done: number; req: number; pct: number }[] {
  return STAGES.map((stage) => {
    const req = stageWork(hull.classId, stage)
    let done = 0
    const idx = STAGES.indexOf(stage)
    const cur = STAGES.indexOf(hull.stage)
    if (idx < cur || hull.complete) done = req
    else if (idx === cur) done = hull.workInStage
    return { done, pct: done / req, req }
  })
}

export function occupancyPct(hull: Hull | undefined): number {
  if (!hull) return 0
  const total = config.SHIPS[hull.classId].workUnits
  return hull.totalWorkDone / total
}

export function benchCrews(state: GameState): Crew[] {
  return state.crews.filter((c) => !c.assignment && !isWalkoff(c))
}

export function walkoffCrews(state: GameState): Crew[] {
  return state.crews.filter((c) => isWalkoff(c))
}

export function hullCrews(state: GameState, hull: Hull): Crew[] {
  return hullAssignedCrews(hull, state.crews)
}

export function producingCount(state: GameState, hull: Hull): number {
  return state.crews.filter((c) => c.assignment?.hullId === hull.id && isProducing(c, state.hulls)).length
}

export function overflowCount(state: GameState, hull: Hull): number {
  return state.crews.filter((c) => c.assignment?.hullId === hull.id && isOverflow(c, state.hulls)).length
}

export function canAccept(state: GameState): boolean {
  return state.hulls.length === 0 && state.berthOccupiedBy === null
}

export function crewsIdleOnHull(state: GameState): boolean {
  const hull = state.hulls.find((h) => !h.complete)
  if (!hull) return false
  return !state.crews.some((c) => isProducing(c, state.hulls))
}

export function canContinue(state: GameState): boolean {
  return !state.ended && !crewsIdleOnHull(state)
}

export function statusLine(state: GameState): string {
  if (state.haltReason) return state.haltReason.message
  if (state.week === 1 && state.hulls.length > 0) {
    return 'Week 1 — assign crews. Inherited hull in assembly.'
  }
  return 'No interruption this week.'
}

export function currentHull(state: GameState): Hull | undefined {
  return state.hulls[0]
}

export { STAGES }
export type { StageId }
