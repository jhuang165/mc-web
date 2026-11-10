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
- Slimes spawn through the SpawnerAnimals port from the biome monster lists ([natural spawning](natural-spawning.md)), with the slime chunk and swamp `getCanSpawnHere` above; no seeded replay reached a slime spawn. The 40-mob cap applies to splitting.
- `mob.attack` (the slime's melee) is emitted as an event with the native two pitch draws; the manifest has no audio for it, so it stays silent.
- The original may play the landing sound twice in single-player; the port plays it once.
- Legacy worlds have no biome or Java seed, so the swamp and slime chunk rules do not apply there.
- Slime shadow size 0.25 is not applied.
- Particle offset uses Math.sin rather than MathHelper's table.
- Size is capped at 127 on import; float box width differs by about 5e-8.
- The renderer is not visually verified (no browser used).
