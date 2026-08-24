import { useReducer } from 'react'
import { config } from './config'
import { defaultState, reducer } from './state/reducer'
import { EndScreen } from './ui/EndScreen'
import { GameScreen } from './ui/GameScreen'
import { StartScreen } from './ui/StartScreen'

function randomSeed(): string {
  return `yard-${Math.random().toString(36).slice(2, 8)}`
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, defaultState)

  if (state.screen === 'start') {
    return (
      <StartScreen
        seed={state.seed}
        onSeed={(seed) => dispatch({ type: 'SET_SEED', seed })}
        onStart={() => dispatch({ type: 'START_RUN', seed: state.seed || config.M0.defaultSeed })}
        onRandom={() => dispatch({ type: 'SET_SEED', seed: randomSeed() })}
      />
    )
  }

  if (state.screen === 'end' && state.run) {
    return (
      <EndScreen
        state={state.run}
        onRetry={() => dispatch({ type: 'RETRY_SEED' })}
        onNewSeed={() => dispatch({ type: 'NEW_SEED' })}
      />
    )
  }

  if (state.run) {
    return <GameScreen state={state.run} dispatch={dispatch} />
  }

  return (
    <StartScreen
      seed={state.seed}
      onSeed={(seed) => dispatch({ type: 'SET_SEED', seed })}
      onStart={() => dispatch({ type: 'START_RUN', seed: state.seed || config.M0.defaultSeed })}
      onRandom={() => dispatch({ type: 'SET_SEED', seed: randomSeed() })}
    />
  )
}
