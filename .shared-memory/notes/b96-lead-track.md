# Batch 96 lead (2026-11-22)

Ten Sonnet tracks in `../wt96-<name>` on `batch96-<name>96`, cut from main 0e2854338 (0.124.0) and merged --no-ff on `batch96-lead`. Rules: `../artifacts/b96-lead/track-rules.md`, which add an empty-file-list guard and a `main.js` rule (one or two lines, code-read only). Released as 0.125.0.

## Merged
- horse96 14583d2d0: `Kill96Probe` (a killed player rider stays seated through the 20 death ticks and is unlinked the tick after); the dedicated server holds mob-mount riders until then (`server-vehicles.js`, `server-survival.js respawn`); `Horse96Probe` pins a lead on a ridden horse as already native.
- credit96 18a18fee3: mob-on-mob Knockback along the attacker's yaw, which also slows the attacker by 0.6; Looting on a player's splash-potion kill.
- console96 cda1910ed: `Console96Probe` spawn packet set; tracked player rows count their tracker's real per-tick packets (`pk`).
- mpperf96 1a07db04e, 7269059aa: iterator-free tracker and tick loops behind `MC_MPPERF96`. The index-loop rewrites in `entities.js`, `ai.js`, `player-physics.js` and `java-hashset-order.js` all loop over arrays.
- mpobjects96 446fa12fc: the Nether and End lanes flush at `mq.b`'s place; village and siege ticks run in `ServerMobs.villageStep()` (`mt.b` order).
- spcopy96 278e1dc5f: the Overworld arrival hint comes from the exit prewarm's built cells, computed in the portal tick (`announceNow`). This fixes the batch 95 guard that skipped every Overworld trip.
- portals96 a86c48747: a hopper cart without `TransferCooldown` reads 0; custom cart display watchers 20 to 22 now reach client copies.
- tiles96 8cc9407fc: `Tiles96Probe`: the jukebox keeps the stack's tag and Damage, an unregistered Record loads as id 0, raw skull damage drops, an unregistered piston `blockId` is air.
- entnbt96 9ab10f734: `Entnbt96Probe`: loaded effects carry no attribute modifiers, export writes the real potion Modifiers, and player Motion and SleepTimer round-trip. New `main.js` lines: motion in `active.playerState` and its restore on a non-arrival load.
- mobrec96 64768bb23: 65 executed cow, mooshroom, pig, chicken, sheep-shears and bat records; fixes the breeding XP orb, the shears break draw and the baby growth nudge.

## Lead checks
- No merge needed a manual resolution. I reviewed every new `main.js` line (playerState motion, the jukebox spawn passing `stack.stored, stack`, `music.use(..., survival.held)`) and the mpperf96 loop rewrites.
- One full `npm test` on the merged tree: 10685/10686. The one failure, `mpwither-b63` "a wither skull is a server projectile", passed 22 targeted reruns (6 runs of the whole file, 16 of the test alone under parallel load), so it is a load flake. No second full run.
- Build and bridge tests ok. No browser checks.
- mpperf96 and mpobjects96 briefly started the whole suite despite the guard, and stopped it themselves. I stopped mpperf96's agent after it kept sending leftover monitor notifications.

## Open
"Still open from batch 96" in `public/research/remaining-gaps.md`.
