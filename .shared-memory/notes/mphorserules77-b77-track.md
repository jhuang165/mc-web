# Batch 77 mphorserules77: server horse rules

## Summary
- Fall: `EntityWorld.fall` sends a horse to `horseLand` (horse-live.js, was unused): mob.horse.land (0.4) over 1 block, points = ceil(distance * 0.5 - 3), the horse takes them as the fall source, the rider takes the same amount (`rider.fallHit`, vehicle-simulation.js `syncRider`; server: `ServerHorses.mount` via `serverRiderFall(...).hit`), then the block-under step sound. Before, a horse (single player and server) took the generic `ceil(d - 3)` with Jump Boost and `game.*.hurt.fall.*`, and its rider took nothing.
- Steering: `horseRideThink` also sets `rotationPitch = rider pitch * 0.5` and renderYawOffset / rotationYawHead = yaw, and adds Jump Boost to the horse's jump motion. `ServerHorses.input` feeds the rider pitch (native degrees, positive down = -p.pitch).
- Rejoin: `ServerHorses.logout` (before `ServerVehicles.dismount`) keeps the horse record as `p.ridingSave`, removes the horse; `savePlayer` writes it as `riding`; `rejoin` (called in `addPlayer` after `dimensions.adopt`) restores a new horse at its record and mounts. Overworld only.
- Horse armour: `damageEntity` adds `horseArmorValue(armor)` = 0/5/7/11 to `armorReduced` (new `extra` argument; fall, drown, magic etc. still bypass via UNBLOCKABLE).
- Own rider's melee is ignored (`ServerHorses.rides`, one line in `server-mobs.js attack`).
- Tests: `src/mphorserules77-b77.test.js` (10).

## Evidence
- Bytecode-read `wi.b(F)` (EntityHorse.fall): >1.0 plays mob.horse.land 0.4/1.0; `qh.f(f*0.5 - 3)`; <= 0 returns; `a(ro.h, n)` on itself and `sa.a(ro.h, n)` on `l` (rider); then the block at (floor x, floor(y - 0.2 - yOffset), floor z) step sound c()*0.5, d()*0.75. No Jump Boost, no super call.
- Bytecode-read `wi.e(FF)` rider branch: yaw copied, pitch * 0.5, `aM`/`aO` = yaw, strafe * 0.5, forward <= 0 -> * 0.25 and gallop 0, held rear stops input, jump power launches with Jump Boost `(amp + 1) * 0.1`; `wi.a(ro,F)`: damage whose entity equals the rider returns false; `wi.aV` returns static `by[cl()]` = {0, 5, 7, 11}.
- Bytecode-read `oi.e(mw)` (playerLoggedOut): writePlayerData first, then if `ridingEntity != null` `WorldServer.removePlayerEntityDangerously(mount)` ("removing player mount"); `sa.e(dh)` Entity.writeToNBT writes `Riding` via the mount's `c(dh)` (only a live mount); `oi.a(ej, mw)` login: `Riding` -> `EntityList.createEntityFromNBT`, forceSpawn, spawnEntityInWorld, `mw.a(sa)` mountEntity. So native does restore the mount, as a new entity.
- Port-read: the wild taming roll (`horseRunAround`) already draws `entityRandom(e)` (the horse's own Random): nextInt(50) every tick, then nextInt(100) < temper, else temper + 5; test mirrors a second JavaRandom draw for draw. Native EntityAIRunAroundLikeCrazy uses `horse.getRNG()` in the same order; the draws interleaved with the rest of the horse's tick are the existing b47h/b55 executed records. Foal growth is EntityAgeable's generic `growingAge` count (test), breeding is the existing `horseCanMate`/`horseChildFields` path.

## Verification
- `node --test src/mphorserules77-b77.test.js`: 10 pass (repeated 5 times). Related horse, mphorse76, mpriding2, mpusesweep75, mpriders73, riders72, mpvehicle*, mpcontainers*, combat*, mob-riding*, vehicle-* : 400 pass. No full npm test, no browser.

## Follow-ups
- Rider-sourced arrows and other rider damage still reach the horse on the server (only melee is ignored); single player has no own-rider guard either.
- Rejoin: a Nether/End rider is not remounted; the saved horse position is the horse's own, not re-seated by chunk load; a server shutdown with riders keeps the horse in the world too (native writes both).
- Gallop-time reset (`bP = 0` when forward <= 0) is animation only and not ported.
