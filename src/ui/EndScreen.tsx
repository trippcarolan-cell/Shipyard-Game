import { config } from '../config'
import type { GameState } from '../state/types'
import { formatMoney } from './format'

export function EndScreen({
  state,
  onRetry,
  onNewSeed,
}: {
  state: GameState
  onRetry: () => void
  onNewSeed: () => void
}) {
  const bankrupt = state.endReason === 'bankrupt'
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg border border-steel-700 bg-steel-800 p-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-steel-500">
          Year closed · seed {state.seed}
        </div>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-steel-300">
          {bankrupt ? 'BANKRUPT' : 'FINISHED'}
        </h1>
        <p className="mt-2 text-sm text-steel-400">
          {bankrupt
            ? 'Cash fell below the shutter line. The yard is dark.'
            : `Week ${config.TIME.weeksPerRun} is on the books. The year is done.`}
        </p>
        <dl className="mt-6 grid grid-cols-2 gap-px bg-steel-700">
          <Stat label="Cash" value={formatMoney(state.cash)} />
          <Stat label="Hulls delivered" value={String(state.hullsDelivered)} />
          <Stat label="Weeks late (total)" value={String(state.weeksLateTotal)} />
          <Stat label="Week" value={`${Math.min(state.week, config.TIME.weeksPerRun)}`} />
        </dl>
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="flex-1 bg-oxide px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-steel-300 hover:brightness-110"
          >
            Run this year again
          </button>
          <button
            type="button"
            onClick={onNewSeed}
            className="flex-1 border border-steel-700 px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-steel-400 hover:border-steel-400"
          >
            New seed
          </button>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-steel-800 px-3 py-3">
      <div className="text-[10px] uppercase tracking-wider text-steel-500">{label}</div>
      <div className="text-xl font-semibold text-steel-300">{value}</div>
    </div>
  )
}
