# Creeper explosions and witch throws: executed records and fixes (batch 45, branch batch45-creeperwitch)

## Summary
- **New executed records.** `EndermanWolfProbe` (unchanged obfuscated classes `xz` EntityCreeper, `yp` EntityWitch, `zo` EntityPotion, `agw` Explosion on the batch 42-44 harness) gained a batch 45 set: 77 `b45cw-*` scenarios (`tools/verify-endermanwolf.mjs`, `EW_SET=b45cw` writes `public/research/enderman-wolf-b45cw-reference.json`). Each tick records every Entity.rand draw plus a fifth row element: explosions (position, size, flaming, smoking, push), spawned items/orbs/potions, changed cells and the player's motion. Creeper cases: swell, fuse 30, flint and steel, lightning charge, power 3 and 6, mobGriefing off, difficulty, damage and knockback to the player and mobs, blocks and drops, death drops and the music disc on a skeleton arrow kill. Witch cases: potion choice and throw, self-drinking (water breathing, fire resistance, healing, swiftness) with timers and the speed modifier, hurt, killed, drops. The world random is reseeded per record (explosion rays, drop scatter and the explosion sound pitch use it).
- **`src/creeperwitch-b45.test.js`** replays all 77 records through `replayEndermanWolf` and fails on the first divergence (draws, positions, health, flags, sounds, explosions, spawned entities, changed cells).
- **Port fixes found by the replay.**
  - A creeper's explosion now runs inside its own update (`EntityWorld.explodeInline`, wired in `main.js` and `away-entities.js`). Mobs listed after it are hurt and pushed before they move; before, the event was queued and ran after the whole pass. The creeper is `setDead` but still finishes that update; its health stays at the pre-blast value.
  - The player's explosion push uses the float eye height 1.62F (the double gave 1e-9 differences).
  - Flint and steel on a creeper: the ignite pitch is `rand.nextFloat() * 0.4 + 0.8` on the creeper's own Entity.rand (`creeperIgnite`), not a generic random.
  - Witch drinking: the countdown is `if (timer-- <= 0)`, so a drink started at 32 ends on the 33rd later update and the timer shows -1 afterwards. The port finished one tick early (and moved one tick early afterwards). `witch.test.js` now expects 33.
  - Witch throw: `EntityThrowable(world, thrower)` aims once with inaccuracy 0 before the witch's own aim, so the potion's own random draws 3 gaussians first. The port drew only the witch's 3, so every thrown potion's velocity was wrong.
  - A dead witch still runs `EntityWitch.onLivingUpdate`: its drink rolls draw each tick and can start a drink.
- **Executed vs bytecode-read.** Everything above is executed on the real classes. Bytecode-read only: the `Entity.setFire` method id used by the probe (`sa.e(int)`, found by disassembly); the `EntityThrowable` constructor aim (confirmed by the draws in the records).

## Approximations (documented, not fixed)
- The server-side player in the original is moved by mob collisions (Entity.applyEntityCollision pushes both) and the witch's lead uses that motion. The port never pushes the player from a mob's update and throws with target motion 0. The replay compares the player's motion only after an explosion; the two near-weakness scenarios stand the witch in a cobweb and stop at tick 125 so no push precedes the throw.
- Items, orbs and potions spawned mid-run are not ticked by the probe, so their flight and velocities are not compared (positions and values at spawn are).
- A creeper that exploded is compared on health only afterwards (the original's corpse update falls into the crater; the port removes it).
- Changed cells compare coordinates only; the native floor (y < 0) is implicit.

## Verification
- `node --test src/creeperwitch-b45.test.js`: 78 pass.
- 42 neighbour files (enderman-wolf-b42/43/44, witch, creeper, explosion*, entities*, entity-*, combat*, away-entities*, player-edit-simulation, player-actions, living-simulation*, projectile*, village-fight*, lightning*, weather*, player-throw*): 724 pass after updating the ignite pitch test in `player-edit-simulation.test.js`.
- 63 further files that mention explode/witch/creeper: 771 pass, 0 fail.
- `npm run build`: ok. Full `npm test` not run (batch rule). No browser run.

## Follow-ups (proposed gap lines)
- Mob collision pushes on the server-side player (and the witch's lead from it) are not modelled; player motion is client-owned in the port.
- `throwFromPlayer` (thrown potions and experience bottles) has the same `EntityThrowable` constructor pre-aim; not checked against a record, so its three extra gaussians may be missing.
- Flight of spawned items, orbs and potions after a blast or throw is not covered by an executed record (the probe never ticks mid-run entities).

## Naming (merge with the horses track)
- The horses track owns probe set `b45` (`enderman-wolf-b45-reference.json`, `src/horse-spawn-b45.test.js`). This track is `b45cw`: probe arg `b45cw` (`BCW` flag, `EndermanWolfScenarios.runCW`), `EW_SET=b45cw`, `public/research/enderman-wolf-b45cw-reference.json`, replay export `referenceCW`. After the merge the b44 and b45 references regenerate byte-identical to batch45-lead's. The b45cw reference no longer records experience orb velocities (EntityXPOrb draws them from Math.random, so they differed between runs); orbs are compared by value and position.
