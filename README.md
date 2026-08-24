# DRYDOCK

Industrial shipyard ledger. Current build is M0: one berth, Coastal Freighters, 48 weeks.

Install dependencies, then use the package scripts: dev, test, build, preview.

Default seed is drydock-m0. Full design is in SPEC.md. Balance lives in src/config.ts.

## How to play

Start screen: title DRYDOCK, seed field (default drydock-m0), Random seed, Start Run.

Game screen: Continue advances until a hard stop. Plus-one-week always ticks a single week. Assign crews to hull and stage. Overflow crews are paid and idle. Unassigned crews rest. Accept a contract only when the berth is free.

End screen: cash, hulls delivered, weeks late, bankrupt or finished. Run this year again retries the same seed. New seed returns to start.

## What M0 is

Inherited Coastal Freighter in assembly (40/140), deadline week 8, payment 600000 with 30 percent already in the 400000 starting cash. Four Green crews named Alden, Briggs, Cho, Dunn, proficiency 10, unassigned. Three contract offers. Hard stops: stage complete, hull delivered, walk-off, projection slip (edge), contract expiring with berth free, cash warning, week 48, bankruptcy. Fatigue-70 and busy-berth contract expiry are badges only.

Balance: src/config.ts. Design: SPEC.md.


## Commands

1. Install Node packages with the project package manager.
2. Script `dev` starts the Vite server (play in the browser).
3. Script `test` runs Vitest.
4. Script `build` typechecks and bundles.
5. Script `preview` serves the production bundle.

Package.json maps: dev, test, build, preview.

Typical sequence:

    npm install
    npm run dev
    npm test
    npm run build
