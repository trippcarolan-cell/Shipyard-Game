import type { ShipClassId } from '../config'
import { STAGES } from '../config'

export type { ShipClassId }
export { STAGES }

export type StageId = (typeof STAGES)[number]

export type ScreenId = 'start' | 'game' | 'end'

export type EndReason = 'finished' | 'bankrupt' | null

export type CashBand = 'ok' | 'warning' | 'deep'

export interface Proficiency {
  cutting: number
  assembly: number
  erection: number
  outfitting: number
}

export interface CrewAssignment {
  hullId: string
  stage: StageId
}

export interface Crew {
  id: string
  name: string
  grade: 'green' | 'certified' | 'master'
  proficiency: Proficiency
  fatigue: number
  wage: number
  baseOutput: number
  assignment: CrewAssignment | null
  walkoffWeeksLeft: number
}

export interface Hull {
  id: string
  name: string
  classId: ShipClassId
  stage: StageId
  workInStage: number
  totalWorkDone: number
  deadlineWeek: number
  payment: number
  rush: boolean
  acceptedWeek: number
  complete: boolean
}

export interface ContractOffer {
  id: string
  classId: ShipClassId
  payment: number
  deadlineWeeks: number
  rush: boolean
  age: number
  slot: number
}

export interface Streams {
  contracts: number
  defects: number
  events: number
  seaTrials: number
  steelPrice: number
  walkoffs: number
}

export interface LogLine {
  id: number
  kind: 'badge' | 'halt' | 'info' | 'money' | 'warn'
  text: string
  week: number
}

export interface Badge {
  id: string
  kind: 'contract_expiring' | 'fatigue70'
  text: string
}

export type HaltReason =
  | { type: 'bankrupt'; message: string }
  | { type: 'cash_warning'; message: string }
  | { type: 'contract_expiring'; message: string; offerId: string }
  | { type: 'crews_idle'; message: string }
  | { type: 'hull_delivered'; hullId: string; message: string }
  | { type: 'projection_slip'; hullId: string; message: string }
  | { type: 'stage_complete'; hullId: string; message: string; stage: StageId }
  | { type: 'walkoff'; crewId: string; message: string }
  | { type: 'week_48'; message: string }

export interface Cashflow {
  advances: number
  deliveries: number
  net: number
  penalties: number
  rushPremium: number
  wages: number
  week: number
}

export interface GameState {
  badges: Badge[]
  berthOccupiedBy: string | null
  cash: number
  cashBand: CashBand
  crews: Crew[]
  endReason: EndReason
  ended: boolean
  haltReason: HaltReason | null
  haltReasons: HaltReason[]
  hulls: Hull[]
  hullsDelivered: number
  log: LogLine[]
  nextLogId: number
  nextOfferId: number
  nextHullId: number
  offers: ContractOffer[]
  seed: string
  streams: Streams
  week: number
  weekCashflow: Cashflow
  weeksLateTotal: number
}

export interface AppState {
  run: GameState | null
  screen: ScreenId
  seed: string
}

export type Action =
  | { type: 'ACCEPT_CONTRACT'; offerId: string }
  | { type: 'ASSIGN_CREW'; crewId: string; hullId: string; stage: StageId }
  | { type: 'CONTINUE' }
  | { type: 'NEW_SEED' }
  | { type: 'RETRY_SEED' }
  | { type: 'SET_SEED'; seed: string }
  | { type: 'START_RUN'; seed: string }
  | { type: 'STEP_WEEK' }
  | { type: 'TOGGLE_RUSH'; hullId: string }
  | { type: 'UNASSIGN_CREW'; crewId: string }

export const HALT_PRIORITY: HaltReason['type'][] = [
  'bankrupt',
  'week_48',
  'hull_delivered',
  'stage_complete',
  'crews_idle',
  'walkoff',
  'projection_slip',
  'contract_expiring',
  'cash_warning',
]
