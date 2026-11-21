# horse90 (batch 90): the sneak dismount order for the single-player server copy and the dedicated server, a dying pig's rider

Branch `batch90-horse90`. Files: `src/ai.js`, `src/horse-live.js`, `src/entities.js`, `src/multiplayer/server-vehicles.js`, new `src/horse90-b90.test.js`.

## Summary
1. **PlayerView (single-player server copy) sees the sneak dismount in the sneak tick** (`ai.js` `PlayerView.sneakOff`, called from `horse-live.js` `riderSneakOff`). Before, the copy's `riding` flag was read at the start of the mob tick and only dropped on the next one, so its mountEntity(null) -> setPlayerLocation and the walking branch came one tick late. Now the horse/pig mob tick's sneak step lets the copy go at the dismount spot at once (`setLocation`, walking branch for that tick's packet). Carts and boats already got off before the copy's update (their step runs in tickSurvival), so they were not late.
2. **Dedicated server** (`server-vehicles.js` `riderInput`, `finishSneak`, `sneakOffVehicles`): a sneaking rider (C0C `k`, or the controls' sneak for an old client) no longer dismounts before the mount's update. The tick still applies its steering and the jump bar, the mount (pig, horse via the mob tick's `riderSneakOff`; cart and boat via `sneakOffVehicles` right after `carts.tick` / `boats.tick`) updates with the rider aboard, and the rider gets off after it from the seat the first `riderInput` call recorded (`sneakSeat`). A mount the mob tick did not reach (a corpse) is handled by `finishSneak` at the start of `ServerVehicles.tick`. Dead player / missing or removed mount still dismount at once, as before.
3. **A dying pig's sneaking rider** (`entities.js`, both `this.dying(e, t); continue;` paths): the corpse path skipped the sneak step, so the rider stayed on until the next client tick's fallback. Now it gets off after the corpse's update (native: the corpse still runs onUpdate and the rider's updateRidden after it).

## Evidence
- **Bytecode-read** (`javap -c -p`): `sa.B` (Entity.setDead) only sets `K` (isDead) and does not touch the rider or mount; `sv.a(ro)` (EntityLivingBase.onDeath) has no mountEntity call; so a dying pig keeps its rider through the corpse ticks, and at deathTime 20 the rider's `updateRidden` finds `K` set and clears the link with no move (already modelled since b80/b88: `releaseDead`, `releaseAtSeat`, `endRidden` zeroes fallDistance). Predecessor evidence reused: `yz.ab`, `ahb.a(sa, Z)`, `mw.a(FFZZ)` (horse89-reference.json Executed for the horse).
- **Port-read**: tick order in `main.js` (carts/boats before `tickMobs`), `PlayerView.update` runs in `beginTick`, `serverPlayerUpdate` runs after the entities; dedicated `simulation.js` runs `vehicles.riderInput(); mobs.tick(); vehicles.tick()`.
- Not executed: no new probe (the dedicated-server and copy changes are order changes on top of executed single-tick data).

## Verification
- `node --test src/horse90-b90.test.js`: 4/4. With the four source files stashed, tests 1-4 fail; with only `entities.js` stashed, test 4 fails.
- 39 neighbour files (`horse*`, `mphorse*`, `mpriders73`, `mpriding2`, `mpvehicle*`, `seat86`, `ride87`, `vehicle-simulation`, `player-riding`, `spcopy*`, `pig-saddle*`, `mpobjects89`), `--test-concurrency=2`: 484/484.
- No old test edited. `npm run build` and full `npm test` not run (no imports touched; track rules).

## Found wrong in the batch 89 list
- "PlayerView sees the sneak one tick late" was true only for horses and pigs; carts and boats were already in order.

## Follow-ups
- Mob-ridden horses (skeleton/zombie on a saddled horse, spider-jockey style): not checked. Natively `EntityHorse.e(FF)` steers from a rider that is an EntityLivingBase on a saddled horse; this needs a probe with a mob rider before changing the port. Left open.
- The dedicated server's dismount spot for a cart/boat uses `sneakSeat` (the seat from the first `riderInput` call); the executed check is only for a horse.
- Browser-only (not checked): how the dismount feels on the sneak tick in multiplayer, no rubber-band after the S08.
