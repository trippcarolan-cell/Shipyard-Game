import { useEffect } from 'react'
import { config, STAGES } from '../config'
import type { Action, Crew, GameState, Hull, StageId } from '../state/types'
import {
  canAccept,
  canContinue,
  currentHull,
  occupancyPct,
  stageProgress,
  statusLine,
  weeksToDeadline,
} from '../state/selectors'
import { hullAssignedCrews, isOverflow, isProducing, isWalkoff, stageLabel, stageWork } from '../sim/output'
import { projectHull } from '../sim/projection'
import { deadlineTone, formatMoney, formatSignedMoney, formatWeek } from './format'

function FatigueBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value))
  const color =
    pct > 85 ? 'bg-oxide' : pct >= 70 ? 'bg-amberurg' : 'bg-steel-500'
  return (
    <div className="h-1.5 w-full bg-steel-900">
      <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function ProfPips({ crew, stage }: { crew: Crew; stage?: StageId }) {
  return (
    <div className="flex gap-0.5">
      {STAGES.map((s) => {
        const v = crew.proficiency[s]
        const current = s === stage
        return (
          <div
            key={s}
            title={`${s} ${Math.round(v)}`}
            className={`h-3 w-1.5 ${current ? 'ring-1 ring-oxide' : 'ring-0'} bg-steel-900`}
          >
            <div
              className={`w-full ${current ? 'bg-oxide' : 'bg-steel-400'}`}
              style={{ height: `${Math.max(8, v)}%`, marginTop: `${100 - Math.max(8, v)}%` }}
            />
          </div>
        )
      })}
    </div>
  )
}

function CrewRow({
  crew,
  hull,
  onAssign,
  onUnassign,
}: {
  crew: Crew
  hull: Hull | undefined
  onAssign: (crewId: string, stage: StageId) => void
  onUnassign: (crewId: string) => void
}) {
  const producing = hull ? isProducing(crew, [hull]) : false
  const overflow = hull ? isOverflow(crew, [hull]) : false
  const walk = isWalkoff(crew)

  return (
    <div className="border-b border-steel-700 py-1.5 last:border-b-0">
      <button
        type="button"
        disabled={walk || !hull}
        onClick={() => {
          if (walk || !hull) return
          if (crew.assignment) onUnassign(crew.id)
          else onAssign(crew.id, hull.stage)
        }}
        className="flex w-full items-center gap-2 text-left disabled:opacity-50"
      >
        <span className="w-16 font-semibold text-steel-300">{crew.name}</span>
        <ProfPips crew={crew} stage={crew.assignment?.stage ?? hull?.stage} />
        <div className="min-w-0 flex-1">
          <FatigueBar value={crew.fatigue} />
        </div>
        <span className="w-24 text-right text-[11px] uppercase tracking-wide text-steel-500">
          {walk
            ? `Walkoff ${crew.walkoffWeeksLeft}w`
            : producing
              ? 'producing'
              : overflow
                ? 'overflow'
                : 'resting'}
        </span>
      </button>
      {hull && !walk && (
        <div className="mt-1 flex flex-wrap gap-1">
          {STAGES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onAssign(crew.id, s)
              }}
              className={`border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
                crew.assignment?.stage === s
                  ? 'border-oxide bg-oxide/20 text-oxide'
                  : s === hull.stage
                    ? 'border-oxide text-oxide'
                    : 'border-steel-700 text-steel-400 hover:border-steel-400'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function HullCard({
  state,
  hull,
  dispatch,
}: {
  state: GameState
  hull: Hull
  dispatch: (a: Action) => void
}) {
  const segs = stageProgress(hull)
  const left = weeksToDeadline(state, hull)
  const tone = deadlineTone(left)
  const proj = projectHull(state, hull)
  const assigned = hullAssignedCrews(hull, state.crews)
  const req = stageWork(hull.classId, hull.stage)

  return (
    <div className="border border-steel-700 bg-steel-800">
      <div className="flex items-baseline justify-between border-b border-steel-700 px-3 py-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-steel-500">
            {hull.name}
          </div>
          <div className="text-lg font-semibold text-steel-300">{config.SHIPS[hull.classId].name}</div>
        </div>
        <button
          type="button"
          onClick={() => dispatch({ type: 'TOGGLE_RUSH', hullId: hull.id })}
          className={`border px-2 py-1 text-[11px] font-bold uppercase tracking-widest ${
            hull.rush ? 'border-oxide bg-oxide text-steel-300' : 'border-steel-700 text-steel-500'
          }`}
        >
          Rush {hull.rush ? 'ON' : 'OFF'}
        </button>
      </div>
      <div className="flex h-4 w-full">
        {STAGES.map((s, i) => {
          const seg = segs[i]
          const current = s === hull.stage
          return (
            <div
              key={s}
              className={`relative ${current ? 'ring-1 ring-inset ring-oxide' : 'border-r border-steel-900'}`}
              style={{ width: `${config.SHIPS[hull.classId].stageShare[s] * 100}%` }}
              title={`${s} ${seg?.done}/${seg?.req}`}
            >
              <div
                className={`absolute inset-y-0 left-0 ${current ? 'bg-oxide/80' : 'bg-steel-500/60'}`}
                style={{ width: `${(seg?.pct ?? 0) * 100}%` }}
              />
            </div>
          )
        })}
      </div>
      <div className="grid grid-cols-3 gap-2 border-b border-steel-700 px-3 py-2 text-[12px]">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-steel-500">Stage</div>
          <div className="font-semibold text-steel-300">
            {stageLabel(hull.stage)} {Math.floor(hull.workInStage)}/{req}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-steel-500">Deadline</div>
          <div
            className={`font-semibold ${
              tone === 'late' ? 'text-oxide' : tone === 'urgent' ? 'text-amberurg' : 'text-steel-300'
            }`}
          >
            wk {hull.deadlineWeek}{' '}
            {left < 0 ? `(${Math.abs(left)}w overdue)` : left === 0 ? '(due now)' : `(${left}w)`}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-steel-500">Projected</div>
          <div className="font-semibold text-steel-300">
            {proj === null ? 'unknown' : `wk ${proj}`}
          </div>
          <div className="text-[10px] text-steel-500">if current crews follow the hull</div>
        </div>
      </div>
      <div className="px-3 py-2">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-steel-500">
          Assigned crews
        </div>
        {assigned.length === 0 && (
          <div className="text-xs text-steel-500">None — click a bench crew to assign.</div>
        )}
        {assigned.map((crew) => (
          <CrewRow
            key={crew.id}
            crew={crew}
            hull={hull}
            onAssign={(id, stage) =>
              dispatch({ type: 'ASSIGN_CREW', crewId: id, hullId: hull.id, stage })
            }
            onUnassign={(id) => dispatch({ type: 'UNASSIGN_CREW', crewId: id })}
          />
        ))}
      </div>
    </div>
  )
}

export function GameScreen({
  state,
  dispatch,
}: {
  state: GameState
  dispatch: (a: Action) => void
}) {
  const hull = currentHull(state)
  const occ = occupancyPct(hull)
  const acceptOk = canAccept(state)
  const continueOk = canContinue(state)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        if (!continueOk) return
        dispatch({ type: 'CONTINUE' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dispatch, continueOk])

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-steel-700 bg-steel-800">
        <div className="flex flex-wrap items-center gap-3 px-4 py-2">
          <div className="text-lg font-bold tracking-tight text-steel-300">DRYDOCK</div>
          <div className="text-sm text-steel-400">
            {formatWeek(Math.min(state.week, config.TIME.weeksPerRun), config.TIME.weeksPerRun)}
          </div>
          <div className="text-sm font-semibold text-steel-300">{formatMoney(state.cash)}</div>
          <div className="text-[11px] uppercase tracking-wider text-steel-500">seed {state.seed}</div>
          <div className="flex flex-1 flex-wrap gap-1">
            {state.badges.map((b) => (
              <span
                key={b.id}
                className="border border-amberurg px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amberurg"
              >
                {b.text}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: 'STEP_WEEK' })}
            className="border border-steel-700 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-steel-400 hover:border-steel-400"
          >
            +1 week
          </button>
          <button
            type="button"
            disabled={!continueOk}
            onClick={() => dispatch({ type: 'CONTINUE' })}
            className="bg-oxide px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-steel-300 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {continueOk ? 'Continue' : 'assign a crew to continue'}
          </button>
        </div>
        <div className="border-t border-steel-700 px-4 py-1 text-xs text-steel-400">
          {statusLine(state)}
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-0 lg:grid-cols-[220px_1fr_320px]">
        <aside className="border-r border-steel-700 bg-steel-900 p-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-steel-500">
            Berth 1
          </div>
          <div className="border border-steel-700 p-3">
            <div className="mb-2 text-xs uppercase tracking-wider text-steel-500">
              {hull ? 'Occupied' : 'Empty'}
            </div>
            <div className="mb-1 h-2 bg-steel-800">
              <div className="h-full bg-steel-400" style={{ width: `${occ * 100}%` }} />
            </div>
            {hull ? (
              <div>
                <div className="text-sm font-semibold text-steel-300">{hull.name}</div>
                <div className="text-xs text-steel-400">{config.SHIPS[hull.classId].name}</div>
                <div className="mt-1 text-[11px] text-steel-500">
                  {Math.round(occ * 100)}% · {Math.floor(hull.totalWorkDone)}/
                  {config.SHIPS[hull.classId].workUnits} wu
                </div>
              </div>
            ) : (
              <div className="text-xs text-steel-500">Accept a contract to occupy.</div>
            )}
          </div>
          <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.25em] text-steel-500">
            Crew bench
          </div>
          <div className="mt-1 border border-steel-700 px-2">
            {state.crews.filter((crew) => !crew.assignment || crew.walkoffWeeksLeft > 0).map((crew) => (
              <CrewRow
                key={crew.id}
                crew={crew}
                hull={hull}
                onAssign={(id, stage) => {
                  if (!hull) return
                  dispatch({ type: 'ASSIGN_CREW', crewId: id, hullId: hull.id, stage })
                }}
                onUnassign={(id) => dispatch({ type: 'UNASSIGN_CREW', crewId: id })}
              />
            ))}
          </div>
        </aside>

        <main className="p-3">
          {hull ? (
            <HullCard state={state} hull={hull} dispatch={dispatch} />
          ) : (
            <div className="border border-dashed border-steel-700 p-8 text-center text-sm text-steel-500">
              Berth empty. Accept a contract from the board.
            </div>
          )}
        </main>

        <aside className="border-l border-steel-700 bg-steel-900 p-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-steel-500">
            Contract board
          </div>
          <div className="space-y-2">
            {state.offers.map((o) => (
              <div key={o.id} className="border border-steel-700 p-2">
                <div className="flex items-baseline justify-between">
                  <div className="text-sm font-semibold text-steel-300">
                    {config.SHIPS[o.classId].name}
                    {o.rush ? <span className="ml-2 text-oxide">RUSH</span> : null}
                  </div>
                  <div className="text-sm text-steel-300">{formatMoney(o.payment)}</div>
                </div>
                <div className="text-[11px] text-steel-500">
                  {o.deadlineWeeks}w · age {o.age} · 30% advance {formatMoney(o.payment * 0.3)}
                </div>
                <button
                  type="button"
                  disabled={!acceptOk}
                  onClick={() => dispatch({ type: 'ACCEPT_CONTRACT', offerId: o.id })}
                  className="mt-1 w-full border border-steel-700 py-1 text-[11px] font-semibold uppercase tracking-wider text-steel-400 enabled:hover:border-oxide enabled:hover:text-oxide disabled:opacity-40"
                >
                  {acceptOk ? 'Accept' : 'Berth busy'}
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4 mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-steel-500">
            Weekly cashflow
          </div>
          <div className="border border-steel-700 p-2 text-xs">
            <Row label="Wages" value={-state.weekCashflow.wages} />
            <Row label="Rush premium" value={-state.weekCashflow.rushPremium} />
            <Row label="Penalties" value={-state.weekCashflow.penalties} />
            <Row label="Deliveries" value={state.weekCashflow.deliveries} />
            <Row label="Advances" value={state.weekCashflow.advances} />
            <div className="mt-1 flex justify-between border-t border-steel-700 pt-1 font-semibold">
              <span>Net</span>
              <span>{formatSignedMoney(state.weekCashflow.net)}</span>
            </div>
          </div>

          <div className="mt-4 mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-steel-500">
            Log
          </div>
          <div className="max-h-72 overflow-y-auto border border-steel-700">
            {state.log.map((line) => (
              <div
                key={line.id}
                className="border-b border-steel-800 px-2 py-1 text-[11px] leading-snug last:border-b-0"
              >
                <span className="mr-2 text-steel-500">w{line.week}</span>
                <span
                  className={
                    line.kind === 'halt' || line.kind === 'warn'
                      ? 'text-oxide'
                      : line.kind === 'money'
                        ? 'text-steel-300'
                        : line.kind === 'badge'
                          ? 'text-amberurg'
                          : 'text-steel-400'
                  }
                >
                  {line.text}
                </span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-steel-400">
      <span>{label}</span>
      <span>{value === 0 ? '—' : formatSignedMoney(value)}</span>
    </div>
  )
}
