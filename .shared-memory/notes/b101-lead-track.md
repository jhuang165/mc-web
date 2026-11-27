# b101 lead track (batch 101, 2026-11-27)

Lead branch `batch101-lead` in `../wt101-lead`, cut from 776d5f8a4. Released as 0.130.0. Does not claim full parity.

## Merges
horse101, spcopy101, abilities101, console101, tiles101, mpperf101 (+ lead fix 504db175f: 14 stray `src/*.test.js-E` sed backups removed), credit101, mobrec101, mpobjects101, entnbt101. No merge conflicts; every shared-file diff (`main.js`, `entities.js`, `net-packet-ids.js`, `server.js`, `survival.js`, `simulation.js`) reviewed before merging.

## Verification
One full `npm test` on the merged tree: 11071/11071. `npm run build` ok, bridge tests 5 ok. Logs in `../artifacts/b101-lead/`. No browser checks.

## Review notes
- spcopy101 runs the full `movementTick(IDLE_INPUT)` under the death screen in single player (code-read only); watch for mobs targeting a dead player, a seated dead rider, death in a portal.
- console101 gates `p.swing = 6` through a property setter (`server-swing.js`) on every server player.
- abilities101 keeps the client's S39 flags in a module-level holder (`ability-flags.js`), reset on leaving multiplayer.
- entnbt101 used one `pkill -f` matching only its own test file (rule breach reported by the track; nothing else affected).

## Open
"Still open from batch 101" in `public/research/remaining-gaps.md`.
