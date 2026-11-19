# Batch 82 lead: merges and release 0.111.0

## Merged (git log --first-parent on batch82-lead, cut from 3b99e1bd4 = 0.110.0)
- spblast82 2c66f7783, mpcmd82 02bd27418, corpse82 555d6d91c, entities82 d27122f3b, mpperf82 b792f4ce2, fireext82 3134beffa, commands82 de5d7dca0, mpball82 e0ba5469b, mpplace82 d317a52bd, pots82 23d931d9f.
- Conflicts:
  - `src/entities.js` (corpse82 / entities82): corpse82 moved the daylight ignite into `sunIgnite(e, t)` so corpses run it; entities82 added `daylightHelmet` inline. The helmet test now sits inside `sunIgnite`.
  - `src/fireballs.js`, `src/projectile-renderer.js`, `src/multiplayer/server-dispense.js`, `public/research/blaze-ghast.md` (fireext82 / mpball82): both added the fireball's launch angles and turn toward the motion. The turn runs once, through mpball82's `fireballStep` hook (the executed probe's order); fireext82's `savedRotation` and the TNT / rocket / eye `f` flags kept; mpball82's `skullWire` fields on fireball rows kept; `THROWN_FIRE` takes fireext82's eye and rocket, `BALL_FIRE` mpball82's balls. Both research lines kept.
  - `src/entities.js` (mpperf82 / mpplace82): mpplace82's new `serverCopyMove` kept above mpperf82's `moveEntityWithHeading(..., motion)` signature.
- Cross-track tests: fireball, blast, corpse and entity tracks with render81, blast81, mpcopies81: 70/70. Command tracks with commands, servercommands-b59, mpworldcmds-b68, mpperf82: 54/54. mpplace82 with mpperf82, corpse82, collide81, prediction5-b59, movement-stat, serverplayer-b47, mpball82: 86/86; with `MC_MPPERF82=verify`: 47/47. pots82 with spblast82, fireext82, mpplace82, potspacks79/81, block-placement-simulation: 63/63.

## Verification
- One full `npm test` on 1b107d780: 9215 tests, 9215 pass, 0 fail (193 s). `npm run build` ok; bridge tests ok. No browser checks (by request).

## Found wrong in the batch 81 list
- "Counts above 15 through wires and comparators are unchecked": they already matched native (mpcmd82, now tested).
- "A server block far from spawn keeps running": the 128×128 server world keeps every chunk near spawn; a residency model exists behind a flag (mpcmd82).
- "Horse herd following is not modelled": in 1.7.10 it records a target and never moves the horse (corpse82).
- The batch 81 comment that fireballs are fire immune was wrong; they burn (mpball82, executed).

## Open
See "Still open from batch 82" in `public/research/remaining-gaps.md` and the ten `*-b82-track.md` notes. Browser-only items are listed there.
