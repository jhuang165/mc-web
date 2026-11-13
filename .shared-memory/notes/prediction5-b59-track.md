# Batch 59 prediction5: pots, bucket stacks, command block screen, dragon egg, splash potions, fire

## Summary
- `tools/probes/ClientPredictProbe.java`, `tools/verify-client-predict.mjs`, `public/research/client-predict-reference.json`: 258 records (was 241). New: 8 flint-and-steel `use` records (with item damage and sounds), 5 fire `break` records, pot tile content (`potTile`) on every pot record, a `blockclick` case (Block.onBlockClicked) and `dragonegg-activate`, a bucket stack with a full inventory (`spawned`), a drinkable potion `throw`. The probe now calls `alb.e()` (BlockFire flammability table, which Bootstrap runs in the game).
- `src/client-prediction.js`: `clientNeighbourChange` handles real fire (`fire.js canPlace`); `dryFlint`; `dryPot`; overlay `pots` (a predicted pot plant per cell, served as `view.pots`, ended with the cell's entry); `heldPlan` / `applyHeldPlan` gain `dDamage` (flint) and `give` (the filled bucket goes to the first free slot, relative undo); `useKind` returns `egg`, `command`, `pot`, `flint`; `throwsPotion`.
- `src/dragon-egg-live.js`: `clientDragonEgg` split out; `useDragonEgg(..., skipClient)`.
- `src/player-edit-simulation.js`: a Survival dig start of a dragon egg runs the client half at once (`clientDragonEgg` hook); the queued server half skips it.
- `src/main.js` (hooks): `predictPlace` handles the new kinds; the egg's right click runs the client half at the click; the command block screen opens at the click (`openCommandBlock(..., atClick)`), only the apply step keeps the creative and cheats gate; splash potions are throws.
- Tests: `src/prediction5-b59.test.js` (8). Updated `block-clicks-b52`, `instantbreak-b55` (regex) and `prediction4-b58` (loops now skip flint and the drink; a bucket stack now gives one).

## Evidence
- Executed (unchanged 1.7.10 classes, isRemote world): flint sets fire at the adjacent air cell, then an unsupported fire is gone (`flint-bottom`, `flint-unsupported-air`), water cell: no fire, no sound, stack still damaged by 1, stack size unchanged; BlockFire.onNeighborBlockChange removes an unsupported fire and keeps one with a flammable side or top neighbour; pot: tile item and data set, meta = damage, stack minus 1 (Creative keeps it), stone and empty hand refused; empty bucket stack of 2 or 16: held count minus 1, filled bucket in slot 1; with 36 full slots the client spawns one entity (the drop); dragon egg: 128 `portal` particles, no block change, for onBlockActivated and onBlockClicked; command block with a tile reaches EntityPlayerSP.a (screen) for a non-creative player; splash potion stack minus 1, drinkable potion keeps its count, no entity on the client.
- Bytecode-read: `acw` (ItemFlintAndSteel) has no isRemote check and always calls damageItem(1); `bje.b(IIII)` (clickBlock) calls Block.onBlockClicked on the client world when the block is not air and the damage is 0 (Survival; Creative breaks instead).
- Recalled: the client's own `playSoundEffect` is silent, so the ignite sound is the server's S29 (from b58). The client's Creative flint skips damageItem (ItemStack.damageItem creative guard).

## Verification
- `node --test` on prediction5-b59, prediction4-b58, client-predict-b56/b57, instantbreak-b55, block-clicks-b51/b52, player-edit-simulation, buckets*, clientfire-b58, crystal-fire-b57, end, command-block*, stone-utility, potion-use, player-throw*: 173 pass, 0 fail. All tests that import the changed modules or read main.js: 138 pass, 0 fail.
- `node tools/verify-client-predict.mjs`: 258 records. `npm run build`: ok. Full npm test not run (batch rule). No browser check.

## Follow-ups
- Gaps closed: (1) pots, (2) bucket stacks, (3) command block screen, (4) dragon egg particles (the gap was timing, the port already modelled the client branch), (5) splash potions, (6) fire losing support, (7) flint fire.
- Command block: the screen opens for any player at the click as natively; the server's MC|AdvCdm refusal is kept as the creative and cheats gate on the apply. The port's tile always exists, so "tile known" is always true.
- Full inventory on a bucket stack: the client's drop entity is not drawn (the server's drop arrives). Flint that breaks the tool is left to the server (no prediction). Unbreaking on the client's damageItem is not modelled.
- Browser only: the pot plant appearing at the click, fire appearing before the ignite sound, the egg's portal trail at the punch, the screen opening at the click.
