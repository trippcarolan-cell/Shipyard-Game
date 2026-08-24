import { config, STAGES } from '../config'
import type { Crew, GameState, Hull } from '../state/types'
import { clamp, crewOutput, hullAssignedCrews, nextStage, stageWork } from './output'

export function projectHull(state: GameState, hull: Hull): number | null {
  const assigned = hullAssignedCrews(hull, state.crews)
  if (assigned.length === 0) return null

  const crews: Crew[] = assigned.map((c) => structuredClone(c))
  let stage = hull.stage
  let workInStage = hull.workInStage
  let week = state.week
  const rush = hull.rush
  const classId = hull.classId
  const horizon = state.week + config.TRIGGERS.projectionHorizon

  while (week <= horizon) {
    let raw = 0
    for (const crew of crews) {
      raw += crewOutput(crew, stage, rush)
    }
    const req = stageWork(classId, stage)
    const applied = Math.min(raw, req - workInStage)
    workInStage += applied

    for (const crew of crews) {
      const nextProf = { ...crew.proficiency }
      for (const s of STAGES) {
        if (s === stage) nextProf[s] = clamp(nextProf[s] + config.PROFICIENCY.producingGain, config.PROFICIENCY.min, config.PROFICIENCY.max)
        else nextProf[s] = clamp(nextProf[s] - config.PROFICIENCY.otherDecay, config.PROFICIENCY.min, config.PROFICIENCY.max)
      }
      crew.proficiency = nextProf
      const delta = rush ? config.FATIGUE.rush : config.FATIGUE.producing
      crew.fatigue = clamp(crew.fatigue + delta, config.FATIGUE.min, config.FATIGUE.max)
    }

    if (workInStage >= req) {
      const nxt = nextStage(stage)
      if (!nxt) return week
      stage = nxt
      workInStage = 0
    }
    week += 1
  }
  return null
}

export function snapshotProjections(state: GameState): Record<string, number | null> {
  const out: Record<string, number | null> = {}
  for (const hull of state.hulls) {
    if (hull.complete) continue
    out[hull.id] = projectHull(state, hull)
  }
  return out
}
