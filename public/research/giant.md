# Giant (EntityGiantZombie, id 53, 1.7.10)

Evidence: `tools/probes/GiantProbe.java` via `tools/verify-giant.mjs` writes `giant-reference.json` (61 records: facts 1, pathWeight 4, attack 56). `src/giant.test.js` replays it. Class names decoded with `javap`: `ye` extends `yg` (EntityMob) extends `td` (EntityCreature). It is not a zombie (`yq`).

Bytecode-verified:
- Box 3.6 x 10.8 (0.6 x 1.8 scaled by 6), yOffset 0, health 100, movement speed 0.5, attack damage 50, follow range 16, 5 experience, no drops.
- Legacy AI only: no tasks, `aiEnabled` false. `getBlockPathWeight` = `brightness - 0.5`. `EntityMob.attackEntity` grid (56 cases).
- Sounds: hurt `game.hostile.hurt`, death `game.hostile.die`, no living sound.
- Summon `Giant` and region import/export `Giant`.

Approximate / gaps:
- The AI reuses the silverfish legacy `EntityCreature` port (`creatureActionState`). The giant stops about 2.3 blocks from the player in the simulation because of its width; whether the native pathing reaches the strike range was not verified.
- Model is the zombie rig scaled 6x with arms raised (`mob-renderer.js`); shadow size 3 from `shadows.js`.
- Natural spawning is not added (the Giant does not spawn naturally in 1.7.10).
