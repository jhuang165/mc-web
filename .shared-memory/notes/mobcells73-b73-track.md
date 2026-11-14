# Batch 73 mobcells73: eager cell stamps, one pickup pass, float sizes

## Summary
- `src/candidate-order.js`: `stampWalked(e)` (re-slice of one walked entity; an item's posY is `y + 0.125`), `stampPlayerCell(player)` (his posY is the eye, `feet + 1.62F`), `hasCell`. `posOf` now uses the eye for the key `"player"` so a lookup agrees with the stamp.
- `src/entities.js` (3 short hooks in `tickMobs`): unfiled walked entities are filed at the start of the pass; every walked entity is stamped after its own update (`sections()`, next to `trackSections`); the player is stamped at his slot in the list. Mobs, items, orbs, arrows, thrown entities, vehicles and the player no longer wait for a sweep or pick.
- New `src/pickup-order.js` (`collectPickups`): items and stuck arrows are taken in ONE pass in the world's list order. `item-entities.js` (`pickupCandidates`, `takeOne`; `collect` sorts), `bow.js` (`pickupCandidates`, `takeOne`; `collect` unchanged in result), `experience.js` (`collect` takes orbs in list order, so the first orb in the list gets the cooldown).
- `src/entity-simulation.js`: `finishEntitySimulation` runs `collectItemsAndArrows` where the item pickup was (the arrow pickup used to follow the thrown-entity events and mob events); each arrow's pop is flushed at once so it sits between the items' sounds. The old per-kind functions stay for the no-walk path.
- Sizes (task 3): `PHYSICS.width/height` = `fround(0.6)`, `fround(1.8)`; `ENTITY_TYPES` pig, cow, mooshroom, sheep, zombie, skeleton, creeper, slime, magma_cube; `PIGMAN`, `WITHER.width`, `FALLING_SIZE` (and the redstone-runtime copy), `entityBox` (weather.js), `entityHit` (scaled box), witch-potions player victim box now hold the setSize floats. Expectations in `bow.test.js` and `entities.test.js` changed to floats.
- Probe: `tools/probes/PickupOrderProbe.java`, `tools/verify-pickup-order.mjs`, `public/research/pickup-order-reference.json` (700 scenes). Tests: `src/mobcells73-b73.test.js` (6).

## Evidence
- Executed: the unchanged `World.getEntitiesWithinAABBExcludingEntity` over real chunks, then the real `EntityItem`, `EntityXPOrb`, `EntityArrow.onCollideWithPlayer` on a real `EntityPlayer` and `InventoryPlayer`. 439 of 700 scenes list in a non-insertion order, 502 mix kinds, 512 take more than one entity. The port (candidate order, items and arrows interleaved, orbs by cooldown) matches pickup order, final inventory, the orb taken and the arrow pop count in all 700 scenes. The pre-batch passes (all items by creation order, then arrows) give another inventory in 6 scenes and another pickup order in more.
- Executed: orbs have no delay (`sq.c` is only decremented, never set, so always 0) and share only the player's `xpCooldown` (2 after each orb): an orb never changes what an item or arrow does. Only the order of the orb's sound against the pop sounds inside one tick is not ported (see follow-ups).
- Bytecode-read / composed: the re-slice tail of `updateEntityWithOptionalForce` and the pickup loop `list = getEntitiesWithinAABBExcludingEntity(box.expand(1, 0.5, 1)); for each not dead: onCollideWithPlayer` (as in ChunkOrderProbe).
- Replay (port only): a two-item round trip over a chunk border through `EntityWorld.tickMobs`; with the hook removed the test fails (the lazy stamp lists them in creation order, the native one puts the returner last).
- Found: the item's `e.y` is its box bottom, so the old `posY ?? y` stamp would have been 0.125 low; the player's stamp must use the eye or a lookup at the feet restamps him across a slice border.
- Size audit (recalled from bytecode of earlier batches, list from the port): non-float values found and fixed are the ones above; items (0.25F, half 0.125), orbs (0.5F), arrows (0.5F), thrown, rockets and eyes (0.25F), skulls (0.3125F), fireballs (1.0F / 0.3125F), boats (1.5F x 0.6F), carts (0.98F x 0.7F), TNT (0.98F), paintings are exactly representable or already `fround`. Slime: `0.6F * size` is a float product, now `f(0.6) * size`.

## Verification
- `node --test src/mobcells73-b73.test.js`: 6 pass.
- 100 targeted files (village-fight*, entity-simulation*, projectiles*, bow, xp*, item-entities, living-simulation*, fireballs, weather*, falling, redstone, witch*, explosion*, player-*, slime, wither, vehicles, carts, boats, entity-list, entities): 1520 tests, 1518 pass first, the two failures were the float expectations above (now pass).
- Second group (133 files importing the changed simulation and server modules, concurrency 2): 1371 tests, 1371 pass.
- `node --check` on every touched file; `npm run build` once. Full npm test not run (batch rule).

## Follow-ups
- Orbs are still collected in `tickLivingSimulation` (before the walk's finish step), items and arrows after it: an orb's sound is queued ahead of the pops within one tick. Moving the orb pass into `collectPickups` needs the experience/level-up hook plumbed through `entityTick.state`.
- Server `collectArrows` / item pickup (`server-dispense.js`, `server-items.js`) are not interleaved (mpriders73 edits that area).
- Only a browser could show a pickup tie in play (which of two drops fills the last slot).
