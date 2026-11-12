# Batch 55 instantbreak track

Branch `batch55-instantbreak` (from be55d463b). Labels: executed = run on real 1.7.10 classes; bytecode-read = read from the jar or earlier notes; port = port mechanism with no native class.

## Summary
- **Client prediction overlay (`src/client-prediction.js`, port).** The world is one shared object, so the server half (the queued break or placement, run in the network tick after the entity walk) stays where it is. The client half is an overlay: cell -> predicted block and meta, with a per-task token. `view` (Object.create(world)) answers get/getMeta from the overlay; every mutator goes to the real world. An entry ends when its queued task starts; a cell the server left unchanged (refused, changed cell, failed accept) is rebuilt from the real world (the S23).
- **Breaks.** `breakBlockPacket` (survival finish, instant, creative; all non-multiplayer queued paths) now predicts: it plays the break sound and the destroy particles at once from the client view's block, shows the cell as air, and the queued run skips those two effects (`muteBreakFx`), so they happen once.
- **Placements.** `clickEdit` predicts a right click on a block only when the held item is a plain ItemBlock and the aimed block does not take the click (`predictsPlacement`: STATIONS, doors, chests, cauldron, pot, jukebox; sneaking places past them). `dryPlace` runs the real `placeHeldBlock` against a copy-on-write world with stubbed survival take/wear, tile maps and farming, and the real client place sound hook. The written cells become the overlay; the queued run mutes only the placement sound (`mutePlaceSound`). A client-refused placement shows nothing and plays nothing.
- **Readers.** `Scene.buildChunk` meshes from the predicted view while an overlay is active (`scene.predicted`, `showPredicted(x, z)` rebuilds the cell's chunk and touching neighbours); worker snapshots are skipped meanwhile (they read the real world). The aim ray (`raycast`) and the client player's movement state use `clientWorld()`.
- Tests: `block-clicks-b51.test.js` regexes updated for the new push and run loop.

## Evidence
- Bytecode-read (b52 digstart note, `PlayerControllerMP.clickBlock/onPlayerDamageBlock/clickBlockCreative`, `onPlayerDestroyBlock`; `ItemBlock.onItemUse` on the client world): the destroy and the placement happen on the client world before the packet is handled; the server confirms or corrects with S23. Not re-read or executed in this batch (no new probe): the order claim rests on those earlier reads.
- Executed in node (`src/instantbreak-b55.test.js`): overlay semantics, token handling, aim ray through a predicted break and onto a predicted placement, `dryPlace` writes equal the real `placeHeldBlock` writes for cube, log, stairs, slab, wall torch, rail, fence gate, trapdoor, chest, pumpkin (and leave the world and tile maps untouched), refusal gives no cells and no sound, `predictsPlacement` gates, and the column mesh from the predicted view equals the mesh of the world with the block removed (positions). main.js wiring is pinned by source regexes, not run.

## Verification
- `node --test` on every test file matching main.js, scene.js, player-edit-simulation, mesh-region or mining (43 files): 543 tests, 542 pass, 1 failed (`block-clicks-b51` regexes, fixed); after the fix `node --test src/block-clicks-b51.test.js src/block-clicks-b52.test.js src/dig-abort-b54.test.js src/dig-finish-b53.test.js src/instantbreak-b55.test.js src/melee-order-b50.test.js`: 33 pass. `npm run build` passes. Full `npm test` not run (batch rule). No browser check was made.

## Follow-ups
- The predicted cell is not relit: the light volume changes when the real change lands, so a mined cell can look dark for up to one tick; native recomputes client light at once.
- Only the single cell is predicted for a break: a door's other half, a bed's other half, a piston head or neighbour updates (floating torches, falling sand) change when the real break runs. Placement prediction covers only plain ItemBlocks; doors, beds, signs, skulls, cake, seeds, buckets and items using their own branch still wait for the walk.
- Each predicted change meshes the touching columns twice (predicted, then real); not profiled.
- Held-dig `getBlock` in `tickMining` still reads the real world.
- Multiplayer is untouched (it sends the click and waits for the server).
- The server range check (`serverAcceptsClick`) is not applied to the prediction; a click beyond it is drawn, then reverted.
