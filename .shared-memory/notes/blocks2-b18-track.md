# Block sweep round 2 (batch 18, branch b18-blocks2)

## Summary
Extended the native sweep to all remaining registered 1.7.10 blocks (ids 1-175 minus the 38 of batch 16 and 165-169). Probe `tools/probes/BlockSweepProbe.java`, verifier `tools/verify-block-sweep.mjs`, reference `public/research/block-sweep-reference.json` (about 390 KB). Probed against the unchanged jar; the tile-entity blocks are skipped. Only BlockDeadBush.func_149854_a was read from bytecode (javap), the rest is probed.

## Tests
`src/block-sweep.test.js` (8 tests): boxes, masks, stairs, doors, six-side neighbour removal with the main.js watcher stack (about 23,000 cases, state and drops), farmland/crop/cactus/reeds/melt ticks. Full `npm test` and `npm run build` pass.

## Divergences fixed
Selection outline in main.js now uses `selectionBounds`; crop, sapling, tall grass, flower, chest, powered rail and cactus boxes; crops and farmland react to every neighbour update (`farmNeighbourChange` in farming.js); tall grass pops; dead bush no longer stands on grass; lily pad pops without still water; vine face bits update; snow block melts and drops 4 snowballs (weather.js `drop` hook, snow.js, world.js `ticksRandomly`).

## Remaining gaps
Light-dependent survival of flowers/mushrooms (probe light fixed), door cascade drops (doors track), seeded-Random drop streams and several random ticks not stream-replayed, tile-entity block boxes, exemptions listed in block-behaviour-audit.md.

## Proposed remaining-gaps line
- Block behaviour audit: light, opacity, boxes, six-side neighbour reactions and key random ticks of every registered block (ids 1-175) are probed and replayed (batches 17-18; 12 divergences fixed); open: light-dependent plant survival, seed-stream drops, tile-entity block boxes ([block-behaviour-audit.md](block-behaviour-audit.md)).
