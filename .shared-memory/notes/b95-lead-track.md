# Batch 95 lead (2026-11-21)

Ten Sonnet tracks in `../wt95-<name>` on `batch95-<name>95`, cut from main f5062f77e (0.123.0), merged --no-ff on `batch95-lead`. Rules: `../artifacts/b95-lead/track-rules.md`. Released as 0.124.0.

## Merged
- horse95 a2d9c15e7, b6d3cf049: water dismount for player riders (`Horse95Probe`, `horse95-reference.json`), `server-survival.js`, one `main.js` line; killed-horse drift pinned as native wander. The lead sent it back once after a first pass closed only item 4.
- credit95 d18eb01e5, d1bc5e83d: PvP victim held Thorns, mob-on-mob `hitMob` Thorns.
- console95 d832718f3: immediate S13 for player entities (`peerRemovals`, `Console95Probe`, stub `tools/probes/stub95/ej.java`).
- mpperf95 5d6252950, b22b88e3a: `FlatPositionSet95` behind `MC_MPPERF95`; mode regexes in mpperf86-90 tests and `bench-alloc81.mjs` accept `mode95`.
- mpobjects95 298b00559, 6d24ee24a: Overworld block-change flush at `mq.b`'s place.
- spcopy95 7ad7841db: `announceArrival`, `PlayerView.depart`/`heldAlive`/`listedIn`, gate switch at `launch`; edits in `ai.js`, `entities.js`, `main.js`.
- portals95 88529e4a8: `{ reload }` for `EntityWorld`/`ItemEntities.load` (`realLoad = !tripArrival`), cart display fields, furnace Fuel.
- tiles95 9bc706ac8: idle `skipTicks`, `tiles95-reference.json`, skull raw bytes, any-stack jukebox, spawner Type, cart command reads; edited `falling79-b79` and `plants83-b83` (encoded port assumptions).
- entnbt95 5ab28bc49: player NBT fields, `player-nbt.js`, `active.playerState` in `main.js save()`.
- mobrec95 8006e3dac: 31 records; giant age, shear Random, lamb colour.

## Lead checks
- No merge needed a manual resolution. Reviewed the shared-file diffs (`main.js`, `server/server.js`, `ai.js`).
- One full `npm test` on the merged tree: 10565/10567. `horse93-b93` "AI rider forwardStrafe" passed 3/3 alone (load flake). `sheep.test.js` shear count encoded the world random (`() => 0.5` gives 2); mobrec95 moved the draw to the sheep's own Random (executed 9817), so the lead's fix d95bab57a asserts the native 1 to 3 range. After it: sheep + mobrec95 5 runs, 52/52 each. No second full run (one full run per change).
- Build and bridge tests ok. No browser checks.
- Two tracks (credit95, spcopy95) briefly started the whole suite with an empty file list and stopped it; batch 96 rules add an empty-list guard.

## Open
"Still open from batch 95" in `public/research/remaining-gaps.md`.
