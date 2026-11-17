# spswing79 (batch 79)

## Summary
The hand swing after a right click on a block now follows each item's client-world `Item.onItemUse` answer (`Minecraft.rightClickMouse` swings only when `onPlayerRightClick` returns true). New `src/spswing79-rules.js` holds the table; `applyPlayerEdit` (`src/player-edit-simulation.js`) reads it before the click and falls back to the old outcome when it returns null.
- Hoe: swings only for side > 0, grass or dirt, air above (no stack or remote test).
- Bone meal: swings only when `func_150919_a` fertilised (IGrowable + canFertilize); cocoa beans only on side 2-5 of a jungle log; other dye never.
- Flint and steel (even at an invalid position), fire charge, spawn egg (on a block), bed: always true. Spawn egg on water swings only with a target.
- ItemReed family (sugar cane, cake, repeater, comparator, brewing stand, cauldron, flower pot): true unless the stack size is 0. Redstone: snow layer or air on the clicked side. Skull: side > 0 and solid clicked block. Lead: only on the two fences.
- Firework: false on the client (`acs` returns `!isRemote`); `fireworks-live.js` no longer swings. Painting and item frame: swing only for sides 2-5 (`hanging-interaction.js`).
- Piston-moving click: swing = the held block's dry-run placement result (replaces the `!item.block` approximation).
- diamondsToYou: a mob that picks up a diamond (`pc` item 264, live id 303) carrying a thrower name awards the thrower. `pickUpLoot` takes an `onPickup` callback, `entities.js` `lootPickupOne` calls `mobs.thrownDiamond(name, item)`; hooked in `main.js` (thrower == player) and `server-mobs.js` (online player by name, `achievements.award`). Single-player Q drops (`dropHeld`) now set `thrower`; container-close drops do not. The server player-collect path already existed (b60). The achievement parent check is left to `Achievements.trigger` / the client (a locked parent is silent).

## Evidence
All Bytecode-read (`javap -c -p` of `ada acj acw acq aee abg acs abi ads aeb adz ach adw adv acz adj adf apr xk sw yz` in minecraft-1.7.10.jar). No executed probe was written. The Port-read part is the port's existing placement/dry-run logic reused for piston-moving and the ItemBlock/sign/door/seed rows, which already match.
Not found a native check of `thrower != collector` in the mob branch; the port awards the thrower regardless (Bytecode-read of `sw.e`, mark as open for a second read).

## Verification
- `node --test src/spswing79-b79.test.js`: 10 pass. `spswing78-b78.test.js`: 7 pass.
- 71 importer test files (player-edit-simulation, client-prediction, hanging, fireworks, mob-equipment-live, server-mobs, entities users): 698 pass, 0 fail. No existing test encoded an old gap.
- `npm run build`: ok.

## Follow-ups
- Minecart on rail with a size-0 stack: native true, port returns `no-rail` without a swing.
- Spawn egg on water with a block target is still approximate.
- ItemSlab, ItemSnow not swept. Sign `empty-stack` and range edges. `canEdit` and adventure mode ignored in the swing.
- Mob-pickup diamondsToYou second read of `sw.e` for the thrower/owner condition; no multiplayer test for the server hook.
