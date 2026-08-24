import { describe, expect, it } from 'vitest'
import { createInitialState } from '../sim/initialState'
import { reducer } from '../state/reducer'
import type { GameState } from '../state/types'
import {
  allCrewsOnCurrentStage,
  berthFreedThisRun,
  nextTutorialStep,
  oneCrewProducing,
  shouldShowTutorialCard,
  tutorialTargets,
} from './tutorial'

const CREW_IDS = ['alden', 'briggs', 'cho', 'dunn'] as const

function assignAll(run: GameState, stage: GameState['hulls'][0]['stage']): GameState {
  const hullId = run.hulls[0]!.id
  let app = { run, screen: 'game' as const, seed: run.seed }
  for (const crewId of CREW_IDS) {
    app = reducer(app, { type: 'ASSIGN_CREW', crewId, hullId, stage })
  }
  return app.run!
}

function assignCurrent(run: GameState): GameState {
  const hull = run.hulls[0]
  if (!hull) return run
  let app = { run, screen: 'game' as const, seed: run.seed }
  for (const crew of run.crews) {
    if (crew.walkoffWeeksLeft > 0) continue
    app = reducer(app, { type: 'ASSIGN_CREW', crewId: crew.id, hullId: hull.id, stage: hull.stage })
  }
  return app.run!
}

describe('tutorial step machine', () => {
  it('stays on triage until all four crews are on the current stage', () => {
    const run = createInitialState('drydock-m0')
    expect(allCrewsOnCurrentStage(run)).toBe(false)
    expect(nextTutorialStep('triage', run)).toBe('triage')
    expect(shouldShowTutorialCard('triage', run)).toBe(true)
    expect(tutorialTargets('triage')).toEqual(['bench'])

    const one = reducer(
      { run, screen: 'game', seed: run.seed },
      { type: 'ASSIGN_CREW', crewId: 'alden', hullId: 'hull-1', stage: 'assembly' },
    ).run!
    expect(nextTutorialStep('triage', one)).toBe('triage')
  })

  it('advances triage → continue when all crews are assigned to assembly', () => {
    const run = assignAll(createInitialState('drydock-m0'), 'assembly')
    expect(allCrewsOnCurrentStage(run)).toBe(true)
    expect(nextTutorialStep('triage', run)).toBe('continue')
    expect(shouldShowTutorialCard('continue', run)).toBe(true)
    expect(tutorialTargets('continue')).toEqual(['continue', 'projection'])
  })

  it('continue only advances on Continue or +1 week, not on rush toggle', () => {
    const run = assignAll(createInitialState('drydock-m0'), 'assembly')
    expect(nextTutorialStep('continue', run)).toBe('continue')
    const rushed = reducer(
      { run, screen: 'game', seed: run.seed },
      { type: 'TOGGLE_RUSH', hullId: 'hull-1' },
    ).run!
    expect(nextTutorialStep('continue', rushed, { type: 'TOGGLE_RUSH', hullId: 'hull-1' })).toBe(
      'continue',
    )
    expect(nextTutorialStep('continue', run, { type: 'CONTINUE' })).toBe('stage')
    expect(nextTutorialStep('continue', run, { type: 'STEP_WEEK' })).toBe('stage')
  })

  it('stage card only shows on stage_complete and advances when a crew produces', () => {
    let app = { run: createInitialState('drydock-m0'), screen: 'game' as const, seed: 'drydock-m0' }
    app = { ...app, run: assignAll(app.run!, 'assembly') }
    app = reducer(app, { type: 'CONTINUE' })
    const halted = app.run!
    expect(halted.haltReason?.type).toBe('stage_complete')
    expect(shouldShowTutorialCard('stage', halted)).toBe(true)
    expect(oneCrewProducing(halted)).toBe(false)
    expect(nextTutorialStep('stage', halted)).toBe('stage')

    const producing = assignCurrent(halted)
    expect(oneCrewProducing(producing)).toBe(true)
    expect(nextTutorialStep('stage', producing)).toBe('rush')
    expect(shouldShowTutorialCard('rush', producing)).toBe(true)
    expect(tutorialTargets('rush')).toEqual(['rush'])
  })

  it('rush dismisses on toggle or continue and skips to delivery if the hull is gone', () => {
    const run = assignAll(createInitialState('drydock-m0'), 'assembly')
    expect(nextTutorialStep('rush', run, { type: 'TOGGLE_RUSH', hullId: 'hull-1' })).toBe('delivery')
    expect(nextTutorialStep('rush', run, { type: 'CONTINUE' })).toBe('delivery')
    expect(nextTutorialStep('rush', run, { type: 'STEP_WEEK' })).toBe('delivery')

    const delivered: GameState = {
      ...run,
      hulls: [],
      hullsDelivered: 1,
      berthOccupiedBy: null,
      haltReason: { type: 'hull_delivered', hullId: 'hull-1', message: 'delivered' },
    }
    expect(berthFreedThisRun(delivered)).toBe(true)
    expect(nextTutorialStep('rush', delivered)).toBe('delivery')
    expect(nextTutorialStep('stage', delivered)).toBe('delivery')
    expect(shouldShowTutorialCard('delivery', delivered)).toBe(true)
    expect(tutorialTargets('delivery')).toEqual(['board'])
  })

  it('delivery completes on accept or continue', () => {
    const delivered: GameState = {
      ...createInitialState('drydock-m0'),
      hulls: [],
      hullsDelivered: 1,
      berthOccupiedBy: null,
      haltReason: { type: 'hull_delivered', hullId: 'hull-1', message: 'delivered' },
    }
    expect(nextTutorialStep('delivery', delivered)).toBe('delivery')
    expect(nextTutorialStep('delivery', delivered, { type: 'CONTINUE' })).toBe('done')
    expect(nextTutorialStep('delivery', delivered, { type: 'ACCEPT_CONTRACT', offerId: 'x' })).toBe(
      'done',
    )
    expect(nextTutorialStep('done', delivered)).toBe('done')
  })
})
