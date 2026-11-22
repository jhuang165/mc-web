# spcopy95 (batch 95): arrival before the old world's save point, old chunk listing, gate switch order

## Summary
The Teleporter result for a Nether or End trip is now known before the old world's save point, and the old world's copy of the player behaves as natively for held targets and the old chunk listing. Does not claim full parity.

- `src/dimension-live.js`: `announceArrival` (called in `travel` after `settle`, before `h.save()`) runs the same Teleporter on a fresh peek of the destination with COPIES of the shared portal cache and random, and gives `host.arrivalHint({x,y,z, scaled:{x,y,z}})` (`scaled` = `transferTarget` position, where the old world listed the entity). Nether and End destinations only; Overworld destination and any failure leave the old behaviour (no hint).
- `src/ai.js` (`PlayerView`): `depart(hint)`/`placeAtArrival` (a left copy reads x/y/z as the arrival, restored if the trip fails), `heldAlive` (alive for a left copy at a known arrival), `listedIn(box)` (the old world's chunk-list query range: chunks (min-2)/16..(max+2)/16, Y slices clamped 0..15, at the scaled chunk and the old height slice). `AttackOnCollide.shouldExecute/continueExecuting` and `TargetBase.continueExecuting` read `heldAlive`.
- `src/entities.js`: the three player-box readers (spawn blocking `blocked`, `push`, `push87`) accept `p.inWorld || p.listedIn(box)`.
- `src/main.js`: `arrivalHint` host callback; `depart(null)` in its own statement when the trip is not busy (spcopy89 pins the neighbouring line); `spGateConfig.enabled` is set in `launch` right after `active = record` (before the new EntityWorld), not first in the movement tick.
- `tools/probes/SpCopy95Probe.java`, `public/research/spcopy95-reference.jsonl`, `src/spcopy95-b95.test.js` (5 tests).

## Evidence
- Executed (SpCopy95Probe, real ahb/oi/mt classes): the old world holds the player in the chunk of the SCALED position, not the arrival chunk (cases blockedWest/blockedEast: the Teleporter built the portal in the neighbouring chunk; srcChunksHoldingPlayer = scaled chunk, dst = arrival chunk). When the scaled chunk equals the departure chunk it is not re-listed (originOverToNether: empty; `ag` already true). End exit: not listed.
- Bytecode-read: `ahb.b(sa, azt)` uses (min - 2.0)/16 and (max + 2.0)/16; `vu.b` target continue reads isEntityAlive, distance, sight; `td.bL` leash steps only when holder and mob share a world, so a lead holder was already native (`leashHolder` returns `away` for a left copy).
- Port-read: `arrive` and `announceArrival` run the same Teleporter inputs; test 4 shows equal results.

## Verification
- `node --test --test-concurrency=2 src/spcopy95-b95.test.js`: 5 pass. With ai.js, main.js and dimension-live.js reverted: 4 fail, 1 pass (restored).
- Related files (spcopy*, dimension*, away*, portals*, leash*, entnbt*, *tracker*, mobrec9*, horse9*; 81 files): 856 tests, 855 pass; the one failure (spcopy89 source-regex on the exact `if (!dims.busy) {...}` line in main.js) was my edit's line shape, not behaviour: fixed by a separate statement, spcopy89+spcopy95 rerun: 17 pass, 0 fail. No build (no new imports).
- No full `npm test`, no browser.

## Found wrong in the batch 94 list
- "A tracker created in the very first movement tick may precede the `spGateConfig` switch": true (trackers are made lazily in `idleTrack` at launch); fixed by switching at launch.
- Lead holder near an arrival is not a gap: already native.

## Follow-ups
- Arrival hint for an Overworld destination (Nether to Overworld) not available before the save: needs the Overworld terrain on this thread. Ticks between the portal tick and the hint still see the old "dropped" behaviour (the hint is computed async after `settle`).
- Melee/ranged damage paths and new-target selection for the copy at the arrival were not changed (NearestAttackable for players is playerEntities based, so correctly excluded).
- Simplifications left from batch 94 (unchanged, not proven differing): unload does not remove tracked entities; gate radius follows `viewChunks`.
- Browser-only: nothing visible expected except a possible brief stall in `announceArrival` generating Nether terrain before the save.
