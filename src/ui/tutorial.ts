import { isProducing } from '../sim/output'
import type { Action, GameState } from '../state/types'

export const TUTORIAL_STORAGE_KEY = 'drydock-tutorial-v1'

export type TutorialStepId = 'triage' | 'continue' | 'stage' | 'rush' | 'delivery' | 'done'

export type TutorialPersist = 'done' | 'skipped'

export type TutorialTargetId = 'bench' | 'continue' | 'projection' | 'rush' | 'board' | 'stages'

export type TutorialUiState = {
  active: boolean
  step: TutorialStepId
}

export const TUTORIAL_DONE_TOAST =
  'You have the loop. Fatigue, proficiency, and cash will punish autopilot.'

export const TUTORIAL_COPY: Record<
  Exclude<TutorialStepId, 'done'>,
  { title: string; body: string }
> = {
  triage: {
    title: 'WEEK 1 · TRIAGE',
    body: 'You inherited a Coastal Freighter already in assembly, 7 weeks to deadline, behind if nobody works. The berth is the scarce resource. Click each crew name on the bench to put them on Assembly.',
  },
  continue: {
    title: 'CONTINUE',
    body: 'Continue runs the yard until something needs you — a stage finishing, a delivery, cash going red. +1 week is there if you want to creep. The projected week assumes these crews follow the hull through later stages.',
  },
  stage: {
    title: 'STAGE COMPLETE',
    body: "Assembly is done. Crews go idle on purpose — last week's assignment is not automatically right. Click each name onto the next stage (Erection), or leave someone on the bench to rest fatigue.",
  },
  rush: {
    title: 'RUSH',
    body: 'Rush is +40% output and +60% wages. Fatigue climbs +18/week instead of +4. Above 70 you get a warning; above 85 they can walk off for 2 weeks. Use it to buy a deadline, not as a lifestyle.',
  },
  delivery: {
    title: 'BERTH FREE',
    body: '70% of the contract lands on delivery. Early is a 3% bonus per week; late is $40k/week. The berth sitting empty is dead money. Three offers on the right: 30% on signing. Take one before the oldest dies.',
  },
}

export function readTutorialPersist(): TutorialPersist | null {
  try {
    const value = localStorage.getItem(TUTORIAL_STORAGE_KEY)
    if (value === 'done' || value === 'skipped') return value
    return null
  } catch {
    return null
  }
}

export function writeTutorialPersist(value: TutorialPersist): void {
  try {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, value)
  } catch {
    // private mode / blocked storage — tutorial may repeat this session only
  }
}

export function clearTutorialPersist(): void {
  try {
    localStorage.removeItem(TUTORIAL_STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function allCrewsOnCurrentStage(run: GameState): boolean {
  const hull = run.hulls.find((h) => !h.complete)
  if (!hull) return false
  const available = run.crews.filter((c) => c.walkoffWeeksLeft === 0)
  if (available.length === 0) return false
  return available.every(
    (c) => c.assignment?.hullId === hull.id && c.assignment.stage === hull.stage,
  )
}

export function oneCrewProducing(run: GameState): boolean {
  return run.crews.some((c) => isProducing(c, run.hulls))
}

export function berthFreedThisRun(run: GameState): boolean {
  return (
    run.haltReason?.type === 'hull_delivered' ||
    (run.hullsDelivered >= 1 && run.hulls.length === 0)
  )
}

export function tutorialTargets(step: TutorialStepId): TutorialTargetId[] {
  switch (step) {
    case 'triage':
      return ['bench']
    case 'continue':
      return ['continue', 'projection']
    case 'stage':
      return ['bench', 'stages']
    case 'rush':
      return ['rush']
    case 'delivery':
      return ['board']
    case 'done':
      return []
  }
}

export function shouldShowTutorialCard(step: TutorialStepId, run: GameState): boolean {
  switch (step) {
    case 'triage':
    case 'continue':
      return true
    case 'stage':
      return run.haltReason?.type === 'stage_complete'
    case 'rush': {
      const hull = run.hulls[0]
      return Boolean(hull) && !hull.rush
    }
    case 'delivery':
      return berthFreedThisRun(run)
    case 'done':
      return true
  }
}

export function nextTutorialStep(
  step: TutorialStepId,
  run: GameState,
  action?: Action,
): TutorialStepId {
  if (step === 'done') return 'done'

  const delivered = berthFreedThisRun(run)

  if ((step === 'stage' || step === 'rush') && delivered) {
    return 'delivery'
  }

  switch (step) {
    case 'triage':
      return allCrewsOnCurrentStage(run) ? 'continue' : 'triage'
    case 'continue':
      if (action?.type === 'CONTINUE' || action?.type === 'STEP_WEEK') return 'stage'
      return 'continue'
    case 'stage':
      return oneCrewProducing(run) ? 'rush' : 'stage'
    case 'rush':
      if (
        action?.type === 'TOGGLE_RUSH' ||
        action?.type === 'CONTINUE' ||
        action?.type === 'STEP_WEEK'
      ) {
        return 'delivery'
      }
      if (run.hulls[0]?.rush) return 'delivery'
      return 'rush'
    case 'delivery':
      if (
        action?.type === 'ACCEPT_CONTRACT' ||
        action?.type === 'CONTINUE' ||
        action?.type === 'STEP_WEEK'
      ) {
        return 'done'
      }
      return 'delivery'
  }
}
