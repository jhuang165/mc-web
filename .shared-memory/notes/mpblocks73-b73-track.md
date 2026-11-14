# Batch 73 mpblocks73: block-placing items on the dedicated server

## Summary
- `src/multiplayer/server-place.js` (new): `placeBlockItem(sim, p, target, id)` runs the single-player modules for the bed (`bed.js placeBed`), the cake item (`stems-cake.js cakePlacement`, `doorReplaceable`) and the hoe (`Farming.till`, `hoeSound`, one point of wear). Nothing is copied.
- `src/multiplayer/simulation.js`: one import and one line in `edit` before `placeHeldBlock` (counts the use stat on success); the skull call now passes `stack` so a player head keeps its SkullOwner profile (`server-wither.js place` too).
- `src/mpblocks73-b73.test.js` (9 tests) drives `DedicatedSimulation` with `rules.chunkStream = false`.

## Evidence
Table of the item sweep (executed: every item id, damages 0-5, 8, 15, clicked on the top of a stone-floor block, the server against `applyPlayerEdit` on the same flat world, compared by the cells that changed).

| Item | Server before | Now |
| --- | --- | --- |
| Cake (1930) | nothing placed | placed (ItemReed rule) |
| Bed (472) | nothing placed | both halves, facing, foot/head metadata |
| Hoes (120-124) | nothing happened (no tilling at all on the server) | tills, wear, step sound |
| Skull (damage 0-5) | placed, tile reached players, but no SkullOwner profile | profile from the stack |
| Sign, skull, seeds, nether wart, reeds, doors, redstone dust, string, repeater, cauldron, brewing stand, flower pot, slabs, snow layers, stairs, torches, rails, hoppers, chests, ... | same cells as single player | unchanged |
| Flint and steel, fire charge | differ only because the sweep's single-player fire stub did nothing | n/a |
| Snowball, egg, pearl | throw entities, no block change | n/a |
| Bone meal (ink sac 15) | differs by random growth rolls, not a placement rule | n/a |

- Tile entities: a skull's type and rotation and a sign's text reach other players through the existing `describeCell` (`tiles` in the tick), asserted in the test. Bed halves and cake are plain block changes in `changes`.
- Client prediction (`client-prediction.js dryUse`, `useKind`): the cake is already predicted (kind `use`). Bed, sign and skull are not predicted on purpose (client-predict-reference.json: those items return early when `isRemote`). ItemHoe sets the block only on the server natively (recalled), so the hoe is not predicted either.
- Rules read from the existing single-player modules and their executed references (`bed-reference.json`, `attributes2-reference.json`); I did not re-read `ItemReed`/`ItemBed` bytecode this round (recalled otherwise).

## Verification
- `node --test src/mpblocks73-b73.test.js`: 9 pass. `node --test src/mpwither-b63.test.js src/mpwither-b64.test.js src/cakefog-b72.test.js src/skull.test.js src/block-clicks-b52.test.js`: 36 pass.
- `npm run build`: ok. Full npm test not run (batch rule). Nothing checked in a browser (bed/cake meshes on a second client, the hoe sound doubling).

## Follow-ups
- Place sounds for the new items (bed/cake) are not sent by the server (the server's place path sends none for any block here).
- Remote block-entity NBT for skull profiles belongs to nbtexport73; client tile maps to streamfix73.
