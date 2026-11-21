# Batch 91 lead (2026-11-21)

Ten Sonnet tracks in `../wt91-<name>` on `batch91-<name>91`, cut from main 94e060855 (0.119.0), merged --no-ff on `batch91-lead` with no textual conflicts. Rules: `../artifacts/b91-lead/track-rules.md`. Released as 0.120.0.

## Merged
- horse91 df3622c83: `Vehicle91Probe` boat and cart sneak records (no source change needed); a living mob on a saddled horse steers it (`steeringRider`).
- mpobjects91 bfd06bd13: server weather, random ticks, lightning and bolts before the entity pass; maps before the tracker flush; remote boat and cart shadows. Edited `mplightning-b66.test.js` (the bolt now runs before the mobs, so the test ticks once first).
- mobpackets91 9d3a870b2: watcher 8 ambient, `copyMetaDirty` gate, `adoptSpawns` same-pass spawns, `MobPackets91Probe`. Edited baby `growingAge` expectations (-23999) and the `mobcopies2-b61` meta lists.
- spcopy91 fa0b89579: `PlayerView.alive` getter false while `left`, plus `left` gates.
- credit91 f51301745, e81b7cc1b: dead-body attacker for pigmen and reinforcements, a dead shooter's arrow, server Thorns for player arrows, stored look for queued attacks, uses and bow releases.
- console91 3b6e1d93b: owner strings and name tags, per-connection S1C, real vehicle/object packet counts, light hash measured.
- mpperf91 de62e995a: `MC_MPPERF91` early `sendAttributes` return for plain mobs. Edited the `mode90` regexes in the mpperf86-90 tests.
- tiles91 5f83ecbf3: chest facing in cell metadata, lazy migration; entity-time darkness for mob light. Edited `block-registry.test.js` and `chunk-store.test.js` (old record-only chest facing).
- entnbt91 e4064a390, 8c3c653d7: away and server portal travel for arrows and rockets; `Entnbt91Probe` audit and fixes.
- mobrec91 d634df4cf: 22 executed records and their fixes; edited `spcopy89-b89.test.js` (a source regex pinning the old dead-copy gate).

## Lead checks and fixes
- spcopy91's `alive` getter and mobrec91's dead-copy rule in `ai.js` fit: `alive` already folds in `left`.
- Full `npm test` on the merged tree: 10226/10233. Fixes:
  - Six `enderman-wolf-b44` breeding replays: `adoptSpawns` now updates a born baby in the same pass (native), but `EndermanWolfProbe` never ticks spawned entities, so `enderman-wolf-replay.js` sets `probeFixedList` for every record (mobpackets91 had set it only for the b45 `init` records).
  - `mpperf91-b91` "scripted S20 packets identical off/on/verify": the three runs drew different Math.random-seeded mob randoms, so a zombie's random jump moved one S20 by a tick. The test now runs each mode on one seeded `Math.random`.
  - Targeted re-run: every `enderman-wolf-replay` test file plus mpperf91 and mobpackets91, 659/659.
- spcopy91's note got its targeted-run count (2490/2490).
- Seen flaky in track runs, not in the full run: `mpnether3-b63` Nether orbs (fails on the parent commit too), `corpse81-b81` dragon damage.
- The shared stash stack holds only the old batch 27 entry; no track left one.
- No browser checks.

## Open
"Still open from batch 91" in `public/research/remaining-gaps.md`.
