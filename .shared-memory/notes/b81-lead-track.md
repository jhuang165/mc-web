# Batch 81 lead: merges and release 0.110.0

## Merged (git log --first-parent on batch81-lead, cut from f98083f29 = 0.109.0)
- mpcmd81 49ab09d07, corpse81 794579495, throwfire81 e20829be8, potspacks81 36666c711, exhaust81 897340bfa, collide81 040d1e6ca, render81 766b7c1b2, mpcopies81 9858d6627, mpperf81 344677182, blast81 8843b9b79.
- One conflict, in `src/multiplayer/client-dispense.js` and `server-dispense.js`: mpcopies81 (skull copy angles, `skull-look.js`, `b.track` on the server skull) and blast81 (ball tracker entries, `fireball-copy.js`, `this.ballTracks`, `row.track` on the client) both track wither skulls. They use separate fields (angles vs position), so both are kept: the skull row carries `...skullWire(b), t: this.ballTracks.row(b)`, the flush runs both updates, and the client takes `fresh = !row` after blast81's lingered-row reset so a re-seen skull starts a new look.
- Cross-track check: collide81 changed fence collision boxes, which mpperf81's cell-box table reads; fences depend on neighbours and stay on the reference path. `MC_MPPERF81=verify` over mpperf81, collide81, block-collisions and mpperf78 tests: 20/20.

## Verification
- One full `npm test` on 40f8687aa: 9123 tests, 9123 pass, 0 fail (187 s). `npm run build` ok; bridge tests ok. No browser checks (by request).

## Found wrong in the batch 80 list
- "The client does no neighbour updates when it clears an exploded block": native remote worlds run none (blast81).
- "The port's wither has no pitch" and "saved skulls start at rotation 0" (skull block): both already worked; the real gap was wither skull projectile rotation in saves and exports (render81).

## Open
See "Still open from batch 81" in `public/research/remaining-gaps.md` and the ten `*-b81-track.md` notes. Browser-only items are listed there.
