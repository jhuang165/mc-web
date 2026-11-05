# Spawn egg, Bottle o' Enchanting, fire charge (Minecraft Java 1.7.10)

Evidence: `tools/probes/SpawnEggProbe.java` drives the unchanged original classes (aee ItemMonsterPlacer, acp ItemExpBottle, acq ItemFireball, zn EntityExpBottle, sg EntityList, sq EntityXPOrb) on the MobMoveProbe world double; `tools/verify-spawn-eggs.mjs` writes `public/research/spawn-eggs-reference.json` (24 eggs, 216 use, 24 useEach, 400 expImpact, 18 expLaunch, 36 fire records). `src/spawn-eggs.test.js` checks the port against it. Anything not probed is marked bytecode-derived.

Browser ids: original 383/384/385 are taken by other items, so they map to internal 1950 (spawn egg, damage = EntityList id), 1951, 1952 (`original-items.js`, `tools/inventory-replay.mjs`).

## Behaviour
- Spawn egg: 24 eggs from `EntityList.entityEggs` with both colours and en_US names ("Spawn Creeper"). Two-layer tinted icon (spawn_egg by primary, spawn_egg_overlay by secondary). Creative Miscellaneous tab, one entry per egg.
- Use on a block: spawn at the clicked block offset by the face, centred, +0.5 y on the top face of a fence; random yaw `wrapAngleTo180(nextFloat()*360)` (also head and body yaw); `onSpawnWithEgg`; the stack's custom name; stack shrinks outside Creative. Probe: use, named.
- Use on a water surface: spawns at the water block's integer coordinates; Creative keeps the stack. Probe: water.
- No mob-spawner branch exists in 1.7.10 (bytecode of aee.a never reads the block), so none is implemented.
- Mob type is resolved at use time through `SUMMONABLE` (`commands.js`) and `mobs.spawnNatural`, so mobs added by other tracks work automatically. Eggs whose entity is absent from this build (at the time of writing Ghast, Zombie Pigman, Blaze, Magma Cube, Mooshroom, Ocelot, Horse) exist with name and colour, do nothing and are not spent (bytecode: the decrement is inside the entity != null branch).
- Bottle o' Enchanting: random.bow (0.5, 0.4/(r*0.4+0.8)) then a thrown entity: velocity 0.7, pitch offset -20, gravity 0.07, size 0.25 (probe: expConstants, expLaunch). On impact (block or entity): 3 + nextInt(5) + nextInt(5) XP in getXPSplit orbs, world event 2002 (data 0) at the rounded position with the glass sound. 400 seeded impacts match orb for orb. Always shows the enchantment glint. In-flight bottles are saved with the thrown potions.
- Fire charge: right click puts fire in the cell beside the face if that cell is air (sound fire.ignite, volume 1, pitch r*0.4+0.8); the charge is spent outside Creative whether or not fire was placed (probe: fire). Shapeless recipe: blaze powder + coal or charcoal + gunpowder -> 3 (matches the original recipe manager, `recipe-catalogue.test.js`).

## Gaps
- Not full parity. Living sound after an egg spawn (`playLivingSound`) is not played; custom names are stored on the mob (`customName`) but not rendered or persisted; no dispenser behaviours (spawn egg, bottle, fire charge small fireball); no small fireball entity.
- Zombie, Skeleton and Zombie Pigman could not be constructed on the probe's world double (NPE), so their use records are errors; their placement relies on the other eggs' records.
- Thrown-bottle launch matches the seeded constructor replay only to about 5e-5 per component (the port reuses the potion launch's float rounding).
- Bottle break particles use the water-bottle shards (damage 0) of the potion effect; not compared pixel for pixel. Egg icon composition is browser-only and untested outside it.
- Fire charge in Adventure mode simply does nothing; egg/bottle behaviour there is not probed.
