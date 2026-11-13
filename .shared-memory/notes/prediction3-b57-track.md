# Batch 57 prediction3: client prediction, part 3

## Summary
- `tools/probes/ClientPredictProbe.java` + `tools/verify-client-predict.mjs`: 34 new `bucket` records (ItemBucket.onItemRightClick run for real on an isRemote world, with the player's view trace) and 4 `serveruse` records (bed, sign, skull on a server world). The reference now has 172 records.
- `src/client-prediction.js`: `dryBucket` (empty bucket removes a water or lava source, full bucket sets its liquid beside the traced face, Nether refuses water), `tracedBucket`, `activateSound`, button (pressed bit) and repeater (delay +4, wraps) in `dryActivate`, cocoa beans in `useKind` (new `heldDamage`), `useKind` kind `bucket`. The draw / revert bookkeeping moved out of main.js as `drawPrediction` / `revertPrediction` so a test can run the refusal cycle.
- `src/main.js` (small): imports; `showPrediction` / `revertPrediction` call the module; `predictPlace` handles `bucket` and plays the door / trapdoor / gate / button sound at the click; a bucket click with only water under the cursor is deferred and predicted (`defersToNetworkTick`, `clickEdit`); the `playSound` hook honours `mutePlaceSound`, so the queued run does not repeat the click-time sound.
- Tests: `src/client-predict-b57.test.js` (9). Two older regex pins (`block-clicks-b51`, `instantbreak-b55`) now match the widened `target || tracedBucket(...)` condition.

## Evidence
- Executed (unchanged 1.7.10 classes, isRemote true): bucket records (pick-up of sources only, flowing water m3 and lava m5 untouched, creative keeps the empty bucket but still removes the source, placement at the traced face for top, side, bottom, over a torch or tall grass, into flowing and still liquid, Nether water refused and Nether lava placed, reach 4.9 blocks hits and 5.1 misses); cocoa, lead, bed, sign, skull, button and repeater records from b56 (cocoa draws a cocoa block, button 77 meta 1 -> 9, wooden button 143 -> 9, repeater meta m -> m+4 mod 16).
- Executed: ItemBed / ItemSign / ItemSkull on a server world draw their blocks (bed 2 cells, sign 1, skull 1) while the client-world records stay empty, so the early return is the isRemote guard.
- Bytecode-read (`javap -c` on abo, adb, ajs): `Item.getMovingObjectPositionFromPlayer` fixes the reach at 5.0 (no EntityPlayerMP branch in 1.7.10) and traces from y + 1.62 - yOffset; the bucket does not check isRemote for the pick-up or the placement; BlockButton.onBlockActivated plays `random.click` 0.3 / 0.6 through `World.playSoundEffect` on the client world.
- Recalled: the server sends aux 1003 to every player but the clicker, so the door sound at the click is the client's alone; blocks reach 4.5 survival / 5 creative from the aim ray.

## Gaps found wrong
- Leads: ItemLead.onItemUse changes no block on the client (record diff empty); the knot arrives as an entity from the server. Nothing to predict.
- Beds, signs, skulls: the client changes nothing (isRemote returns). Nothing to predict.
- Lever: BlockLever returns early on the client; the port's task-time toggle matches native timing plus the network tick.
- "Server range check not applied to the prediction": native draws and the server reverts. The aim ray already is the client's range (4.5 / 5). Server limits (8 blocks from the feet for a place, 6 from the eye for a dig) are wider than the ray, so only the build limit and a moved player can refuse in practice. `drawPrediction` / `revertPrediction` replay draw, refuse, revert in a test (also for accepted clicks, which skip the rebuild).

## Verification
- `node --test src/client-predict-b57.test.js src/client-predict-b56.test.js src/instantbreak-b55.test.js src/block-clicks-b51.test.js src/block-clicks-b52.test.js src/dig-abort-b54.test.js src/dig-finish-b53.test.js src/melee-order-b50.test.js src/player-edit-simulation.test.js src/block-placement-simulation.test.js src/block-placement-replace.test.js src/block-break-simulation.test.js src/directional-placement.test.js src/piston-scene.test.js src/buckets-simulation.test.js src/buckets.test.js src/player-actions.test.js src/player-throw-simulation.test.js`: all pass after the two regex updates (123 + 35 runs, 0 fail).
- Streaming-world relight (new test): on `javaStreamed` with `StreamingLight` native, a predicted roof break lights the cell below at once, the world tap is not told, a refusal restores the shade, the shadow ids follow, and the next tick's flush has nothing stale.
- `npm run build`: ok. Full `npm test` not run (batch rule). No browser check.

## Follow-ups
- The held item does not swap at the click (the bucket becomes a water bucket, a cocoa bean count drops) until the queued task runs; only blocks are predicted.
- The wooden button has no right-click press in the port's click path at all (`redstoneActivate` knows lever, stone button, repeater), so it is not predicted either; the probe record shows native presses it.
- A server-sent S29 click sound after the client's own may double the button click natively (World.playSoundEffect reaches the clicker); the port plays it once, as b55 does for placements. Unverified.
- Comparator, hopper and other tile-entity cases were not probed. The Nether water fizz and smoke are not shown at click time (the server task plays them).
- Browser check not done: a bucket on water with the queue delay, and a door sound heard once at the click.
