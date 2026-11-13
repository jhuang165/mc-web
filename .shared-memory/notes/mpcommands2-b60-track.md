# Batch 60 mpcommands2: server-side achievements (crafting, smelting, thrown diamonds, kills, biomes, beacons)

## Summary
- `src/multiplayer/server-achievements.js` (new): `ServerAchievements`, built as `simulation.achievements`. Awards queue `{type:'award', id, achievement}` in `simulation.events`; `ServerSocial.drain` unlocks them and sends the batch 58 first-unlock chat line.
  - Entry points (player record `p`): `onCrafted(p, stack)`, `onSmelted(p, stack)`, `onPotionTaken(p, stack)`, `dropThrown(p, all)`, `award(p, achievementId)`.
  - `tick()` (called in `DedicatedSimulation.tick`): exploreAllBiomes every 20 ticks and fullBeacon for players near a pyramid, through the per-player `Achievements` of `ServerSocial` (`sink`).
  - `watchMobs(mobs)`: the existing `achievements-live.js watchMobs` on the server EntityWorld; `ServerMobs.attack` sets `attacker` for the call, so killEnemy, snipeSkeleton and overkill go to the player whose hit runs.
- `src/item-entities.js`: items keep a `thrower` name, saved and loaded.
- `src/multiplayer/server-items.js`: a collected stack calls `achievements.diamondsToYou(collector, stack, entity)`.
- `src/multiplayer/server-containers.js`: the furnace window's smelt callback calls `onSmelted` (the 2x2 and workbench windows belong to other tracks).
- `src/multiplayer/simulation.js`, `server/server.js`, `src/multiplayer/client.js`, `src/main.js`, `src/server-broadcast.js`, `src/multiplayer/server-mobs.js`: short hooks. New wire message `achDrop {all}` (client `dropHeld(all)`): Q and Ctrl+Q over a connection; the server drops the item with the thrower and corrects the slot by S2F. Before, Q in multiplayer dropped a local item the server never saw.
- `src/mpcommands2-b60.test.js`: 9 tests.

## Evidence
- Bytecode-read (javap, 1.7.10 jar): `xk.b_` (EntityItem.onCollideWithPlayer) returns on the client; after a successful `addItemStackToInventory` it awards diamondsToYou (`pc.x`) to the thrower when the item is a diamond, `Thrower` is set, `World.getPlayerEntityByName` (String.equals) finds that player and it is not the collector. The collector gets diamonds, mineWood, killCow, blazeRod as before. NBT keys `Thrower` and `Owner`.
- Bytecode-read: `yz.a(add, boolean, boolean)` sets the Thrower only when the third argument is true. Only `dropOneItem` (`yz.a(boolean)`, Q) passes true. The container close and click outside (`yz.a(add, boolean)`) pass (false, false) and death drops (true, false). So the brief's "inventory-close drops carry the thrower" is wrong: only Q does. The test pins it.
- Bytecode-read (note b59): `aax`/`aak` crafting and smelting slots trigger the achievements; `nh.a(is)` openInventory is server-side (already wired in b59).
- Recalled: server kill credit in 1.7.10 goes to the recent attacker even after a delayed death; here only a death inside the attacking call counts.
- Executed: only node tests (no Java probe).

## Verification
- `node --test src/mpcommands2-b60.test.js`: 9 pass. All 693 tests of the files mentioning multiplayer, server-broadcast, item-entities or achievements: 693 pass. `npm run build` ok. Full npm test not run (batch rule). No browser check.

## Follow-ups
- Lead wiring at merge: mpstations workbench and mpinventory 2x2 grid must call `sim.achievements.onCrafted(p, resultStack)` when the output slot is taken; mpcontainers2 brewing window `onPotionTaken(p, stack)`; furnace is wired. `dropThrown` is the server half of Q; if mpinventory adds its own drop message, route it to `sim.dropHeld(id, all)` (or `achievements.dropThrown`) and remove `achDrop`.
- Still client-only on a server: portal, theEnd, theEnd2 (no dimensions), onARail (no minecarts), flyPig (no riding), breedCow, ghast, spawnWither, killWither, enchantments/bookcase crafting only once the enchanting windows exist (the blocks are crafted via `onCrafted`), potion, killCow from non-pickup. Furnace XP orbs are not spawned by the server furnace window.
- Not run in a browser: the client sending `achDrop`, the Q-drop slot correction.
