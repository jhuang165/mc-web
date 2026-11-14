# Batch 66 mplightning: lightning on the dedicated server

## Summary
- `src/multiplayer/server-lightning.js` (new): `ServerLightning`, built in `simulation.js` and ticked right after `weather.tick`. It announces new bolts, hits what stands in each flashing bolt's box, and makes `fire.L.difficulty` follow `sim.difficulty` (the server's Fire kept a fixed Normal, so /difficulty did not change bolt fire).
- `src/multiplayer/client-lightning.js` (new): `RemoteLightning`. A `boltSpawn` makes the client's own `LightningBolt` in `weather.bolts` (the existing renderer draws it); its tick sets the sky flash (`lastLightning = 2`) and plays `ambient.weather.thunder` (volume 10000) and `random.explode` (2).
- `src/weather-simulation.js`: the mob part of the strike loop is now the exported `strikeMobs(mobs, bolt)`; single player calls it, same behaviour.
- Hooks (one line each): `simulation.js` (import, construct after `weather.fire = ...`, `this.lightning.tick()` after `weather.tick`), `client.js` (`boltSpawn` -> `onBolt`), `main.js` (import, `remoteLightning` var, `client.onBolt`, creation after `remoteFishing`, `remoteLightning?.tick()` in the multiplayer branch of `movementTick`, null in `leaveMultiplayer`).
- Wire message: `{ type: 'boltSpawn', i, x, y, z }` on `p.dispOut`, to Overworld players within 512 blocks (3D). No sound packet.
- The roll itself (per chunk `nextInt(100000)` while thundering, updateLCG, precipitation height, canLightningStrikeAt) already ran on the server through `Weather.tick`; only its result was unused.
- Strike effects: mobs (5 fire damage and fire counter; pig to pigman; creeper charged), players in the Overworld (Survival.damage 5, fire counter; Creative skipped as in single player), items and experience orbs in the box (health 5, killed).
- `/summon`: still absent on the server (batch 65), left alone. No trident in 1.7.10.

## Evidence
- Bytecode-read: `javap` over the jar: only `sa` (Entity), `wo` (EntityPig) and `xz` (EntityCreeper) declare `a(xh)`. So a villager does not become a witch and a mooshroom does nothing in 1.7.10: the brief's "villager to witch" is a later version (gap found wrong). `mpvillage` needs no lightning hook.
- Bytecode-read: `mt.c(sa)` (WorldServer.addWeatherEffect) calls `oi.a(x, y, z, 512.0, dimension, new fy(entity))` (sendToAllNear, 3D squared distance, dimension compare). `mt` chunk loop: `nextInt(100000)`, `Q()` raining, `P()` thundering, updateLCG, `h(x,z)` height, `y(x,y,z)` canLightningStrikeAt, then `new xh` and `c(sa)`.
- Bytecode-read: `xh` has the two sounds (thunder 10000 / 0.8 + r*0.2, explode 2 / 0.5 + r*0.2) and the doFireTick fire; already replayed by existing weather tests.
- Recalled (not executed): the client's own bolt also plays the sounds when the S2C spawn global entity arrives, and WorldManager.playSound sends S29 for volume > 1 within 16 * volume blocks, so natively thunder may be heard twice; here it is played once.
- No new Java probe: the rules are the existing single-player ones, already executed (weather tests).

## Verification
- `node --test src/mplightning-b66.test.js`: 7 pass (seeded roll gives a bolt and one `boltSpawn`, nothing beyond 512, no roll without thunder, player damage, Creative skipped, pig/creeper/zombie/spared cow, items and orbs, fire follows difficulty, client flash and sounds).
- `node --test --test-concurrency=1` over weather-simulation, weather, mob-lightning-b52, creeper, creeperwitch-b45, mpmobs-b59, mpmobs2-b60, mpmobtypes-b61: 145 pass. mpdragon2-b65, mpnether-b61, mphealth-b60 30 pass.
- `node --check` on every touched file. Full npm test not run (batch rule).

## Follow-ups
- Boats, minecarts and thrown projectiles in the box are not hurt (boats take 5 * 10 damage natively); other dimensions have no weather so none needed.
- Each player's chunks: the server ticks the whole 128 x 128 world from its centre, so chunk selection differs from native per-player activeChunkSet (existing behaviour).
- Only a browser would show: the flash and bolt drawing in a joined client, and the sound pan.
