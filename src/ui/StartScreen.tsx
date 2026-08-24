import { config } from '../config'

export function StartScreen({
  seed,
  onSeed,
  onStart,
  onRandom,
}: {
  seed: string
  onSeed: (s: string) => void
  onStart: () => void
  onRandom: () => void
}) {
  return (
    <div className="flex min-h-full flex-col items-stretch justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-xl border border-steel-700 bg-steel-800/80 p-8 shadow-[inset_0_1px_0_rgba(196,192,180,0.08)]">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-steel-500">
          Shipyard ledger · M0
        </div>
        <h1 className="mb-2 text-6xl font-bold tracking-tight text-steel-300">DRYDOCK</h1>
        <p className="mb-8 max-w-md text-sm leading-relaxed text-steel-400">
          One berth. Forty-eight weeks. Coastal Freighters. You are interrupted only at hard
          stops — stage complete, delivery, walk-off, a projection that slips late, a contract
          about to die while the berth is empty, or cash going red.
        </p>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.2em] text-steel-500">
          Run seed
        </label>
        <div className="mb-6 flex gap-2">
          <input
            value={seed}
            onChange={(e) => onSeed(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onStart()
            }}
            className="min-w-0 flex-1 border border-steel-700 bg-steel-900 px-3 py-2 font-ledger text-base text-steel-300 outline-none focus:border-oxide"
            spellCheck={false}
            autoComplete="off"
          />
          <button
            type="button"
            onClick={onRandom}
            className="border border-steel-700 bg-steel-900 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-steel-400 hover:border-steel-400 hover:text-steel-300"
          >
            Random seed
          </button>
        </div>
        <button
          type="button"
          onClick={onStart}
          className="w-full bg-oxide px-4 py-3 text-sm font-bold uppercase tracking-[0.2em] text-steel-300 hover:brightness-110"
        >
          Start Run
        </button>
        <div className="mt-6 border-t border-steel-700 pt-4 text-[11px] uppercase tracking-wider text-steel-500">
          Default seed {config.M0.defaultSeed} · {config.TIME.weeksPerRun} weeks · starting cash{' '}
          {config.ECONOMY.m0StartCash.toLocaleString()}
        </div>
      </div>
    </div>
  )
}
