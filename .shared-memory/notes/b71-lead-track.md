# Batch 71 lead: ten Sonnet tracks merged on `batch71-lead`, released as 0.100.0

Cut from 4709f89ce (0.99.0). Worktrees `../wt71-<name>` on `batch71-<name>`; shared rules `../artifacts/b71-lead/track-rules.md`. No browser checks by request. The version is 0.100.0, not 1.0.0, so the number does not suggest full parity.

## Merged (--no-ff, in order)
- mpcapes71 c5093afb5
- steps71 cca216cb1
- mobfixes71 1c3b66767
- mptrackers71 f0d59dae3 (`server-items.js` merged cleanly with mobfixes71)
- mpadmin71 48f7e3d65: conflict in `simulation.js`; kept mpcapes71's `capeFields` presence line and mpadmin71's `mapFeatures` snapshot line.
- researchdocs6 47426218f
- hudfx71 27a161f93: conflict in `stems-cake.md`; kept the sweep's stem-random line and hudfx71's darkness-pop found-wrong line.
- mpreach71 3fd5596b1
- mobrender71 a83188616: conflicts in `slime.md` (both b71 lines kept) and `presence.js` (mpcapes71's cape loader plus mobrender71's `skinBook` import, registration and `skinOf`).
- mpchunks71 797ef6275: conflicts in `client.js` (mpadmin71's `mapFeatures` World argument with mpchunks71's `restoreColumns`) and `simulation.js` (`capeFields`, `mapFeatures` and the chunk-view columns together).
Merge SHAs are in `../artifacts/b71-lead/agents.md`. Every merge was followed by the tracks' targeted tests and `node --check src/main.js`, plus the replay tests where `main.js` changed.

## Lead fixes
- cdde6b709 (test only): `redstone-ore.test.js` expected the old `touchRedstoneOre(Math.floor(position.x), Math.floor(position.y - 0.2), ...)` call; steps71 moved it to the `step-block.js` cell with no touch when a fence below replaced the block. The test now checks that form.

## Verification
- Full `npm test` once on the merged tree: 8266 of 8267 passed; the one failure is the wiring test above (12 of 12 in that file after the fix).
- `npm run build` ok; `python3 -m unittest discover -s tools -p 'test_memory_bridge.py'` ok.
- mpreach71 could not finish `mpnether3-b63`, `away-order-b50` and `object-tracker-vehicles` under load (Spotlight indexing the new worktrees); the full run covered them and they passed.

## Open
See "Still open from batch 71" in `public/research/remaining-gaps.md`. Notably: join snapshot not streamed and block changes not filtered per player, item/orb 20-tick cadence, cake left click, Nether fog distances, rider fall distance and sounds, the 40/256 entity caps on eggs, `/summon` and natural spawning, generation 9 server world without structures.
