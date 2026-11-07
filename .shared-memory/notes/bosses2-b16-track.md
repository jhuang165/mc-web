# b16 bosses2 track

Changed (branch b16-bosses2):
- Dragon model: `DragonModelProbe` + stub GL11 replay ModelDragon boxes (12) and poses (16 x 36 matrices). Fixed spine boxes and neck/head offset index in `src/dragon-renderer.js`. Reference `dragon-model-reference.json`, test `src/dragon-model.test.js`.
- Dragon part sweep: `DragonSweepProbe` (12 records). `reachesDragon`/`sweepArea` gate in `src/dragon-parts.js`, used by bow, projectiles, fireballs, explosion-simulation. Test `src/dragon-sweep.test.js`.
- Hurt overlay alpha 0.7 (bytecode-read) in `src/mob-renderer.js`.
- Wither: xc.bn target pool/loop re-read from bytecode; matches the port, no code change. Not probed.
Shared files edited: mob-renderer.js, projectiles.js, bow.js, fireballs.js, explosion-simulation.js (one-line gates).
Remaining: wither candidate order and head particles are not replayed from Java; dragon hurt pass not probed; no browser check.
