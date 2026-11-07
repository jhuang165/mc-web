# Block sweep round 3 (batch 19, branch worktree-agent-adfeba4ece345adf9)

## Summary
Light axis, seeded drop streams and tile-entity boxes added to the native block sweep. Probe `tools/probes/BlockSweep3Probe.java` and `BlockSweep3Tile.java`, verifier `tools/verify-block-sweep3.mjs`, reference `public/research/block-sweep3-reference.json` (about 650 KB, 865 records), replay `src/block-sweep3.test.js` (13 tests). Divergences fixed: flowers no longer need light (native BlockBush has none), mushrooms got the native light rule, placement check, random-tick spread and `ticksRandomly`; crop and stem growth read saved light with skylightSubtracted at y + 1; `movingCollisionBox` added for BlockPistonMoving.

## Native evidence
Executed on the unchanged jar: stay/place over a light grid, tick histograms, mushroom spread, 55 drop sources x fortune 0-3 x 40 seeds with the next two Random draws, BlockPistonMoving with a real TileEntityPiston, tile-entity queries of 17 blocks' box methods. Bytecode-read only (javap): `ajr.j`, `amc.j`, `amc.a`, `ahb.j/k/b`. Compiled probe output stays in the ignored `tools/research/block-sweep3-probe/`; the jar is untouched.

## Tests
`src/block-sweep3.test.js` (survival grid, mushroom light term, sapling and crop growth, tick equality over light, mushroom spread seed-for-seed and through `PopulationBlocks`, `harvestBlock` stream replay, non-harvestBlock drops, moving piston extending and retracting boxes, tile-query check). `src/dyes.test.js` flower test changed to the ground-only rule; `src/world-chunks.test.js` hashes of the meadow and island chunk worlds changed by one flower each (cells the old light rule refused; checked with the old rule). Full `npm test` and `npm run build` pass.

## Remaining gaps
Moving block is not a player/mob collider in the port; stored-block bounds quirk of the native moving block; drop streams outside `harvestBlock` use other streams; tile-entity contents (skull, hopper, comparator) not probed; no browser check run.

## Proposed remaining-gaps lines
- Block behaviour audit: batch 19 probed light-dependent plant survival, mushroom spread, seeded drop streams (fortune 0-3) and moving-piston boxes against 1.7.10; open: moving-block player collision, non-`harvestBlock` drop streams ([block-behaviour-audit.md](block-behaviour-audit.md)).
