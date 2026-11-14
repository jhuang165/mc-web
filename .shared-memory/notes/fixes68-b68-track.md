# Batch 68 fixes68: sleeper eye and box in blasts, TNT cart bolt, bone meal world Random

## Summary
- New `src/sleeper-eye.js`: `serverPosY`, `serverEyeY`, `SLEEP_BOX` (a lying player: posY = minY + 0.2, eye = posY + 1.62, box 0.2 x 0.2).
- `src/multiplayer/server-mobs.js` `explode`, `attack`, `interact`, `punchBall`: use them for a sleeping player (posY, eye, 0.2 box in `explosionImpact`).
- `src/explosion-simulation.js` (single player): `state.sleeping` (set in `main.js` `explodeAt` from `bedSleep.sleeping`) gives the same posY, eye and box.
- `src/ai.js` `PlayerView.update`: `eyeHeight` = 0.2 + 1.62 while `sleeping`, so mob sight lines (EntitySenses, look helper) start from the right eye.
- `src/weather-simulation.js` `strikeThings`: new `cartHost` argument; a cart that never ticked gets it for the blow (`main.js` passes `cartHost`, `server-lightning.js` passes `sim.vehicles.cartHost`). The host is removed again afterwards.
- Bone meal click: `player-edit-simulation.js` passes `state.worldRand` (`main.js`: `weather.random`) and `server-use.js` passes `sim.weather.random` to `useBoneMeal` as `rand`.
- Test `src/fixes68-b68.test.js` (7 tests). No new wire messages.

## Evidence
- Bytecode-read (javap, 1.7.10 jar): `yz.a(III)` (sleepInBedAt) calls `setSize(0.2, 0.2)`, `yOffset (L) = 0.2`, then `setPosition(x, y + 0.9375, z)`; `Entity.b(DDD)` (setPosition) sets minY = posY - yOffset + ySize. `mw` (EntityPlayerMP) sets yOffset 0 in its constructor and `e_` (resetHeight); `mw.g()` (getEyeHeight) returns the fixed 1.62f, also while lying. So a sleeper has posY = bed y + 0.9375, minY = y + 0.7375, eye = posY + 1.62. The client player `yz.g` is 0.12 (eye-height-reference.json, executed in b64); the port's camera already follows orientCamera's sleeping branch (b66/b67), unchanged.
- Gap 1 (bed blast) found mostly wrong: `bedExplosion` already hands newExplosion(head + 0.5, size 5, flaming, smoking) as in `BlockBed.onBlockActivated` (b66, bytecode-read). The one wrong box was the sleeper's: an explosion used the standing 0.6 x 1.8 box and eye for a lying player. Fixed. The clicking player is awake, so its 1.8 box is right.
- Gap 3 (TNT cart): native has no host concept; the explosion goes through the world. In the port, `Minecarts.host` is set only by a tick, so a never-ticked cart killed by fire did not blow. Bytecode (b67): `onStruckByLightning` = dealFireDamage(5), cart damage 10 x 5 > 40, `killMinecart` explodes for fire damage. Fixed by the host hook (executed in the test: 1 blast, host restored).
- Gap 4 (bone meal): `ItemDye.func_150919_a` draws from `world.rand` (b67, bytecode-read, executed records 308). Both clicks now pass the world Random (`weather.random`, the one explosions, fluids and trees already use). Test counts draws on it for both paths.
- Recalled: the mob distance checks still read `PlayerView.y` (minY), not posY = minY + 0.2 for a sleeper; the difference is 0.2 blocks.

## Verification
- `node --test` one file at a time: fixes68-b68 7, mpsleep-b66 17, mpsleep2-b67 5, mpvehiclehits-b67 8, bonemeal2-b66 4, bonemeal3-b67 5, weather-simulation 2, mplightning-b66 7, explosion-simulation 2, ai 12, bed 7, dyes 11: all pass.
- `node --check` on every touched file; `bedSleep`, `weather`, `cartHost` are module scope in `main.js`. Full npm test not run (batch rule).

## Follow-ups
- Server block clicks and digs still ray from `position.y + 1.62`, also for a sleeper (native clients send the coordinates, so there is no server ray to match; the client sends the aimed cell). Not changed.
- Mob distance maths for a sleeper use minY rather than posY (0.2 block).
- Only a browser would show: the lying camera and a zombie hitting a sleeper.
