# Batch 58 mpeating: remote eating and drinking crumbs and sounds

Branch `batch58-mpeating`. Labels: executed = run on the unchanged 1.7.10 classes; bytecode-read = read with javap; recalled = not checked.

## Summary
- `src/multiplayer/remote-eating.js` (new): the client half of `EntityOtherPlayerMP.onUpdate` + `EntityPlayer.onUpdate`. The synced `using` flag starts an item in use (32 ticks for food and milk), the count falls every tick, and while it is 25 or below and a multiple of 4 five `iconcrack_<id>` crumbs spawn from the held food's icon (while the flag stays set the count keeps falling below zero, so crumbs continue at 0, -4, ...). A changed held stack or the flag falling clears it. `remoteEye` is posY + 1.82F with the Java yaw and pitch in degrees.
- `src/multiplayer/presence.js`: each remote entry has a use state and its own `JavaRandom` (Entity.rand); `sync` runs the state each server tick and spawns crumbs with `itemCrumbs`.
- `src/multiplayer/simulation.js`: the server plays the sounds, as 1.7.10 does. `tickUse` queues `random.eat` (volume 0.5 + 0.5 * nextInt(2), pitch (f - f) * 0.2 + 1 from the player's Entity.rand, after the three draws per crumb) or `random.drink` (world rand) on the same 4 tick schedule, once more at the finish (n = 16), and `random.burp` for food. `deliverSounds` sends each one to players under 16 blocks (squared distance from the feet to the other player's posX/Y/Z, posY = feet + 1.62); eat and drink skip the eater, the burp does not.
- `server/server.js` sends `{type:'sound', sounds}`; `src/multiplayer/client.js` has `onSound`; `src/main.js` plays them (names limited to eat, drink, burp; values must be finite). Two small main.js edits.
- `tools/probes/MpEatingProbe.java`, `tools/verify-mpeating.mjs`, `public/research/mpeating-reference.json`, `src/mpeating-b58.test.js` (5 tests).

## Evidence
- Executed: `EntityPlayer.updateItemUse(stack, n)` (yz.c) on an `EntityOtherPlayerMP` (bll): 18 records (apple, bread, golden apple, fish metas, cookie, steak at n = 5 and 16; milk and potion drink; sword and bow). Crumbs are n `iconcrack_<id>[_<meta>]` spawnParticle calls with exact positions and velocities (replayed with the shared Math.random stream); food makes one `random.eat` after the crumbs on the same Entity.rand; drinks make one `random.drink` and no crumbs; sword and bow make nothing.
- Bytecode-read: `EntityPlayer.onUpdate` count rule; `EntityOtherPlayerMP.onUpdate` (flag `isEating()` with a held stack starts `setItemInUse(stack, maxDuration)`, flag gone clears it); `EntityOtherPlayerMP` does not override `playSound`, so `Entity.playSound` goes to `World.playSoundToNearExcept(player, ...)`, and `RenderGlobal.playSoundToNearExcept` has an empty body. Only `EntityPlayerSP` overrides it. So a remote player's eat and drink sounds are never made by the client; they come from the server's `WorldManager.playSoundToNearExcept` (S29, range 16, `sendToAllNearExcept`). `RenderPlayer` changes the third-person pose only for `EnumAction.block` (heldItemRight 3) and `bow` (aimedBow), so eating has no pose and none was missing. `EntityPlayerMP.onItemUseFinish` sends status 9 to the eater only, so remote players see no 16-crumb burst at the finish. `ItemFood.onEaten` plays `random.burp` (0.5, world rand f * 0.1 + 0.9) through `World.playSoundAtEntity`, a server sound for everyone in range including the eater; `ItemBucketMilk` has no sound.
- Gap wrong: the brief's "burp is local-player only" is not what 1.7.10 does. The burp is a server sound that other players hear. In this build the local single-player burp is still the existing local sound.
- Recalled: `WorldManager.playSound` uses the same range rule as playSoundToNearExcept (the bytecode shows the 16.0 or 16.0 * volume range in both).

## Verification
- `node tools/verify-mpeating.mjs`: 18 records.
- `node --test src/mpeating-b58.test.js src/mp-dig-b57.test.js src/multiplayer*.test.js src/dedicated*.test.js src/fx.test.js src/player-item-use.test.js`: 47 pass.
- `npm run build` passes. Full `npm test` not run (batch rule). No browser check.

## Follow-ups
- This build's item ids differ from vanilla, so crumbs use `iconcrack_<ourId>` (as the local eating does); the vanilla `_<meta>` suffix has no counterpart.
- Eating and drinking still change no food, saturation or potion state on the server; the burp plays even when nothing was gained (as natively the item's onEaten runs regardless).
- A multiplayer client that eats locally also plays its own local burp and eat sounds; the server's sounds skip the eater for eat and drink but the burp reaches the eater too, so a Survival multiplayer client would hear the burp twice once it eats against a server. The dedicated client does not eat in Survival yet.
- No browser or WebSocket test of the `sound` message beyond the simulation.
