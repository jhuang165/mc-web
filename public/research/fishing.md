# Fishing (1.7.10)

Target classes (client jar SHA1 e80d9b3bf5085002218d4be59e668bac718abbc6): `xe` EntityFishHook, `acv` ItemFishingRod,
`act`/`acu` ItemFishFood and FishType, `xf` WeightedRandomFishable, `afv` EnchantmentHelper (`g` Luck of the Sea,
`h` Lure). `tools/probes/FishingProbe.java`, run by `tools/verify-fishing.mjs` (set `MC_RESEARCH`), executes the unchanged
classes and writes `public/research/fishing-reference.json`: 3 tables, 7 launches/casts, 3 reels and 2400 seeded loot
rolls (6 configurations x 400). `src/fishing.test.js` replays all of it (trajectories, every timer, every particle and sound
event, loot stack/wear/enchantments, orb, statistic, drop position and velocity).

## What is implemented

- Items (internal ids 700-706, `src/fishing-content.js`): fishing rod (64 durability, stack 1, recipe `  #`/` #X`/`# X` with sticks and
  string, Tools tab, `fishing_rod_uncast` and `fishing_rod_cast` icons), raw fish (2 / 0.1), raw salmon (2 / 0.1), clownfish (1 / 0.1),
  pufferfish (1 / 0.1; Poison III 60 s, Hunger II 15 s, Nausea II 15 s), cooked fish (5 / 0.6) and cooked salmon (6 / 0.8).
  Raw fish and salmon smelt with 0.35 XP. Food tab order follows Item.itemRegistry.
- Hook (`src/fishing.js`, `FishHook`): launch with 0.4 power, 1.5 velocity and inaccuracy 1; flight and drag 0.92 (0.5 on ground); landing
  and release each tick (the native `inTile` quirk); entity hooking and pulling; the catch timers (ticksCaughtDelay 100-900 minus
  100 per Lure level, ticksCatchableDelay 20-80, ticksCatchable 10-30, halving in the open, doubling under lightning-capable sky);
  `random.splash`, bubble and splash particles; despawn when the rod is put away, the player dies or is over 32 blocks away.
- Reel in: hooked entity costs 3 and pulls it toward the player; a bite rolls the loot (junk, treasure or fish with Luck of the Sea
  and Lure shifting the chances), throws it from the bobber toward the player, spawns a 1-6 XP orb at the feet and costs 1; a landed
  hook adds 2. `random.bow` plays on casting.
- Runtime (`src/fishing-simulation.js`) is saved as `fishing` in the world record (absent in old saves) and restored with the hook's
  timers and random state. `src/fishing-renderer.js` draws the bobber and the 16-segment line; the held rod shows the cast icon.

## Known differences

- No statistics system exists, so `stat.fishCaught`, `stat.junkFished` and `stat.treasureFished` are rolled and returned but not stored.
- The `wake` particle (EntityFishWakeFX) has no browser particle; the bubble and splash particles are drawn.
- The hook cannot hook its own angler; hooked entities are mobs only, pulled by adding to their velocity.
- The line tip for other views uses the camera yaw instead of renderYawOffset; the rod model does not use the mirrored
  shouldRotateAroundWhenRendering transform.
- Fish dropped by a bite use World.rand for the roll and the entity RNG for items, as native, but the hook seeds are not replayed
  from a server world seed. All loot items are registered, so there is no missing-item limit. Full parity is not claimed.
