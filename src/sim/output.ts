import { config, STAGES } from '../config'
import type { Crew, Hull, StageId } from '../state/types'

export function emptyProficiency(value: number) {
  return {
    assembly: value,
    cutting: value,
    erection: value,
    outfitting: value,
  }
}

export function stageWork(classId: Hull['classId'], stage: StageId): number {
  return config.SHIPS[classId].stageWork[stage]
}

export function nextStage(stage: StageId): StageId | null {
  const i = STAGES.indexOf(stage)
  return i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1] : null
}

export function stageLabel(stage: StageId): string {
  return stage.charAt(0).toUpperCase() + stage.slice(1)
}

export function hullById(hulls: Hull[], id: string): Hull | undefined {
  return hulls.find((h) => h.id === id)
}

export function isWalkoff(crew: Crew): boolean {
  return crew.walkoffWeeksLeft > 0
}

export function isProducing(crew: Crew, hulls: Hull[]): boolean {
  if (isWalkoff(crew) || !crew.assignment) return false
  const hull = hullById(hulls, crew.assignment.hullId)
  if (!hull || hull.complete) return false
  return hull.stage === crew.assignment.stage
}

export function isOverflow(crew: Crew, hulls: Hull[]): boolean {
  if (isWalkoff(crew) || !crew.assignment) return false
  const hull = hullById(hulls, crew.assignment.hullId)
  if (!hull || hull.complete) return false
  return hull.stage !== crew.assignment.stage
}

export function assignedToHull(crew: Crew, hullId: string): boolean {
  return crew.assignment?.hullId === hullId
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function profMult(proficiency: number): number {
  return config.PROFICIENCY.multBase + config.PROFICIENCY.multPerPoint * proficiency
}

export function fatigueMult(fatigue: number): number {
  const { penaltyStart, penaltyDivisor } = config.FATIGUE
  if (fatigue > penaltyStart) return 1 - (fatigue - penaltyStart) / penaltyDivisor
  return 1
}

export function crewOutput(crew: Crew, stage: StageId, rush: boolean): number {
  const rushMult = rush ? config.ECONOMY.rushOutputMult : 1
  return crew.baseOutput * profMult(crew.proficiency[stage]) * fatigueMult(crew.fatigue) * rushMult
}

export function hullAssignedCrews(hull: Hull, crews: Crew[]): Crew[] {
  return crews.filter((c) => assignedToHull(c, hull.id) && !isWalkoff(c))
}

export function emptyCashflow(week: number) {
  return {
    advances: 0,
    deliveries: 0,
    net: 0,
    penalties: 0,
    rushPremium: 0,
    wages: 0,
    week,
  }
}

export function finalizeCashflow(cf: {
  advances: number
  deliveries: number
  penalties: number
  rushPremium: number
  wages: number
  week: number
}) {
  return {
    advances: cf.advances,
    deliveries: cf.deliveries,
    net: cf.deliveries + cf.advances - cf.wages - cf.rushPremium - cf.penalties,
    penalties: cf.penalties,
    rushPremium: cf.rushPremium,
    wages: cf.wages,
    week: cf.week,
  }
}
