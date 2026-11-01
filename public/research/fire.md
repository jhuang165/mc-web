# Fire (Minecraft Java 1.7.10)

Target: 1.7.10 only. This is not full parity; see "Gaps" below.

Code: `src/fire.js` (rules, `Fire` runtime, render vertices), `src/world.js` (block 45), `src/lighting.js`, `src/scene.js` (meshing and animation), `src/main.js` (wiring, flint and steel, left-click extinguish, player contact), `src/weather.js` (lightning hook), `src/entities.js` and `src/item-entities.js` (burning), `src/survival.js` (item 126 and recipe), `src/creative.js`. Tests: `src/fire.test.js`.

## Method

Class names are the obfuscated ones in the 1.7.10 client JAR (SHA-1 `e80d9b3bf5085002218d4be59e668bac718abbc6`), read with `javap -c -p`. `tools/probes/FireProbe.java` runs the unchanged original classes (a `World` subclass allocated without its constructor, blocks held in a map, fixtures seeded with `java.util.Random`) and `tools/verify-fire.mjs` writes the output to `fire-reference.json` with SHA-256 digests of each class. `src/fire.test.js` replays every fixture against the browser port. The probe verifies the JAR's SHA-1, runs with a JDK and the guava, log4j-api and commons-lang3 library JARs, and needs no LWJGL.

Evidence key: **probe** = replayed against the original classes in `fire-reference.json`; **bytecode** = transcribed from `javap` output only, covered by behavioural tests but not by a probe replay; **unit test** = behaviour tested here with no original reference.

| 1.7.10 class | MCP name |
|---|---|
| `alb` | BlockFire (`a(ahb,x,y,z,Random)` updateTick, `func_149841_a` tryCatchFire, `e` canNeighborBurn, `c` canCatchFire, `func_149845_e` neighbour encouragement, `c(ahb,x,y,z)` canPlaceBlockAt, `a(.., Block)` onNeighborBlockChange, `b(...)` onBlockAdded) |
| `ant` | BlockStaticLiquid (lava fire spread in `a(.., Random)`) |
| `acw` | ItemFlintAndSteel |
| `xh` | EntityLightningBolt |
| `ahb` | World (`func_147470_e` isBoundingBoxBurning, scheduleBlockUpdate, setBlock) |
| `aji`, `awt` | Block, Material (`getCanBurn`, `isReplaceable`, `isLiquid`) |
| `sa` | Entity (`moveEntity` fire contact, `setFire`, `isWet`) |
| `blm` | RenderBlocks (`renderBlockFire`) |
| `bmh` | Tessellator |
| `mt` | WorldServer (`func_147456_g` random block ticks, `tickUpdates`) |

Vanilla fire is id 51; here it is internal block 45 (hidden, after "Red flower"). The item is 126 (Flint and steel).

## Ported, and how it is checked

| Part | File | Evidence |
|---|---|---|
| Encouragement / flammability table (internal ids, enc/flam): log 5/5, leaves 30/60, planks 5/20, wool 30/60, bookshelf 30/20, tall grass 60/100, dandelion and red flowers 60/100. `Material.getCanBurn`, which lava uses, covers the wood, leaves, wool, bookshelf, tall-grass, wheat and chest blocks here (`BURNS`) | `fire.js` `FIRE_INFO`, `BURNS` | **probe** (171 table rows over the original ids, mapped to this build's ids in the test) |
| `canPlaceBlockAt` (solid top below, or any neighbour that can catch fire), `onNeighborBlockChange` (removes fire that can no longer be placed), `onBlockAdded` (schedules at 30 + `nextInt(10)`) | `fire.js` `canPlace`, `neighborChange`, `blockAdded` | **probe** (160 place cases) |
| `updateTick`: tick rate 30; `doFireTick` gate; `canPlace` failure removes the fire; rain extinguishing (`canLightningStrikeAt` on the fire and its x/z neighbours); age 0 to 15 with `nextInt(3) / 2` increments; reschedule at 30 + `nextInt(10)`; burn-out when no neighbour can burn (no solid floor, or age above 3) and at age 15 on a non-flammable floor (`nextInt(4)`); `tryCatchFire` on the six neighbours (300 sides, 250 above and below); the 3 x 3 x 6 spread loop with `(encouragement + 40 + 7 * difficulty) / (age + 30)`, halved when humid; the original's quirks (a failed `canPlace` removes the fire but the rest of the tick still runs; one spread check passes the fire's z instead of k) | `fire.js` `updateTick` | **probe** (56 seeded fixtures, 1,973 steps; every `setBlock`, metadata change, schedule and the next random draw compared) |
| Static lava fire spread (`ant.a`): `nextInt(3)` steps of a random upward walk that ignites an air cell next to a burnable block, or, with zero steps, up to three tries to ignite the air above a burnable neighbour cell | `fire.js` `lavaTick` | **probe** (72 cases, 24 ticks each) |
| Lightning bolt fire: on creation, fire at the strike cell and four random cells within one block when `doFireTick` is on and difficulty is at least Normal (each only if air with a placeable support), and again at the strike cell on each re-strike | `fire.js` `boltStart`, `boltRestrike`; `weather.js` `LightningBolt` | **probe** (96 bolts, constructor and every `h()` re-strike) |
| `World.isBoundingBoxBurning` (any fire or lava in the box contracted by 0.001) | `fire.js` `boundingBoxBurning` | **probe** (6 boxes) |
| `renderBlockFire` geometry: floor quads for a cell with a solid top or fire-encouraging neighbours, the stacked sloped sheets and the four side flames with the original u/v and 0xa001a0 brightness | `fire.js` `fireVertices`; `scene.js` | **probe** (256 render fixtures over neighbour and icon patterns) |
| Animated `fire_layer_0` and `fire_layer_1` (32 frames, 1 tick each; layer 0 uses its mcmeta order 16..31 then 0..15) with alpha test; block light 15 and no light opacity; no shadows cast | `scene.js`, `lighting.js`, `shadows.js` | unit test, **bytecode** for the mcmeta order; checked in headless Chrome |
| Random block ticks reaching still lava (3 draws per section containing a randomly ticking block, `lcg = lcg * 3 + 1013904223`, x, z, y from `k >> 2`) | `fire.js` `Fire.tick`, `scan` | **bytecode** (`mt.func_147456_g`); unit test |
| Scheduled ticks in a binary heap, retained by versioned snapshots; legacy saves use `wake()` | `fire.js` `TickQueue`, `Fire.save`/`load` | **bytecode**; port save/load regressions |
| `ItemFlintAndSteel`: places fire in the adjacent air cell, plays `fire.ignite` (pitch 0.8 to 1.2), always wears 1 (not in Creative); shapeless iron ingot + flint recipe; 64 durability | `main.js`, `survival.js` | **bytecode**; unit test for the recipe |
| Left-click on fire extinguishes it with `random.fizz` (volume 0.5, pitch 2.6 +/- 0.8); Creative stops there, Survival then continues digging | `main.js` `edit` | **bytecode** |
| Fire contact in `Entity.moveEntity`'s tail: a box in fire or lava (`isBoundingBoxBurning`) takes `inFire` 1 each tick and counts the fire counter up from `-fireResistance` (−1, or −20 for the player), setting 160 ticks when it reaches 0 unless wet; out of it the counter rests at `-fireResistance` | `block-collisions.js` `blockCollisions` for the player, mobs, items and XP orbs (`fire.js` `fireContact`/`touchesFire` stay as tested helpers) | **probe**: 768 original `moveEntity` tail cases ([player step](player-step.md)) |
| Lightning-bolt entity strikes (5 damage and `setFire(8)`) are the earlier weather port; fizz when rain puts a burning player out | `weather.js`, `main.js` | **bytecode** |
| Lava ignition of flammable neighbours: the `lavaTick` above, with `BURNS` standing in for `Material.getCanBurn` | `fire.js` | **probe** |
| Sounds: `fire.fire` ambient crackle near fire, `fire.ignite` | `fire.js` `ambient`, `main.js`, audio manifest | unit test (the `.ogg` files are original assets from the 1.7.10 sound index) |

## Gaps

- **Difficulty and humidity.** Difficulty is fixed at Normal (2) because this build has no difficulty setting, and `isBlockHighHumidity` is always false (the probe also covers a humid jungle fixture for the original).
- **Not ported blocks.** No End, netherrack or portal fire rules, TNT ignition is supported ([creepers](creepers.md)); remaining flammable blocks are absent (the build has no stairs, slabs, fences, carpet, hay, coal block and so on). The table covers the blocks that exist here.
- **Random tick set.** The original ticks every loaded chunk section that contains a randomly ticking block. The game routes fire/lava, tree and plant random ticks through Weather.tickChunk using the finite world’s section refcounts. Fire’s standalone test loop still uses per-section marks rescanned every 20 ticks. Full Java loaded-chunk selection and cross-system ordering remain unfinished.
- **Persistence.** Since 0.22.1 scheduled fire ticks retain relative delays and tie order through `Fire.save()`/`load()`. Only legacy/unsupported snapshots use `wake()` to reschedule saved fires. Fire age persists as metadata. Since 0.22.4 the regression tests restore the weather random snapshot; other random streams and unified cross-system scheduling remain unfinished. This does not implement Anvil/TileTicks interoperability.
- **Contact and damage.** Fire/lava burning-box contact uses the shared moveEntity tail with negative counters ([player step](player-step.md)); lava also applies its onEntityUpdate damage/ignition ([lava](lava.md)). Full damage, hurt-resistance and difficulty acceptance remain unfinished.
- **No visuals for burning.** No first-person fire overlay (`ItemRenderer.renderFireInFirstPerson`), no flames drawn on burning mobs, and no flame or smoke particles from `randomDisplayTick` (only the crackle sound).
- **Bytecode only.** `WorldServer` random ticks and `tickUpdates`, `ItemFlintAndSteel.onItemUse`, and the scene animation order are transcribed from `javap`, not run against the original.

## Player counter persistence (0.22.4)

The player save now retains `fire`, including negative ignition-delay values, instead of resetting it to zero on load. `tools/verify-fire-save.mjs` runs the unchanged Entity.writeToNBT/readFromNBT methods on an empty concrete Entity with only its abstract subtype hooks supplied. The [15 native cases](fire-save-reference.json) preserve 14 signed-short values (-32768 through 32767, including -20/-19/-1 and burn-cadence boundaries) and read a missing Fire tag as zero. Class/JAR fingerprints are retained. This executes the base Entity NBT methods, not complete EntityPlayer NBT, files or tick/damage behavior.

Browser snapshots accept integer counters within that signed-short domain; absent/malformed values default to zero. `src/survival.test.js` replays the native counters and checks JSON reload burn cadence, negative progress toward ignition, water extinguishing and Creative retention. Existing hurt-resistance behavior is unchanged and full damage/reload acceptance remains PLAYER-01. Respawn still creates a fresh unlit player. The separate weather random-state snapshot now supports fire schedule continuity without manually assigning its seed; other random streams remain unfinished.
