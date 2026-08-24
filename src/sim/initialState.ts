import { config } from '../config'
import type { Cashflow, Crew, GameState, Hull } from '../state/types'
import { generateOffer } from './contracts'
import { emptyCashflow, emptyProficiency } from './output'
import { makeStreams } from './prng'

function startingCrews(): Crew[] {
  const grade = config.CREWS.grades[config.CREWS.m0Grade]
  return config.CREWS.m0StartingCrews.map((c) => ({
    assignment: null,
    baseOutput: grade.baseOutput,
    fatigue: 0,
    grade: config.CREWS.m0Grade,
    id: c.id,
    name: c.name,
    proficiency: emptyProficiency(grade.proficiency),
    wage: grade.wage,
    walkoffWeeksLeft: 0,
  }))
}

function inheritedHull(): Hull {
  const src = config.M0.inheritedHull
  return {
    acceptedWeek: src.acceptedWeek,
    classId: src.classId,
    complete: false,
    deadlineWeek: src.deadlineWeek,
    id: src.id,
    name: src.name,
    payment: src.payment,
    rush: src.rush,
    stage: src.stage,
    totalWorkDone: src.totalWorkDone,
    workInStage: src.workInStage,
  }
}

export function createInitialState(seed: string): GameState {
  const cashflow: Cashflow = emptyCashflow(config.TIME.startWeek)
  const state: GameState = {
    badges: [],
    berthOccupiedBy: config.M0.inheritedHull.id,
    cash: config.ECONOMY.m0StartCash,
    cashBand: 'ok',
    crews: startingCrews(),
    endReason: null,
    ended: false,
    haltReason: null,
    haltReasons: [],
    hulls: [inheritedHull()],
    hullsDelivered: 0,
    log: [],
    nextHullId: 2,
    nextLogId: 1,
    nextOfferId: 1,
    offers: [],
    seed,
    streams: makeStreams(seed),
    week: config.TIME.startWeek,
    weekCashflow: cashflow,
    weeksLateTotal: 0,
  }

  const offers = []
  for (let slot = 0; slot < config.CONTRACTS.offerSlots; slot++) {
    const offer = generateOffer(state, slot)
    offer.age = slot
    offers.push(offer)
  }
  state.offers = offers

  state.log = [
    {
      id: 2,
      kind: 'info',
      text: 'Week 1 triage — crews unassigned. Inherited hull in assembly.',
      week: 1,
    },
    {
      id: 1,
      kind: 'info',
      text: 'Inherited Coastal Freighter occupies the berth. Assembly 40/140. Deadline week 8. 30% already received.',
      week: 1,
    },
  ]
  state.nextLogId = 3
  return state
}
