import { useReducer, useState } from 'react'
import { config } from './config'
import { defaultState, reducer } from './state/reducer'
import type { Action } from './state/types'
import { EndScreen } from './ui/EndScreen'
import { GameScreen } from './ui/GameScreen'
import { StartScreen } from './ui/StartScreen'
import { Tutorial } from './ui/Tutorial'
import {
  clearTutorialPersist,
  nextTutorialStep,
  readTutorialPersist,
  writeTutorialPersist,
  type TutorialStepId,
  type TutorialUiState,
} from './ui/tutorial'

function randomSeed(): string {
  return `yard-${Math.random().toString(36).slice(2, 8)}`
}

const TUTORIAL_IDLE: TutorialUiState = { active: false, step: 'triage' }

export default function App() {
  const [state, dispatch] = useReducer(reducer, defaultState)
  const [tutorial, setTutorial] = useState<TutorialUiState>(TUTORIAL_IDLE)

  const skipTutorial = () => {
    writeTutorialPersist('skipped')
    setTutorial(TUTORIAL_IDLE)
  }

  const applyStep = (step: TutorialStepId) => {
    if (step === 'done') writeTutorialPersist('done')
    setTutorial({ active: true, step })
  }

  const startTutorialIfNeeded = (force: boolean) => {
    if (force) {
      clearTutorialPersist()
      setTutorial({ active: true, step: 'triage' })
      return
    }
    if (readTutorialPersist()) setTutorial(TUTORIAL_IDLE)
    else setTutorial({ active: true, step: 'triage' })
  }

  const wrappedDispatch = (action: Action) => {
    const nextApp = reducer(state, action)
    dispatch(action)
    if (!tutorial.active || tutorial.step === 'done') return
    if (!nextApp.run) return
    const nextStep = nextTutorialStep(tutorial.step, nextApp.run, action)
    if (nextStep !== tutorial.step) applyStep(nextStep)
  }

  const startScreen = (
    <StartScreen
      seed={state.seed}
      onSeed={(seed) => dispatch({ type: 'SET_SEED', seed })}
      onStart={() => {
        startTutorialIfNeeded(false)
        dispatch({ type: 'START_RUN', seed: state.seed || config.M0.defaultSeed })
      }}
      onRandom={() => dispatch({ type: 'SET_SEED', seed: randomSeed() })}
      onReplayBriefing={() => {
        startTutorialIfNeeded(true)
        dispatch({ type: 'START_RUN', seed: config.M0.defaultSeed })
      }}
    />
  )

  if (state.screen === 'start') return startScreen

  if (state.screen === 'end' && state.run) {
    return (
      <EndScreen
        state={state.run}
        onRetry={() => {
          startTutorialIfNeeded(false)
          dispatch({ type: 'RETRY_SEED' })
        }}
        onNewSeed={() => dispatch({ type: 'NEW_SEED' })}
      />
    )
  }

  if (state.run) {
    return (
      <>
        <GameScreen state={state.run} dispatch={wrappedDispatch} />
        {tutorial.active && (
          <Tutorial
            step={tutorial.step}
            run={state.run}
            onSkip={skipTutorial}
            onGotIt={() => {
              if (tutorial.step === 'rush') applyStep('delivery')
            }}
            onDoneShown={() => setTutorial(TUTORIAL_IDLE)}
          />
        )}
      </>
    )
  }

  return startScreen
}
