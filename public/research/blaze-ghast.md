# Blaze, Ghast and their fireballs (Minecraft Java 1.7.10)

Original classes: Blaze `xx`, Ghast `yd` (extends `sr`/EntityFlying), EntityFireball `ze`, large `zg`, small `zi`, ModelBlaze `bhd`, RenderBlaze `bnd`, ModelGhast `bhl`, RenderGhast `bnt`, dispenser fire charge `kz`, RenderGlobal level events `bma`.

## Evidence

- Probe `tools/probes/BlazeGhastProbe.java` drives the unchanged client classes; `tools/verify-blaze-ghast.mjs` writes `public/research/blaze-ghast-reference.json` (needs `MC_RESEARCH` and a JDK). Record counts: facts 1, xp 1, blazeDrops 320, ghastDrops 160, blazeStart 6, blazeVolley 1560, blazeMelee 1, blazeUpdate 440, blazeFall 2, ghastStart 2, ghastAi 800, fireballStart 4, fireballFlight 160, fireballExplicit 1, largeImpact 3, smallImpact 2, smallProps 1, fireballHurt 1, ghastHurt 2, nbt 1.
- `src/blaze-ghast.test.js` replays those rows against `src/blaze-ghast.js`; `src/blaze-ghast-world.test.js` checks the engine wiring.
- Batch 39 (legacyai): `LegacyAiProbe.java` runs the unchanged `xx` (blaze) and `yd` (ghast) classes whole; `src/legacy-ai.test.js` replays 12 blaze/ghast/mixed records exactly against `public/research/legacy-ai-reference.json` (positions, motion, yaw, hover and volley fields, entityAge, jumping, path presence, Random draws, sounds, level events 1007-1009, fireball launch vectors and seeds, the player's hits). The blaze now runs EntityCreature's legacy action state (`blazeThink` over `creatureActionState` in `silverfish.js`, `hasAttacked` skips the re-path and wander and strafes) instead of a task list.
- Bytecode-read, not probed: `td.bq` (EntityCreature.updateEntityActionState: hasAttacked, strafing, isJumping persistence, `getPathEntityToEntity(..., true, false, false, true)`), `xx.e` (draw order: wet damage, hover countdown, crackle roll, 0.6 damping, six smoke doubles), `sv.attackEntityFrom` (entityAge = 0).
- Bytecode-derived, not probed: dispenser fire charge, models, renderers, sounds and level events, the blaze client crackle and smoke, the small fireball block case.

## Behaviour

- Blaze: hover and fly, fire immune, 1 damage per tick while wet, 3-shot small-fireball volley (60 tick wind-up, 6 tick gaps, 100 tick rest), melee 6, rods with looting (player hit only), 10 XP, rotating-rod model, fullbright, sounds mob.blaze.*.
- Ghast: flying wander and target AI, charge-up (1007 warning, face texture switches, 1008 fire), large fireball with `ExplosionPower` NBT (default 1), tears and gunpowder, 5 XP, a player-deflected fireball kills it.
- Small fireball: 5 damage plus 5 s of fire, lights the cell beside a hit block, no mobGriefing check. Large fireball: 6 damage then a flaming explosion, smoking follows mobGriefing; a player punch deflects it.
- Dispenser: a fire charge launches a small fireball. Spawn eggs 61 and 56 and /summon Blaze, /summon Ghast work; monster-spawner ids Blaze and Ghast are accepted. Region export and import round trip both mobs.

## Gaps

- Natural spawning: ghasts from BiomeGenHell's list and blazes from the fortress list through the SpawnerAnimals port ([natural spawning](natural-spawning.md)); the Nether flow is not covered by a seeded replay. No achievements.
- Fireballs are not saved and there is no /summon Fireball; fireball-versus-fireball collisions are not implemented.
- Ghast ground friction is approximated (0.546); a blaze or ghast fireball in flight and its impact on the player are not native evidence (the probe never ticks the spawned fireballs, only the launches are replayed). The blaze only targets the player (an attacking mob does not become its target).
- Models, renderers, crackle and smoke, level-event sounds and the small-fireball block case were not run against the original.
- The ghast render scale is a constant 4.5, assuming the client copy's attack counters never change.
- Audio files are not imported (the lead imports them); the media importer regex only gained `blaze|ghast`. Missing sounds fail silently.
- Hover offsets after the first gaussian pair are not replayed in the probe (shared Entity.rand).
- Not checked in a browser. Full parity is not claimed.

## Batch 40: fireball flight and impact, the EntityMob target rule

- `public/research/fireballs-reference.json` (tools/probes/FireballProbe.java via tools/verify-fireballs.mjs, replayed by `src/fireballs-native.test.js` / `src/fireballs-replay.js`): 27 records of the unchanged `zg`, `zi` and `ze.h` on the LegacyAi double. They cover acceleration and the 0.95 / 0.8 drag, `ticksInAir` (the 25 tick shooter grace, a punch does not reset it), block and entity intercepts (0.3 grow, nearest hit, the `d < best || best == 0` quirk), a ball hitting another large ball, the player's deflecting punch (small balls refuse), explosion power and `flaming`/`smoking` with mobGriefing on and off, the small ball's fire cell (no rule check) and `setFire(5)` unless immune, and knockback of the player double.
- Port fixes found by the replay: the dispenser form `(x, y, z, ax, ay, az)` normalises its aim like the shooter form; the first update keeps the constructor's box; water is tested before the sweep; an impact does not stop the update; large balls are collision targets; a cake's ray box is its shaped box.
- `EntityMob.attackEntityFrom` (`yg.a`): the attacker of a counted hit becomes `entityToAttack` for the blaze, silverfish, giant, spider and pigman (a mob or the player); refused hits and the victim itself change nothing; a shooterless ball is its own source entity (knocks back, becomes a dead target that the next `td.bq` clears). Blazes now shoot and melee a mob target.
- Bytecode-read only: `World.blockExists` (y outside 0 to 255 or an unloaded chunk removes the ball), the `inGround` path, `ye`/`yk` writing no `bc` (isJumping persists in the giant and silverfish).
- The blaze crackle (`fire.fire`) is the client half: a `clientOnly` client sound at the blaze; the server draws are unchanged.
