# Slime (EntitySlime, class ym, EntityList id 55)

Target: Minecraft Java 1.7.10. This is not full parity; see Gaps.

## Behaviour implemented

- Sizes 1, 2, 4. Health size^2, box 0.6*size, contact damage = size (size 1 never damages), XP = size.
- Jump AI: delay `nextInt(20)+10` (divided by 3 with a target), post-decrement; jump sets moveForward = size and a random strafe; both decay x0.98 per tick.
- Squish: landing sets -0.5, leaving ground sets 1.0, `squishFactor += (squishAmount - squishFactor)*0.5`, `squishAmount *= 0.6`.
- Landing: size*8 slimeball particles (`iconcrack_341`). Sounds `mob.slime.big` (size>1) / `mob.slime.small`, volume 0.4*size.
- Death: 2 to 4 children of size/2 with the original offsets, yaw and height, at the end of the death animation.
- Drops: slimeball only for size 1, `nextInt(3)` plus `nextInt(looting+1)`.
- Spawn (`getCanSpawnHere`): flat world rule, peaceful rule, swamp rule (biome 6, 50<y<70, moon and light rolls), slime chunk rule (`Chunk.getRandomWithSeed(987234911)`, y<40).
- NBT: `Size` stores size-1; health is full on load. /summon Slime, spawner id Slime, region export, village monsters.
- Renderer: ModelSlime inner body plus translucent shell, squish scaling.

## Evidence

- `tools/probes/SlimeProbe.java` runs the original classes; `tools/verify-slime.mjs` writes `public/research/slime-reference.json` (47 records: facts 1, jumpDelay 1, split 4, splitAlive 1, drops 4, xp 1, chunkRandom 1, spawn 1, spawnFacts 1, spawnChunk 8, attack 1, think 22, model 1).
- `src/slime.test.js` replays every record (11 tests); `src/slime-world.test.js` covers live integration (8 tests).
- Batch 39 (legacyai): `tools/probes/LegacyAiProbe.java` ticks the unchanged `ym` (slime), `yf` (magma cube), `yd` (ghast) and `xx` (blaze) whole (`Entity.onUpdate`) next to a real player and logs every Random draw; `tools/verify-legacy-ai.mjs` writes `public/research/legacy-ai-reference.json` (33 records: idle, chase, split, hurt, water, ghast, blaze, mixed). `src/legacy-ai-replay.js` and `src/legacy-ai.test.js` replay every record exactly: position, motion, yaw, squish and jump fields, the nearest player within 16, size-scaled jump and attack, the magma cube's jump delay and boost, split children (seed, draws, first jump delay), sounds, level events (landing dust 2006) and the player's hits.
- Bytecode-read, not probed: `sw.a(sa, F, F)` (faceEntity) divides by the float constant 3.1415927410125732; `sv.a(DZ)` (updateFallState) sends level event 2006 with ceil(fall - 3) for every living mob.
- Bytecode-derived, not probed: the renderer layout.

## Gaps

- Magma cubes follow the same flow (jump delay, boost, split, no fall damage); the probe covers them, the renderer and spawn rules are not probed.
- Batch 70 (docs sweep, 2026-11-14): slime shadow is a real gap and worse than written: `SHADOWS` in `src/shadows.js` has no `slime` or `magma_cube` entry and `main.js` (about line 4700) only casts for types in `SHADOWS`, so slimes cast no shadow at all (native `RenderSlime` sets `shadowSize = 0.25 * size` per draw).
- Slimes spawn through the SpawnerAnimals port from the biome monster lists ([natural spawning](natural-spawning.md)), with the slime chunk and swamp `getCanSpawnHere` above; seeded replays reach slimes (`spawn-replay2/3/4-reference.json`; round 4 varies world seed, moon phase and size draws, `src/spawnreplays-b69.test.js`). The 40-mob cap applies to splitting.
- Batch 70 (docs sweep, 2026-11-14): the 40-mob cap on splitting is a port rule, not native. `EntityWorld.splitSlime` in `src/entities.js` (about line 2675) stops when `this.entities.length >= 40`. Bytecode-read in the jar: `ym` (EntitySlime) death loop spawns `2 + nextInt(3)` children with `World.spawnEntityInWorld` and no count test. So a slime that dies in a crowded save splits into fewer children than natively. Real deviation, kept for the save size limit.
- `mob.attack` (the slime's melee) is emitted as an event with the native two pitch draws; the manifest has no audio for it, so it stays silent.
- The original may play the landing sound twice in single-player; the port plays it once.
- Legacy worlds have no biome or Java seed, so the swamp and slime chunk rules do not apply there.
- Slime shadow size 0.25 is not applied.
- Particle offset uses Math.sin rather than MathHelper's table.
- Size is capped at 127 on import; float box width differs by about 5e-8.
- The renderer is not visually verified (no browser used).
- Batch 71 (mobfixes71): the 40-mob cap on splitting is removed. `EntityWorld.splitSlime` now stops only at `SLIME_SPLIT_GUARD` (5000 mobs), a runaway guard that no world reaches (a size 4 slime leaves 20 at most); the native `ym.B` has no count test (bytecode-read). Magma cubes split the same way. `src/slime-split-b71.test.js` kills a size 4 slime in a world of 100 mobs and counts 2 + nextInt(3) children for 12 seeds. The earlier "kept for the save size limit" note was wrong: saves do not truncate mobs (`serialize` keeps all). A Slime spawner now also counts magma cubes (EntityMagmaCube `yf` extends EntitySlime `ym`).
- Batch 71 (mobrender71, 2026-11-14): shadow line only. The shadow is now cast (`SHADOWS.slime`, `SHADOWS.magma_cube`), but at a constant 0.25, not `0.25 * size`: bytecode-read, `bot` (RenderSlime) and `boe` (RenderMagmaCube) have no `doRender` override and `bnn` passes `0.25F` to the constructors. The slime's size changes the shadow only through its height (`getShadowSize` = height / 2). This corrects the batch 70 line above.
