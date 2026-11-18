# exhaust81 (batch 81)

## Summary
Movement exhaustion now follows the native `EntityPlayer.addMovementStat` (`yz.k`) in single player and on the dedicated server. The movement stats use the same branch table.
- New `src/movement-stat.js` holds the `yz.k` table: dive (eye in water: 3-D distance), swim (in water: horizontal), climb (on a ladder, dy > 0 only), walk (on the ground: horizontal) and fly (airborne, more than 25 cm only). It also handles riding (nothing). Distances are `Math.round(sqrt_double(..) * 100.0F)` whole centimetres; the product is now a float. Exhaustion is `0.015F * cm * 0.01F` for dive and swim, and `0.01F` or `0.099999994F` (sprinting) `* cm * 0.01F` for walking. A ladder, the air and riding cost nothing. `TELEPORT_SQUARED` moved here, and `stats-live.js` re-exports it.
- `stats-live.js` `addMovementStat` now uses the table and returns the exhaustion. `addMountedMovementStat` uses the same centimetre rounding.
- `player-environment.js` `finishPlayerMovement` used to charge the raw horizontal distance × 0.015/0.1/0.01 every tick, in the air, on ladders and while riding too. It now charges `movementExhaustion`. New optional input fields: `eyeInWater` and `onLadder` (by default the world cells at the 1.62 eye and at floor(minY)) and `riding`. A teleport-sized move (more than 10 blocks) costs nothing, as with the stats. Creative still costs nothing (`yw.a` disableDamage).
- `main.js` (3 lines): one `moveFlags` object (eye in water, `isOnLadder`) is passed to both `finishPlayerMovement` and `statsLive.tick`, plus `riding: !!rider.vehicle`.
- Server: `server-vehicles.js` `sit()` sets `riding: true`, so a rider pays no movement exhaustion. `server-stats.js` now gives the climb stat `isOnLadder` (floor(minY), no flying test), the same rule single player has used since b72. Before, it used `!p.flying && countsVertical` (0.2 below).
- Stats were already ported (b63/b72: walk, sprint is counted as walk, swim, dive, climb, fall, fly, minecart, boat, pig, horse). They are kept, and the rounding fix applies to them too.

## Evidence
- Executed: `public/research/movement-stats-reference.json` (`tools/probes/MovementStatProbe.java`, run with `node tools/verify-movement-stats.mjs`). The subject is a real `EntityPlayerMP` (ServerPlayerProbe's unchanged constructor) with a recording `StatisticsFile`, on a world double with a stone floor, a still-water pool and a ladder column. Real collisions and the real `handleMaterialAcceleration` are used.
  - 324 movement ticks: walk, sprint, jump, sprint-jump, standing-jump, swim, dive, dive-sprint, ladder, ladder-slide and wade-out. Each tick runs `sa.N` handleWaterMovement, the jump, then the unchanged `yz.e(FF)`, which ends in `yz.k`.
  - 26 direct `yz.k` calls: rounding edges 0.004/0.0049/0.005, the 25 cm fly threshold, the sprint factor, branch order (dive before swim, ladder before ground), Creative, and riding.
  - 10 `yz.l` calls on minecart, boat, pig, horse and zombie instances.
- Bytecode-read: `yz.k`, `yz.l`, `yz.e(FF)`, `yz.ab`, `yz.a(F)` (addExhaustion: returns under disableDamage, server only), `yz.b(F)` (the fall stat uses Math.round(double); the port was already right), `nh.a(jd)` processPlayer (calls `mw.k(d)` once with the packet delta after `moveEntity`; the riding branch has no `k`), and `mw.g()` (1.62 eye, posY at the feet; `yz.g()` is 0.12). `mw` overrides none of k, e(FF), ab or h_.
- Port-read (probe inputs only): the probe sets the jumpMovementFactor that EntityPlayer.onLivingUpdate would set (0.02, or 0.026 sprinting) and the in-water rise of `EntityLivingBase.onLivingUpdate` (+0.04).

## Verification
- `node --test src/movement-stat.test.js`: 9 pass. It replays every reference row (stats and float exhaustion, the jump's 0.2/0.8 included) and the live `finishPlayerMovement` cases (ground, sprint, air, riding, teleport, ladder, Creative, dive/swim). A dedicated-server case checks that a sprinting player pays the per-tick walk cm × 0.099999994F. A source check covers the main.js and server-vehicles wiring.
- I ran 22 neighbouring test files that import the touched modules (player-environment, stats, smallfixes72, damage-fx, simulation-replay, mpstats-b63, mpvehicles, mpriding2, mpstate, mphealth, ladders, survival, boats and others): 323 pass. One test I updated because it encoded the old gap: `player-environment.test.js` "landing handles exhaustion…" expected 1 block sprinting = `f32(0.1)`. It now expects `0.099999994F * 100 * 0.01F` (the executed `sprint-1` row).
- `npm run build`: ok. No full npm test. No browser checks.

## Follow-ups
- Not modelled (bytecode-read): inside `processPlayer`, `mw.i()` (onUpdateEntity) runs the server player's own `moveEntityWithHeading` with server-side motion before the reset. That can add a second `yz.k`: for example, a player floating under water sinks by the server's own motionY, which counts as dive distance and dive exhaustion. Knockback motion also counts on the server. The port's server moves the player itself, so it charges once.
- The port's single player is one player, not the integrated server's EntityPlayerMP. Its inWater, onGround and sprint come from `movePlayer`'s state, not from C03 packets. The port's movement sends no packets, so the server's "moved too quickly" (100 sq) rejection is approximated by `TELEPORT_SQUARED`.
- Browser-only: how fast the hunger bar drains when sprinting, swimming or climbing in the real game loop.
