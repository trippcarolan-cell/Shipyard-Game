import { config, STAGES } from '../config'
import type {
  Badge,
  Crew,
  GameState,
  HaltReason,
  Hull,
  LogLine,
} from '../state/types'
import { HALT_PRIORITY } from '../state/types'
import { generateOffer } from './contracts'
import {
  clamp,
  crewOutput,
  emptyCashflow,
  finalizeCashflow,
  hullById,
  isOverflow,
  isProducing,
  isWalkoff,
  nextStage,
  stageLabel,
  stageWork,
} from './output'
import { projectHull, snapshotProjections } from './projection'
import { nextFloat } from './prng'

function pushLog(state: GameState, kind: LogLine['kind'], text: string): void {
  const line: LogLine = {
    id: state.nextLogId,
    kind,
    text,
    week: state.week,
  }
  state.nextLogId += 1
  state.log = [line, ...state.log]
}

function pushHalt(state: GameState, reason: HaltReason): void {
  state.haltReasons = [...state.haltReasons, reason]
}

function pushBadge(state: GameState, badge: Badge): void {
  state.badges = [...state.badges, badge]
}

function pickHalt(reasons: HaltReason[]): HaltReason | null {
  if (reasons.length === 0) return null
  const ranked = [...reasons].sort(
    (a, b) => HALT_PRIORITY.indexOf(a.type) - HALT_PRIORITY.indexOf(b.type),
  )
  return ranked[0] ?? null
}

function unassignHullCrews(state: GameState, hullId: string): void {
  for (const crew of state.crews) {
    if (crew.assignment?.hullId === hullId) crew.assignment = null
  }
}

function stepSteel(_state: GameState): void {
  // M0 no-op
}

function stepWages(state: GameState): void {
  for (const crew of state.crews) {
    if (isWalkoff(crew)) continue
    const base = crew.wage
    let premium = 0
    if (isProducing(crew, state.hulls) && crew.assignment) {
      const hull = hullById(state.hulls, crew.assignment.hullId)
      if (hull?.rush) premium = Math.round(base * config.ECONOMY.rushWagePremium)
    }
    const total = base + premium
    state.cash -= total
    state.weekCashflow.wages += base
    state.weekCashflow.rushPremium += premium
  }
}

function stepWork(state: GameState): void {
  for (const hull of state.hulls) {
    if (hull.complete) continue
    let raw = 0
    for (const crew of state.crews) {
      if (!isProducing(crew, state.hulls) || crew.assignment?.hullId !== hull.id) continue
      raw += crewOutput(crew, hull.stage, hull.rush)
    }
    const req = stageWork(hull.classId, hull.stage)
    const applied = Math.min(raw, req - hull.workInStage)
    hull.workInStage += applied
    hull.totalWorkDone += applied
  }
}

function stepProfFatigue(state: GameState, walkedThisWeek: Set<string>): void {
  for (const crew of state.crews) {
    if (isWalkoff(crew)) continue
    const producing = isProducing(crew, state.hulls)
    const overflow = isOverflow(crew, state.hulls)

    if (producing && crew.assignment) {
      const hull = hullById(state.hulls, crew.assignment.hullId)
      const stage = crew.assignment.stage
      for (const s of STAGES) {
        if (s === stage) {
          crew.proficiency[s] = clamp(
            crew.proficiency[s] + config.PROFICIENCY.producingGain,
            config.PROFICIENCY.min,
            config.PROFICIENCY.max,
          )
        } else {
          crew.proficiency[s] = clamp(
            crew.proficiency[s] - config.PROFICIENCY.otherDecay,
            config.PROFICIENCY.min,
            config.PROFICIENCY.max,
          )
        }
      }
      const before = crew.fatigue
      const delta = hull?.rush ? config.FATIGUE.rush : config.FATIGUE.producing
      crew.fatigue = clamp(crew.fatigue + delta, config.FATIGUE.min, config.FATIGUE.max)
      if (before < config.TRIGGERS.fatigueBadge && crew.fatigue >= config.TRIGGERS.fatigueBadge) {
        pushBadge(state, {
          id: `fatigue70-${crew.id}-${state.week}`,
          kind: 'fatigue70',
          text: `${crew.name} fatigue ${Math.round(crew.fatigue)}`,
        })
        pushLog(state, 'badge', `${crew.name} crossed fatigue ${config.TRIGGERS.fatigueBadge}.`)
      }
      if (crew.fatigue > config.TRIGGERS.fatigueWalkoff) {
        const roll = nextFloat(state.streams.walkoffs)
        state.streams.walkoffs = roll.state
        if (roll.value < config.TRIGGERS.walkoffChance) {
          crew.assignment = null
          crew.walkoffWeeksLeft = config.TRIGGERS.walkoffWeeks
          walkedThisWeek.add(crew.id)
          const message = `${crew.name} walked off for ${config.TRIGGERS.walkoffWeeks} weeks.`
          pushHalt(state, { type: 'walkoff', crewId: crew.id, message })
          pushLog(state, 'halt', message)
        }
      }
    } else if (!overflow && !crew.assignment) {
      crew.fatigue = clamp(crew.fatigue + config.FATIGUE.rest, config.FATIGUE.min, config.FATIGUE.max)
    }
  }
}

function stepDefects(_state: GameState): void {
  // M0 no-op
}

function stepStages(state: GameState): void {
  for (const hull of state.hulls) {
    if (hull.complete) continue
    const req = stageWork(hull.classId, hull.stage)
    if (hull.workInStage < req) continue
    if (hull.stage === 'outfitting') {
      hull.complete = true
      hull.workInStage = req
      continue
    }
    const finished = hull.stage
    const nxt = nextStage(hull.stage)
    if (!nxt) {
      hull.complete = true
      continue
    }
    hull.stage = nxt
    hull.workInStage = 0
    unassignHullCrews(state, hull.id)
    const message = `${stageLabel(finished)} complete on ${hull.name} — crews idle`
    pushHalt(state, {
      type: 'stage_complete',
      hullId: hull.id,
      message,
      stage: finished,
    })
    pushLog(state, 'halt', message)
  }
}

function stepDeliver(state: GameState): void {
  const remaining: Hull[] = []
  for (const hull of state.hulls) {
    if (!hull.complete) {
      remaining.push(hull)
      continue
    }
    const delivery = hull.payment * config.ECONOMY.deliveryPercent
    const weeksEarly = hull.deadlineWeek - state.week
    const bonus =
      weeksEarly > 0 ? hull.payment * config.ECONOMY.earlyBonusPerWeek * weeksEarly : 0
    const payout = delivery + bonus
    state.cash += payout
    state.weekCashflow.deliveries += payout
    state.hullsDelivered += 1
    if (state.week > hull.deadlineWeek) {
      state.weeksLateTotal += state.week - hull.deadlineWeek
    }
    if (state.berthOccupiedBy === hull.id) state.berthOccupiedBy = null
    unassignHullCrews(state, hull.id)
    const earlyBit =
      weeksEarly > 0 ? ` ${weeksEarly}w early (+${Math.round(bonus)}).` : ''
    const message = `${hull.name} delivered.${earlyBit} Berth free.`
    pushHalt(state, { type: 'hull_delivered', hullId: hull.id, message })
    pushLog(state, 'money', message)
  }
  state.hulls = remaining
}

function stepLate(state: GameState): void {
  for (const hull of state.hulls) {
    if (hull.complete) continue
    if (state.week > hull.deadlineWeek) {
      const penalty = config.ECONOMY.latePenaltyPerWeek
      state.cash -= penalty
      state.weekCashflow.penalties += penalty
      pushLog(
        state,
        'warn',
        `${hull.name} overdue — ${penalty} late penalty.`,
      )
    }
  }
}

function stepEvents(_state: GameState): void {
  // M0 no-op
}

function berthFree(state: GameState): boolean {
  return state.hulls.length === 0 || state.berthOccupiedBy === null
}

function cashBandOf(cash: number): GameState['cashBand'] {
  if (cash < config.TRIGGERS.cashWarningDeep) return 'deep'
  if (cash < config.TRIGGERS.cashWarning) return 'warning'
  return 'ok'
}

const CASH_BAND_RANK: Record<GameState['cashBand'], number> = {
  ok: 0,
  warning: 1,
  deep: 2,
}

function stepContracts(state: GameState): void {
  for (const offer of state.offers) offer.age += 1

  const maxAge = config.CONTRACTS.maxAge
  const free = berthFree(state)

  for (const offer of state.offers) {
    if (offer.age !== maxAge - 1) continue
    const shipName = config.SHIPS[offer.classId].name
    if (free) {
      const message = `${shipName} offer expiring. Berth is free — take a new job.`
      pushHalt(state, { type: 'contract_expiring', offerId: offer.id, message })
      pushLog(state, 'halt', message)
    } else {
      pushBadge(state, {
        id: `contract-exp-${offer.id}-${state.week}`,
        kind: 'contract_expiring',
        text: 'Offer expiring',
      })
      pushLog(state, 'badge', `${shipName} offer in final week (berth busy).`)
    }
  }

  const occupied = new Set(state.offers.map((o) => o.slot))
  const holes: number[] = []
  for (let slot = 0; slot < config.CONTRACTS.offerSlots; slot++) {
    if (!occupied.has(slot)) holes.push(slot)
  }

  const expired = state.offers.filter((o) => o.age >= maxAge)

  if (holes.length > 0) {
    const fresh = generateOffer(state, holes[0]!)
    state.offers = [...state.offers, fresh].sort((a, b) => a.slot - b.slot)
    return
  }

  if (expired.length === 0) return

  let oldest = expired[0]!
  for (const offer of expired) {
    if (offer.age > oldest.age || (offer.age === oldest.age && offer.id < oldest.id)) {
      oldest = offer
    }
  }
  const slot = oldest.slot
  state.offers = state.offers.filter((o) => o.id !== oldest.id)
  const fresh = generateOffer(state, slot)
  state.offers = [...state.offers, fresh].sort((a, b) => a.slot - b.slot)
}

function stepCash(state: GameState): void {
  if (state.cash < config.TRIGGERS.cashBankrupt) {
    state.ended = true
    state.endReason = 'bankrupt'
    state.cashBand = 'deep'
    const message = 'Bankrupt. The yard is shuttered.'
    pushHalt(state, { type: 'bankrupt', message })
    pushLog(state, 'halt', message)
    return
  }
  const prev = state.cashBand
  const next = cashBandOf(state.cash)
  if (CASH_BAND_RANK[next] > CASH_BAND_RANK[prev]) {
    const message = `Cash warning: ${state.cash}.`
    pushHalt(state, { type: 'cash_warning', message })
    pushLog(state, 'warn', message)
  }
  state.cashBand = next
}

function stepProjectionSlip(state: GameState, before: Record<string, number | null>): void {
  for (const hull of state.hulls) {
    if (hull.complete) continue
    const producing = state.crews.some(
      (c) => isProducing(c, state.hulls) && c.assignment?.hullId === hull.id,
    )
    if (!producing) continue
    const prev = before[hull.id]
    const next = projectHull(state, hull)
    if (next === null) continue
    const wasOk = prev === null || prev === undefined || prev <= hull.deadlineWeek
    const nowLate = next > hull.deadlineWeek
    if (wasOk && nowLate) {
      const message = `${hull.name} now projects late (wk ${next} vs deadline ${hull.deadlineWeek}).`
      pushHalt(state, { type: 'projection_slip', hullId: hull.id, message })
      pushLog(state, 'halt', message)
    }
  }
}

export function tickWeek(state: GameState): GameState {
  const s: GameState = structuredClone(state)
  s.haltReason = null
  s.haltReasons = []
  s.badges = []
  s.weekCashflow = emptyCashflow(s.week)

  const walkedThisWeek = new Set<string>()
  const before = snapshotProjections(s)

  stepSteel(s)
  stepWages(s)
  stepWork(s)
  stepProfFatigue(s, walkedThisWeek)
  stepDefects(s)
  stepStages(s)
  stepDeliver(s)
  stepLate(s)
  stepEvents(s)
  stepContracts(s)
  stepCash(s)
  stepProjectionSlip(s, before)

  for (const crew of s.crews) {
    if (crew.walkoffWeeksLeft > 0 && !walkedThisWeek.has(crew.id)) {
      crew.walkoffWeeksLeft -= 1
    }
  }

  s.week += 1
  if (!s.ended && s.week > config.TIME.weeksPerRun) {
    s.ended = true
    s.endReason = 'finished'
    const message = `Week ${config.TIME.weeksPerRun} complete. Year closed.`
    pushHalt(s, { type: 'week_48', message })
    pushLog(s, 'halt', message)
  }

  s.weekCashflow = finalizeCashflow(s.weekCashflow)
  s.haltReason = pickHalt(s.haltReasons)
  return s
}

export function addLog(state: GameState, kind: LogLine['kind'], text: string, week?: number): GameState {
  const s = structuredClone(state)
  const line: LogLine = {
    id: s.nextLogId,
    kind,
    text,
    week: week ?? s.week,
  }
  s.nextLogId += 1
  s.log = [line, ...s.log]
  return s
}

export function insertLogAfterNew(
  next: GameState,
  prevLogLength: number,
  kind: LogLine['kind'],
  text: string,
  week: number,
): GameState {
  const s = structuredClone(next)
  const line: LogLine = {
    id: s.nextLogId,
    kind,
    text,
    week,
  }
  s.nextLogId += 1
  const newCount = Math.max(0, s.log.length - prevLogLength)
  s.log = [...s.log.slice(0, newCount), line, ...s.log.slice(newCount)]
  return s
}

export function applyAssign(state: GameState, crewId: string, hullId: string, stage: Hull['stage']): GameState {
  const s = structuredClone(state)
  const crew = s.crews.find((c) => c.id === crewId)
  const hull = hullById(s.hulls, hullId)
  if (!crew || !hull || isWalkoff(crew) || hull.complete) return s
  crew.assignment = { hullId, stage }
  return addLog(s, 'info', `${crew.name} assigned to ${hull.name} ${stage}.`)
}

export function applyUnassign(state: GameState, crewId: string): GameState {
  const s = structuredClone(state)
  const crew = s.crews.find((c) => c.id === crewId)
  if (!crew || !crew.assignment) return s
  const hull = hullById(s.hulls, crew.assignment.hullId)
  crew.assignment = null
  return addLog(s, 'info', `${crew.name} unassigned${hull ? ` from ${hull.name}` : ''}.`)
}

export function applyToggleRush(state: GameState, hullId: string): GameState {
  const s = structuredClone(state)
  const hull = hullById(s.hulls, hullId)
  if (!hull) return s
  hull.rush = !hull.rush
  return addLog(s, 'info', `${hull.name} rush ${hull.rush ? 'ON' : 'OFF'}.`)
}

export function applyAccept(state: GameState, offerId: string): GameState {
  const s = structuredClone(state)
  if (s.berthOccupiedBy || s.hulls.length > 0) return s
  const offer = s.offers.find((o) => o.id === offerId)
  if (!offer) return s
  const advance = offer.payment * config.ECONOMY.advancePercent
  s.cash += advance
  s.weekCashflow = {
    ...s.weekCashflow,
    advances: s.weekCashflow.advances + advance,
    net: s.weekCashflow.net + advance,
  }
  const hullId = `hull-${s.nextHullId}`
  s.nextHullId += 1
  const hull: Hull = {
    acceptedWeek: s.week,
    classId: offer.classId,
    complete: false,
    deadlineWeek: s.week + offer.deadlineWeeks,
    id: hullId,
    name: `Hull ${s.nextHullId - 1}`,
    payment: offer.payment,
    rush: offer.rush,
    stage: 'cutting',
    totalWorkDone: 0,
    workInStage: 0,
  }
  s.hulls = [hull]
  s.berthOccupiedBy = hullId
  s.offers = s.offers.filter((o) => o.id !== offerId)
  s.cashBand = cashBandOf(s.cash)
  const shipName = config.SHIPS[offer.classId].name
  const rushBit = offer.rush ? ' RUSH' : ''
  return addLog(
    s,
    'money',
    `Accepted ${shipName}${rushBit} as ${hull.name}. Advance ${Math.round(advance)}. Deadline week ${hull.deadlineWeek}.`,
  )
}

export function compactSkippedText(weeks: number[]): string {
  if (weeks.length === 0) return ''
  if (weeks.length === 1) return `Week ${weeks[0]} simulated.`
  return `Weeks ${weeks[0]}–${weeks[weeks.length - 1]} simulated.`
}

export type { Crew }
