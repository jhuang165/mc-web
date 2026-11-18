# spswing80 (batch 80)

## Summary
Swept the open right-click swing rows of batch 79 and gave multiplayer the same table.
- Minecart item (`spswing79-rules.js`): the client `ItemMinecart.onItemUse` answers true on any BlockRailBase (rail, powered, detector, activator) at any stack size, false elsewhere. `placeHeldMinecart` (`vehicle-simulation.js`) no longer refuses a size-0 stack as `no-rail`: it places the cart, swings and leaves -1 (attributes2 `minecartOnRail` count 0).
- Empty hand: no swing unless the client `onBlockActivated` answered true (`bje.a`: `if (stack == null) return false`). The single-player port already behaved this way; tests pin it.
- Order: `onBlockActivated` first (not when sneaking with an item), then the canPlaceItemBlockOnSide early return for an ItemBlock, then `onItemUse`. Rails have no `onBlockActivated`, so `player-actions.js`'s rail dispatch before `applyPlayerEdit` keeps that order.
- Spawn egg over water: with a block target, the client `onItemUse` answers true, the hand swings and `sendUseItem` is skipped, so `onItemRightClick`'s water trace never runs. `player-edit-simulation.js` now uses the water branch only when there is no block target. That branch never swings. With a target the egg is used on the block (`useEggOnBlock`).
- Slabs (`ItemSlab`, aeg): a stack of size 0 gives false. A merge into the clicked half (side 1 of a bottom half, side 0 of a top half, same type), or into a same-type single slab of either half in the cell on the clicked side, returns TRUE even when `checkNoEntityCollision` refuses the double slab. New `slabMerges` row in `clientUseResult`. The port's `placement-player-collision` merge now swings. Every other slab click falls to ItemBlock (the placement outcome).
- Snow layers (`ItemSnow`, aec): `checkNoEntityCollision` tests the layer's CURRENT box ((meta & 7) / 8 high, read before setBlockMetadata), not the stacked one. On failure the click falls through to `ItemBlock.onItemUse` instead of refusing. `block-placement-simulation.js` changed to match, so a player standing on the snow can stack it now (the old code tested the taller box and refused).
- Adventure: no effect on the right-click swing in 1.7.10. `onPlayerRightClick` has no game-type test. `canPlayerEdit` is `allowEdit || stack != null && stack.canEditBlocks()`, and `Item.canItemEditBlocks` (adb.v) is `return true`, overridden by no item class. `isCurrentToolAdventureModeExempt` is used only by the hit/break paths. `CanPlaceOn` is 1.8. A test checks that survival and adventure give the same swings.
- `ItemEmptyMap.onItemRightClick` (acl) does not swing: `use-empty-map` no longer calls `hook('swing')`. `ItemFishingRod` (acv) is the only item class that calls `swingItem`.
- Multiplayer: new `src/right-click-swing.js` holds `rightClickSwings` and `clientItemUse`. The swing table is spswing79-rules plus: bone meal by `boneMealCanFertilize` (new export in `bone-meal.js`), seeds and wart by soil plus side 1 plus air above, the sign by a read-only `placeSign` dry run, and ItemBlocks and doors by `dryPlace`. The fishing rod always swings; an entity or no target never does, except flint and steel on a creeper (EntityCreeper.interact calls swingItem, b77). In main.js's multiplayer `edit` branch, a right click now swings only when `rightClickSwings` says so. Right-clicking a remote vehicle no longer swings, and neither does opening the book screen.

## Evidence
- Bytecode-read (`javap -c -p`, minecraft-1.7.10.jar): `adj.a` (ItemMinecart.onItemUse), `aeg.a` x3 (ItemSlab onItemUse, func_150936_a canPlaceItemBlockOnSide, private func_150946_a), `aec.a` (ItemSnow.onItemUse), `ann.a(ahb,III)` (BlockSnow collision box), `aee.a(add,ahb,yz)` (ItemMonsterPlacer.onItemRightClick: no swing), `bje.a(yz,ahb,add,IIII,azw)` (onPlayerRightClick order), `bao.am` (rightClickMouse: true clears the flag, so there is no sendUseItem), `add.a` (tryPlaceItemIntoWorld = onItemUse + stat), `yz.a(IIIILadd;)` (canPlayerEdit), `yz.d(III)` (adventure exempt), `adb.v` (true) and its non-overrides, and the classes that call swingItem (`acv` only). `acl` (ItemEmptyMap) does not call swingItem.
- Executed (existing records): `attributes2-reference.json` and `neg-stacks-reference.json` `minecartOnRail` (count 0 gives used, spawned 1, after -1); `adventure-reference.json` (canItemEditBlocks per item).
- Port-read: the existing seed, wart, sign and ItemBlock placement checks reused for the multiplayer table, and the port's snow collision boxes ((meta & 7) / 8, checked in a scratch run).

## Verification
- `node --test src/spswing80-b80.test.js`: 11 pass.
- The 57 test files that import the touched modules, plus attributes2 and neg-stacks 1-3: 555 tests, 554 pass before the update below, then all pass. Old gap updated: `block-placement-simulation.test.js` "snow stacking ... rolls back on real player collision" expected `player-collision`. It now expects the ItemBlock fall-through (cell above, layer kept at 5), and the file passes 7/7.
- 15 tests that read main.js text (books, prediction, multiplayer survival, block clicks): 133 pass.
- `npm run build`: ok. No full npm test. No browser checks.

## Follow-ups
- Browser-only: the multiplayer arm swing (block click, empty hand, vehicle, book) and the single-player slab and snow swings on screen.
- Snow and slab `checkNoEntityCollision` still test only the player, not other entities (mobs, items do not count; carts and boats should).
- The ItemSlab merge into the side cell when the clicked block is a one-layer snow or a vine (port `p` = clicked cell) was not reconciled with native func_150946_a (always the offset cell).
- In multiplayer, a right click on a remote mob that `predictAnimalUse` declines does not swing; native would also run `interactFirst` on the client entity, which the port does not model for every mob.
