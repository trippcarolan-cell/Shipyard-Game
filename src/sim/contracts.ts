import { config } from '../config'
import type { ContractOffer, GameState } from '../state/types'
import { nextFloat, nextUniform } from './prng'

export function generateOffer(state: GameState, slot: number): ContractOffer {
  const ship = config.SHIPS.coastalFreighter
  let st = state.streams.contracts

  const payRoll = nextUniform(st, config.CONTRACTS.paymentMin, config.CONTRACTS.paymentMax)
  st = payRoll.state
  let payment = Math.round(ship.basePayment * payRoll.value)

  const dlRoll = nextUniform(st, config.CONTRACTS.deadlineMin, config.CONTRACTS.deadlineMax)
  st = dlRoll.state
  let deadlineWeeks = Math.round(config.CONTRACTS.deadlineBase * dlRoll.value)

  const rushRoll = nextFloat(st)
  st = rushRoll.state
  const rush = rushRoll.value < config.CONTRACTS.rushChance
  if (rush) {
    deadlineWeeks = Math.round(deadlineWeeks * config.CONTRACTS.rushDeadlineMult)
    payment = Math.round(payment * config.CONTRACTS.rushPaymentMult)
  }

  deadlineWeeks = Math.max(config.CONTRACTS.minDeadlineWeeks, deadlineWeeks)
  state.streams.contracts = st

  const id = `offer-${state.nextOfferId}`
  state.nextOfferId += 1
  return {
    age: 0,
    classId: 'coastalFreighter',
    deadlineWeeks,
    id,
    payment,
    rush,
    slot,
  }
}
