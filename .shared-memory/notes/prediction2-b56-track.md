# Batch 56 prediction2: client prediction, part 2

## Summary
Builds on the b55 overlay (`src/client-prediction.js`). Changes:
- `dryBreak`: a client break now draws the whole neighbour chain the native client runs (door or bed other half, double plant top, unsupported torch, plant, sign, ladder, snow, carpet, cake, stem, reeds, cactus, wart, crops, redstone parts, piston head or extended base), not just the broken cell.
- `dryActivate`: wooden door, trapdoor and fence gate toggle are drawn at once (iron door, lever, cake, bed, note block: nothing, as native).
- `dryUse` plus `useKind`: cake, seeds (wheat, pumpkin, melon, carrot, potato) and nether wart are drawn; door items, redstone, repeater, brewing stand, cauldron, flower pot and reeds already went through `placeHeldBlock` via `dryPlace` and now count as predicted.
- Bed, sign and skull items are deliberately not predicted: their onItemUse returns on the client (isRemote), probe diff is empty.
- `Scene.showPredictedCells`: predicted cells are relit immediately (each cell is put into the real world for one `light.update` and written back, no edit record), and every touching column is meshed once per prediction (before: once per cell).
- main.js: `predictBreak`, `predictPlace`, `showPrediction` use the above. No other main.js touch.

## Evidence
- Executed: `tools/probes/ClientPredictProbe.java` on the unchanged 1.7.10 classes (jar SHA1 e80d9b3b...), driven by `tools/verify-client-predict.mjs`, writes `public/research/client-predict-reference.json` (64 break, 40 use, 30 activate records). World double has isRemote=true, full daylight, no power, no tile entities. Replayed by `src/client-predict-b56.test.js`.
- Bytecode-read, not executed: the order of PlayerControllerMP.onPlayerDestroyBlock (aux 2001, setBlockToAir, onBlockDestroyedByPlayer), the onBlockActivated-then-onItemUse order, and that a client world edit relights in the same call.
- Item 4 (server range check refusing a drawn click): native client draws, server sends S23 with the real block. The port already does this (queued task, `serverAcceptsClick` resend, `revertPrediction`); now also for cascade cells. Pinned by a test of `serverClick` refusal plus the overlay revert; no new native probe.
- Measured in node (flat 128x128 test world, no GPU): meshColumn about 2.6 ms, light.update about 2.0 ms per cell. A door pair costs 2 relights; a cell on a column border meshes 2 columns once instead of twice per cell.

## Verification
- `node --test src/instantbreak-b55.test.js src/block-clicks-b51.test.js src/block-clicks-b52.test.js src/dig-abort-b54.test.js src/dig-finish-b53.test.js src/melee-order-b50.test.js src/player-edit-simulation.test.js src/block-placement-simulation.test.js src/block-placement-replace.test.js src/block-break-simulation.test.js src/directional-placement.test.js src/piston-scene.test.js src/client-predict-b56.test.js`: 92 pass, 0 fail (7 of them new).
- `npm run build`: ok. Full `npm test` not run (batch rule).

## Follow-ups
- Bucket use, cocoa beans, lead and skull/sign/bed not predicted (bucket is bytecode-read only; cocoa and lead have probe records but no port mapping).
- Button and repeater activation records exist but are not drawn (the port's click path is not mapped).
- Comparator, hopper and other tile-entity cases were not probed.
- Door open/close sound is not played at click time; the server task plays it.
- While an overlay is active an unrelated updateBlock (for example fluids) relights from the real world, so predicted light can be lost for that moment.
- Streaming world: the swap detaches world.ringSink and world.blockTap for the put and write-back (fixed after the lead review; before it the relight was skipped whenever a ringSink existed). The light shadow in native mode keeps the predicted id until the real landing; the shadow flush relights from the real world at the next tick if the server task has not landed.
- Break cascade excludes dead bush, mushrooms, falling blocks, dust, rails, trapdoors (native client does nothing for the last four).
