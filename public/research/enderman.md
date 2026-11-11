# EntityEnderman (Minecraft Java 1.7.10)

Original classes: `ya` EntityEnderman (over `yg` EntityMob, `td` EntityCreature, `sv` EntityLivingBase), `bhk` ModelEnderman, `bnm` RenderEnderman. Entity id 58, name `Enderman`. This build does not claim full parity.

## Evidence

- `tools/probes/EndermanProbe.java` runs the unchanged client classes (JAR SHA-1 e80d9b3b...) on a block-map world double with a real `new ya(world)` and a constructor-less player. `tools/verify-enderman.mjs` writes `public/research/enderman-reference.json`.
- Record counts: stare 1626, stareSeq 3, teleportTo 9, teleportRandom 100, teleportToEntity 60, hurt 60, drops 4, pick 126 (of 4000 seeds), place 6 (of 40000 seeds), tick 1800 (six environments x 300 seeds: night, sun, shade, water, rain, dim sun), chase 4.
- `src/enderman.test.js` replays those rows on `src/enderman.js` (pure rules), draw by draw on `java-random.js`. `src/enderman-live.test.js` covers the live hooks (stare, projectile, melee, drops, restore).

## Behaviour implemented (probe-checked unless marked)

- 40 health, 0.6 x 2.9, step height 1, movement 0.3, attack 7, XP 5. Speed modifier +6.2 (operation 0) while it has a target.
- Stare: the look vector against the direction to the enderman's middle, threshold `1 - 0.025 / distance`, line of sight from the player's eye to the enderman's eye, pumpkin helmet (86) exempts. First staring tick plays `mob.endermen.stare` at the player, the sixth makes it scream and returns the player. Within 64 blocks.
- Teleport: `teleportRandomly` (32 horizontal, +-32 vertical draws), `teleportToEntity`, `teleportTo` (scan down while y > 0, accept when the box collides with nothing and holds no liquid), 128 portal particles and `mob.endermen.portal` at the old and new positions.
- Hurt: a projectile makes it scream, calm down and try up to 64 random teleports with no damage; a player melee hit makes it aggressive; other damage is normal.
- Wet (water, rain on open sky) deals 1 drown damage and teleports; daylight with brightness above 0.5 and open sky teleports (`nextFloat * 30 < (b - 0.4) * 2`); fire teleports.
- Carry: carriable set 2, 3, 12, 13, 37, 38, 39, 40, 46, 81, 82, 86, 103, 110. Empty-handed 1 in 20 ticks looks at one cell near it; carrying 1 in 2000 ticks places the block on air over a normal cube. Needs `mobGriefing`. `carried` and `carriedData` are saved, imported (`Enderman` in `java-mobs.js`) and exported (shorts, original ids). The carried block is not dropped on death.
- Drops: ender pearl (item 378) `nextInt(2 + looting)`.
- Sounds `mob.endermen.{idle,hit,death,scream,stare,portal}` imported (17 files). Idle while screaming is `scream`.
- `/summon Enderman` (40 health), spawner `Enderman`, shadow size 0.5.
- Model: ModelEnderman with `enderman.png`, additive full-bright `enderman_eyes.png`, held block, screaming head lift and shake. The pose maths is bytecode-derived (`bhk.a`), not probe-replayed.

## Gaps

- Spawning goes through the SpawnerAnimals port ([natural spawning](natural-spawning.md)): weight 10 in groups of 1 to 4 in most Overworld biome monster lists, groups of 4 from BiomeGenEnd in the End. Its approximations apply.
- The original is legacy AI with no task list (`td.bq`). This build drives chase, wander and swimming through the shared task AI (`AttackOnCollide`, `Wander`, `Swim`, hurt-by) and takes the stare target from `enderman-live.js`; path choice and attack timing are therefore not bytecode-exact. `ya.bR` (target search), `ya.e()` (the tick rules) and `ya.a` (hurt) are exact.
- The rules run on the entity's own `JavaRandom`, not a replayed world seed. Particles are not native-Random draws.
- A pumpkin cannot be worn as a helmet in this build, so the exemption is tested but unreachable in play; the jack-o-lantern does not exempt.
- `renderAsNormalBlock` is approximated by `normalCube`; burning means `fire > 0`.
- The hurt sound's pitch draw counts before the pitch (4 floats for entity-sourced hits, 0 for drown, 2 for generic) are empirical from the probe, not derived.
- Sun, rain and drown rules are replayed on a world double, not the full `sv.e` base class; the probe's player has no inventory, so a held-block interaction (item use on enderman) is not covered.
- Renderer: pose maths and held-block transform not replayed against the original; leg pivot (-5) leaves the model 1 px under the floor line as in the bytecode numbers I read. Not checked in a browser (task rules forbid starting one).
- Thrown ender pearls and snowballs count as projectiles only where `bow.js` / `projectiles.js` route through `mobs.damage`; explosions do not.
- Endermite spawn on pearl teleport, End dimension, enderman-specific `Endermen` achievements: not present.

## Batch 42: executed targeting records (enderman-wolf-b42-reference.json)

`EndermanWolfProbe` runs the unchanged `ya` EntityEnderman beside a real `EntityPlayerMP` (gaze at several yaw and pitch offsets, pumpkin, creative, adventure, invisible, sneaking, range 63/65, walls, glass, roofs, day, dusk, rain, water, melee, a mob hit, two endermen). `src/enderman-wolf-replay.js` replays every record on the port; `src/enderman-wolf-b42.test.js` asserts target, revenge, flags (screaming, aggressive, stare count), health, player damage, player revenge and non-ambient sounds up to the first window end (see below).

Fixed from these records:
- `ya.e()` tests `sa.f(sa) < 16.0D` (getDistanceSqToEntity, bytecode-read at offset 782), so a staring target teleports the enderman only within 4 blocks; the port used 16 blocks and retried a teleport every chase tick.
- A mob that hits an enderman becomes its target (EntityMob.attackEntityFrom, reached through `ya.a` for every direct hit); the port only took the player.
- A creative player that hits an enderman is its target for that tick only; `td.bq` drops a creative target after the tick's work.

Not replayed (open): the native legacy action state wanders on Entity.rand (i180, i120, f, f) and starts the chase a tick before the port's navigator does, so places drift and an arrival lands a tick apart. The replay compares everything until a mob is 0.5 block from its recorded place or the first damage no scripted hit explains (2843 of 11270 ticks), burns the recorded wander draws so later rolls (daylight, rain, carry) stay aligned, and skips ambient sounds (idle, scream, step). Wolf wandering and the wolf draws are likewise not replayed. Moving the enderman onto the legacy action state (`creatureActionState`, as the spider and pigman use) would close this.
