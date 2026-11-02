# Mineshafts in live worlds (GEN-05b integration)

Current live status (0.25.0): new Java worlds use **generation version 11** with the full ported Overworld population chain and mineshafts in their native population position. V9/v10 saved-world paths remain unchanged. Twelve native area replays and the live mapping pass; see [live population](population-live.md) for order/edges, content, saves, timing, browser evidence and explicit losses. The version-specific sections below retain the earlier standalone/v10 evidence.

Target: Minecraft Java 1.7.10. This page covers how the generated mineshafts (`src/mineshaft-world.js`), their cave spider spawners (`src/mob-spawner.js`) and their chest minecarts (`src/minecarts.js`) reach a world you play in. It does not mean full mineshaft or minecart parity.

## What is live

- **Generation version 10.** New Java landscapes (default, amplified, large biomes) are created at version 10, which runs the mineshaft population after caves and ravines. Legacy landscapes stay at 8. A save keeps the version it was created with, so version 9 Java saves regenerate byte for byte as before. The SHA-1 of all chunk blocks and metadata matches the committed build for seed 0 default, seed 17 default, seed 10 amplified and seed 0 large biomes. `main.js` imports `block-registry.js` statically and calls `setOriginalBlockMapper` before any World is built.
- **Spawners.** On a world's first launch every generation record becomes a `MobSpawners` tile entity. Each tick:
  - **Server tick** (`tickSpawnerSimulation`). Runs after the living-entity tick and is fed by `EntityWorld.spawnerHooks`. Sky light, block light and thunder light come from the scene's light volume, and carts count for `checkNoEntityCollision`. Each spawn plays the aux 2004 burst: 20 smoke and flame pairs drawn from the client world Random.
  - **Client tick** (`tickSpawnersClient`). Runs beside `displayTicks`. It uses the eye position, which drives the smoke and flame and the display mob's spin.
  - **Display mob.** Within 64 blocks it renders through `MobRenderer` using `spawnerDisplayEntity`. The cave spider texture and its eyes load.
  - **Breaking.** `watchSpawnerBlocks` removes the tile entity when its block is broken.
- **Chest minecarts.**
  - **Ticking.** `tickMinecartSimulation` runs after the non-living entity segment. The player and live mobs are the pushable boxes that block a cart's move. `pushEntity` returns the `applyEntityCollision` share, which is added to the player's and the mobs' velocity. Spilled and broken-cart items go to `ItemEntities.spawn` with the native motion and delay.
  - **Picking.** The crosshair picks a cart with the 0.1 collision border, at mob reach (5 creative, 3 survival) and before the block hit. The nearer of a mob and a cart wins, and the block outline is hidden while a cart is aimed.
  - **Attacking.** A left click swings and hits with the held item's attack damage (`heldAttackDamage`, shared with mob attacks), with no critical hit and no tool wear. A sprint hit knocks the cart back. The player's motion is multiplied by 0.6, and exhaustion is 0.3.
  - **Breaking.** Survival breaks the cart once damage exceeds 40, dropping its contents plus a Minecart and a Chest. Creative breaks it at once and spills only the contents.
  - **Using.** A right click opens the 27-slot "Minecart" chest screen. The screen closes once the cart is dead or more than 8 blocks away.
  - **Rendering.** `MinecartRenderer` draws each cart and is cleared on every world switch.
- **Minecart item.** Original item 328 is now browser item 366. It is listed in the Transportation tab and in search, and it is crafted from five iron ingots in the native `"# #", "###"` shape. It is inert: it cannot be placed on rails.
- **Rails and torches.** `Rails` and `Torches` watch neighbour changes, so an unsupported rail or torch drops as an item. Mineshaft torches emit block light 14, because the light volume is built from the generated cells.
- **Fences.** Mob movement collides with the fence post and each arm as separate boxes (`world.collisionBoxes`) instead of the full cell, which is what `Block.addCollisionBoxesToList` does.

## Save semantics

A save stores the seed plus edits, and every load regenerates the world, `world.generatedStructures` included, with full loot. The generation records therefore become live state only once: when a record has neither a `spawners` array nor a `minecarts.carts` array, which means its first launch or a save from before this change. `launch` saves right away, so both fields are written on that first launch. After that the saved fields are authoritative:

- A looted cart reloads with only the stacks that were left in it.
- A broken cart does not come back.
- A spawner whose cell is no longer a monster spawner is dropped on restore, as well as at the moment it breaks.

`spawners` uses `TileEntityMobSpawner` NBT names. `minecarts` is `{ version: 1, carts: [...] }`, with original item ids, so items that have no browser mapping survive a round trip. Exports carry both fields. `world-import.js` rebuilds them field by field:

- Spawners need integer coordinates.
- Carts need finite positions. Item slots must be 0-26, counts 1-64, and stored enchantments must be integer id/level pairs.
- A malformed field is dropped, and the world then launches as a first launch.
- Exports without the fields import as before.

`pendingTicks` from generation are handed to the live fluid queue when they are liquid ticks (`Fluids.schedule`, which ignores cells that are not liquid). All four reference worlds have none.

## Evidence

- `src/mineshaft-integration.test.js` (11 tests):
  - Reference positions: seed 0 default has spawner (120,31,37) and cart (115.5,43.5,75.5) with 6 stacks. Seed 17 default has cart (127.5,41.5,23.5). Seed 10 amplified has six carts and spawner (112,26,6). Seed 0 large biomes has spawner (60,18,113).
  - Saves: a save/reload round trip that neither duplicates nor refills; a looted cart that stays looted; broken cart and spawner removal; pinned version 9 hashes.
  - Torch light 14; import validation.
  - Cart picking, the 0.1 border and the player push.
  - A spawner that spawns cave spiders with the 2004 burst.
  - Fence post and arm collision for mobs.
- `EntityMinecart` in the 1.7.10 jar (`xl`, read with `javap`): `getBoundingBox` returns null, and `getCollisionBox(other)` returns the other entity's box. So carts block nothing, and they push and are pushed through `applyEntityCollision`. They are deliberately not obstacles for the player.
- Browser check, seed 0, on the local dev server with the tab muted:
  - The corridor renders with fences, planks and rails, and the chest minecart renders on its rail.
  - The cart is picked by the crosshair, and its chest screen opens with the 6 generated stacks.
  - A stack taken from the cart stays taken after a page reload and relaunch, and a broken cart stays gone after a reload.
  - The (120,31,37) spawner spins a cave spider and spawned one within 32 ticks.
  - No console errors or warnings.

## Gaps

- Carts cannot be placed, ridden, powered or pushed along a powered rail. The Minecart item is inert.
- Hoppers and comparators do not interact with carts.
- The display mob is lit by the spawner cell, as natively, so it is very dark without a light source.
- Spawner rendering, ticking and cart ticking cover the 128 x 128 live area only; there is no chunk streaming or unloading.
- Mob AI does not path around carts, and mobs push carts only through the shared `pushEntity` path.
- A cart drop whose original item has no browser mapping (`drop.original`) is not spawned in the live world; it is lost when the cart is broken. Saved carts do keep such items.
- `SpawnPotentials` and spawner NBT edits are not supported.
- The cart chest screen plays no open or close sound. `EntityMinecartContainer` has none natively either, but this has not been checked against the client.
