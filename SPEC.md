# DRYDOCK spec v1.3

Industrial works-ledger. You run a commercial yard. Time is weekly. The player is only interrupted at hard stops. M0 is the current build.

## Vision

A one-screen yard ledger: berth, hull, crews, contracts, cash. Muted steel greys, oxide red, amber urgency. Ruled tables. Not cute. No canvas, no game engine, no backend. All mutation goes through `reducer(state, action)`. Simulation is a pure function of state plus PRNG streams stored in the state. Same seed plus same action sequence yields byte-identical JSON.

## Time

A run is 48 weeks. Continue ticks week-by-week until a hard stop fires, then returns control. Plus-one-week always ticks exactly one week. Week 48 after the tick ends the run. Bankruptcy (cash below -250000) also ends the run.

## Hard stops, badges, edges

Hard stops (halt after the week, return control):

- stage_complete — current stage filled; all crews on that hull unassigned; crews idle
- hull_delivered — remaining 70 percent paid, early bonus if any, berth free. Outfitting completion folds into this halt (do not also halt as stage_complete)
- walkoff — a producing crew with fatigue above 85 rolled the 10 percent walk-off; they sit unassigned, unavailable, unpaid for 2 weeks
- projection_slip — edge only. Fires when a hull's projection crosses from (projectedWeek <= deadlineWeek, or unknown because zero assigned) to (projectedWeek > deadlineWeek), and that hull has at least one producing crew. Does not fire on the initial state even if already late. Does not fire when zero crews are assigned (projection is unknown / infinite)
- contract_expiring — the offer that aged off this week did so while the berth was free (halt after the week). If the berth was occupied, badge only
- cash_warning — cash below 0, or cash below -150000, unless the run is already ending
- week 48 / bankrupt — end screen

Badges (never halt): fatigue crossing 70 (chip on Continue, log line); contract expiring while the berth is busy.

## The M0 yard

One berth. Coastal Freighters only. Starting cash 400000 (ECONOMY.m0StartCash; M1 starts at 500000). Seed default `drydock-m0`.

Inherited hull at week 1:

- Coastal Freighter, 400 work units
- Stages sequential: cutting 20 percent = 80, assembly 35 percent = 140, erection 30 percent = 120, outfitting 15 percent = 60
- 120 work already done: cutting complete, assembly 40/140
- stage = assembly, deadlineWeek = 8 (7 weeks from week 1), payment 600000, rush false
- 30 percent already received; do not add it again
- Hull occupies the only berth from accept through delivery

Four Green crews, named Alden, Briggs, Cho, Dunn. Proficiency 10 in all four stages, fatigue 0, wage 4000/week, baseOutput 20. Start unassigned (week 1 is triage).

Three contract offers generated from the `contracts` PRNG stream (Freighters only).

## Assignment

Assignment is (hullId, stage). If the assigned stage is not the hull's current stage, the crew is overflow: paid, 0 output, 0 fatigue delta, 0 proficiency delta.

Unassigned: paid, rest fatigue -12/week (floor 0).

Walk-off: unassigned, unavailable, unpaid.

Producing (assigned to the current stage):

- output = baseOutput * profMult * fatigueMult, then hull output *= rushMult if hull.rush
- profMult = 0.7 + 0.006 * proficiency[stage]
- fatigueMult: if fatigue > 50 then 1 - (fatigue-50)/125 else 1
- rushMult = 1.4 if rush else 1

Proficiency: producing crew +6 in that stage, -2 in the other three (floor 0, cap 100). Overflow / unassigned / walk-off: no proficiency change.

Fatigue: producing +4, or +18 if hull.rush. Unassigned -12. Overflow 0. Cap 0-100.

Rush is per-hull and standing. Producing crews on a rushed hull also take +60 percent wages that week.

Starting proficiency by grade: Green 10 / Certified 25 / Master 40. M1 inherited Certified Assembly 55. The 8-week assignment span of control was dropped.

## Weekly output order

Keep eleven slots; no-op unused (M0):

1. Steel (no-op)
2. Debit wages (and rush wage premium). Unassigned still paid. Walk-off unpaid
3. Apply work to hulls from producing crews
4. Update proficiency and fatigue
5. Defects (no-op)
6. Stage transitions: if work in current stage reached the stage share, advance stage, unassign all crews on that hull, hard stop stage_complete. If outfitting completes, the hull is complete; go to step 7
7. Deliver complete hulls: pay 70 percent of payment; if deliveredWeek < deadlineWeek, also +3 percent of payment per week early. Remove hull, free berth
8. If a living hull has week > deadlineWeek, assess 40000 late penalty this week (every overdue week)
9. Events (no-op)
10. Contract board: oldest offer expires; generate one new offer into that slot. If the expired offer was in its final week AND berth is free, that expiry is a hard stop (halt after this week). If berth occupied, badge only
11. If cash < -250000, end run bankrupt. If cash < 0 or cash < -150000, hard stop cash_warning unless already ending

Then: projection-slip edge check. Then increment week. After ticking week 48, end the run.

## Projection

For each hull, simulate forward from current assignments, assuming currently assigned crews follow the hull onto the next stage automatically when a stage completes. UI label: "if current crews follow the hull". Apply proficiency growth, fatigue, and rush as currently set. Do not simulate wages, walk-offs, or other hulls. Return projected delivery week, or null if no crews are assigned to this hull.

Crews assigned to this hull at all are moved with it (including overflow on a future stage). If no crews are assigned to this hull, projection is null.

## Contracts

Three offers. Each: payment = 600000 * uniform(0.92, 1.12), deadlineWeeks = round(10 * uniform(0.8, 1.25)), 20 percent chance RUSH flag then deadlineWeeks = round(deadlineWeeks * 0.75) and payment *= 1.3. Age them; one slot refreshes per week (oldest expires).

Accept requires a free berth. Debit nothing extra. Add 30 percent of payment to cash now, spawn hull at cutting 0 work, deadlineWeek = currentWeek + deadlineWeeks, remaining 70 percent on delivery. Cannot accept while the berth is occupied.

Abandon (M1+): not-started refunds the advance and -15 reputation. In-progress: no refund, -8 reputation.

## PRNG

mulberry32. Separate streams hashed from seed+name: contracts, events, defects, steelPrice, seaTrials, walkoffs. Each stream's 32-bit state lives on GameState so the whole state is JSON-serializable and deterministic.

## Facilities (M1+)

New facilities take 3 weeks. Demolish returns 40 percent and takes 1 week. One gantry serves all berths at manhattan distance <= 4 (hard gate), +15 percent erection if distance <= 2. Erection slots: Small 2, Medium 3, Large 4.

## Quality, defects, sea trials (M1+)

M1 inherited Bulk Carrier does not accrue defects; quality is fixed Good.

Sea trials: one prompt. Choose K items to rework (60000 and 3 weeks each); the rest are settled.

## Economy (later milestones)

Mortgage: 12500 principal + 5500 interest weekly.

Wildcat, once per run: unpaid idle 2 weeks versus +15 percent wages forever.

Ledger fatigue is raw units, not shadow cash.

## Sharing (M5)

Daily seed, ghost runs, replay-compatible state dumps. M0 already serializes PRNG state so replays work.

## Ships

Three classes. M0 uses Coastal Freighter only.

- Coastal Freighter (Small): 400 wu, 80/140/120/60, base payment 600000
- Bulk Carrier (Medium): 900 wu, 180/315/270/135, base payment 1400000
- Product Tanker (Large): 1600 wu, 320/560/480/240, base payment 2400000

## UI (M0)

Start: big title DRYDOCK, seed field, Random seed, Start Run.

Game: three columns plus top bar.

- Top: Week N/48, cash as 400k / 1.2M, seed, badge chips, Continue, +1 week. Halt reason as a one-line status under the bar
- Left: berth block, occupancy bar, hull name/class; crew bench (resting / walk-off)
- Centre: hull card — class, four-segment stage bar with current highlighted, weeks to deadline (amber if <= 3, red if overdue), projected delivery week, Rush toggle, assigned crews with four proficiency pips and a fatigue bar. Click crew to assign/unassign; stage picker when assigning
- Right: three contract offers (Accept disabled if berth busy), weekly cashflow, scrolling log newest first

Keyboard: Enter/Space = Continue (not when typing in the seed field).

End: cash, hulls delivered, weeks late total, bankrupt or finished. Run this year again retries the same seed. New seed back to start.

## Milestones

### M0 — current build

One berth. Coastal Freighters. 48-week run. Hard-stop Continue. Inherited hull, four Green crews, three offers, walk-off, projection edge, cash warning, bankruptcy. No yard grid, steel market, defects UI, events, hiring, reputation, daily seed, or loss ledger.

### M1

Inherited Bulk Carrier (no defect accrual, quality locked Good). Certified crews, inherited Certified Assembly 55. Defects and quality. Hiring. Reputation. Abandon.

### M2

Steel market. Facilities build/demolish. Yard grid. Gantry manhattan gate and bonus. Second berth.

### M3

Events. Sea trials (one prompt, choose K to rework). Reputation consequences. Master crews.

### M4

Mortgage (12500 principal + 5500 interest weekly). Product Tanker. More berths. Erection slot caps.

### M5

Wildcat (once per run). Daily seed. Sharing / ghost runs. Loss ledger UI (fatigue as raw units).

## Balance

Every number lives in `src/config.ts` under TIME, TRIGGERS, YARD, FACILITIES, SHIPS, CREWS, PROFICIENCY, FATIGUE, QUALITY, REPUTATION, STEEL, ECONOMY, SCORING, LEDGER, SHARING. Logic contains no magic numbers.
