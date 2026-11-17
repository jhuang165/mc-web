# Batch 78 spswing78: swing on declined block clicks, client prediction list, piston-moving click

## Summary
- Swing: `applyPlayerEdit` (player-edit-simulation.js) now swings a right click on a block only when native does. A client-activated block (block-activation.js table) swings at once as before; any other click swings after its outcome, unless the outcome is declined (begin-eating, begin-blocking, no-block-target, equip-armor, plant-seeds-failed, hoe-no-item, bone-meal-no-item, flint-invalid-position, `placement-*` refusals). The carrot planting swing is now the generic one (the explicit `hook('swing')` was removed).
- Prediction: `activatesOnClick` (client-prediction.js) is now `swallowsItemUse` plus the flower pot rule (swallows only when the held item is an accepted plant, via `potUse`) and the jukebox rule (only when loaded, meta != 0). `useKind`, `predictsPlacement` and main.js's throw check pass the world, cell and held stack. `bookOpensOnUse` (multiplayer/client-books.js) uses the same table (new `jukeboxLoaded` option; main.js passes it).
  Rows that differ from the old list (STATIONS, any jukebox, any flower pot, doors, chests): fence (60), nether brick fence (154), wooden button (124), comparator (127), powered comparator (128) now swallow; jukebox (178) only when loaded; flower pot (106) only for an accepted plant. Book screen additionally gains cauldron, fence, buttons, comparators (it used STATIONS + note + jukebox only).
- Piston moving: `remove-piston-moving` branch. Click on a moving block (not sneaking with an item) whose tile is gone removes it (`setBlockToAir`) and refuses the item use. The hook `pistonMovingTile(x, y, z)` is supplied by `redstone-runtime.js` applyEdit (`redstone.getTileEntity`); without the hook nothing happens.

## Evidence
- Bytecode-read `bao.am` (rightClickMouse): the block branch calls `bje.a(player, world, stack, x, y, z, side, hit)`; only a true result calls `bjk.ba` (swingItem). Otherwise the still-set flag reaches `bje.a(player, world, stack)` (sendUseItem), no swing.
- Bytecode-read `bje.a(yz,ahb,add,int,int,int,int,azw)` (onPlayerRightClick): activated = block.onBlockActivated unless sneaking with an item; if not activated and the item is an ItemBlock (abh) whose canPlaceItemBlockOnSide fails, returns false without sending the packet; sends C08; returns true when activated, false for a null stack, else `ItemStack.tryPlaceItemIntoWorld` (`add.a(yz,ahb,int,int,int,int,float,float,float)`, which returns `Item.onItemUse`).
- Bytecode-read `apr` (BlockPistonMoving) onBlockActivated: `if (!world.isRemote && world.getTileEntity(x,y,z) == null) { world.setBlockToAir; return true } return false`. So the CLIENT answer is always false. The b77 comment in block-activation.js ("apr true when its tile is gone") is wrong for the client; the table code was right to omit it; the header comment is corrected.
- Executed: b59 pot records (`prediction5-b59.test.js`, `pot-hold1-d0` result false) agree with the pot rule.

## Verification
- `node --test src/spswing78-b78.test.js`: 7 pass. Targeted run of 44 importers of player-edit-simulation, client-prediction, redstone-runtime, client-books: 561 pass, 0 fail. `npm run build` ok. No full npm test, no browser.
- Old-gap tests updated: `prediction5-b59` (block on a pot is placed on the client, was null), `mpbooks-b66` (empty jukebox no longer blocks the book).

## Follow-ups
- Swing for the hoe on an untillable block, bone meal on a non-growable block and a few other `Item.onItemUse` results was not bytecode-read; they keep swinging as before.
- The piston-moving removal swing for a held ItemBlock is approximated with `ITEMS[id].block` (the client world places and swings, the server then refuses).
- Server-side (multiplayer) piston-moving click removal is not modelled in the dedicated simulation (server-use.js is another track's).
