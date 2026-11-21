# Batch 94 lead (2026-11-21)

Ten Sonnet tracks in `../wt94-<name>` on `batch94-<name>94`, cut from main 5650dbe8b (0.122.0), merged --no-ff on `batch94-lead`. Rules: `../artifacts/b94-lead/track-rules.md` (adds: no `pkill`/`killall`, explicit test paths; the horse flake owned by horse94). Released as 0.123.0.

## Merged
- tiles94 51845abb3: `away-time-shift.js`, `awayTimeShift` in `main.js`, `skipTicks`.
- spcopy94 48c33319c: `sp-chunk-gate.js`, `spGateConfig.enabled` in `main.js`. Visible change: entities appear column by column over 1 to 4 seconds after login and portal trips. Not seen in a browser.
- console94 dfb911033: one S13 queue per connection (`ctx.destroyed={n,next}`, `drainDestroyed`, `delLate`); live End tracker test; drain moved in `server/server.js`.
- credit94 0942a68c7: single Bane roll, Thorns visit counts, `ownerBody`, body armour.
- mpperf94 3c2c85104: `mpperf94-fast.js`.
- mpobjects94 4667ec8d7: `tickBlockEvents`, Teleporter sweep order.
- portals94 0474d2624: single-player held leads, `mob-transient.js`, item delay/hover, OnGround.
- entnbt94 d8ad51939: `Entnbt94Probe`, immortal corpses, edge values.
- mobrec94 5abc701b9: 18 records, `directArrow`.
- horse94 9b724bbb2, 99c072093: test flakes fixed, `decayRideInput`, `Horse94Probe`; edited `seat86` test.

## Lead checks
- No merge needed a manual resolution.
- One full `npm test` on the merged tree: 10488/10489. The failure, `awaytracker-b60` "a mob's own age (ticksExisted) is kept by the saved record", came from portals94 calling `withoutTransient` on every `EntityWorld.restore`. The port rebuilds a dimension from its browser save in-session (away runs, dimension switches) where native chunks stay loaded, so that strip lost live state. Fix 07abd4289: `restore(e, { summoned, resetTransient = summoned })`; `dimension-live.js` `deliver` deletes `TRANSIENT_MOB` keys from the record itself, as the server's arrive does (portals93). `portals94-b94.test.js` opts in.
- After the fix: 872/872 targeted tests (every test file touching summon, away runs, dimension-live or mob transients, plus `entities.test.js`). Not followed by a second full run (one full run per change).
- Build and bridge tests ok. No browser checks.
- Flakes under load seen this batch, all pass alone: `cmd-exec-b83` "/summon", `mpwither-b64` "S1D" (18 clean reruns).

## Open
"Still open from batch 94" in `public/research/remaining-gaps.md`. New: a true game reload keeps port-only transients from the save (native resets them).
