# Batch 80 corpse80: right clicks on dying mobs (wolf, ocelot, horse, mooshroom, pig, zombie cure) and the dragon corpse

## Summary
- The live-only gates batch 79 left are now open in single player, on the server and in the client prediction, since native `interact` tests no health:
  - Wolf (`entities.js wolfInteract`, `wolf.js interact`): a tamed corpse uses the meat without healing it. The test is the watcher 18 < 20, which keeps its last live value. A wild corpse tamed with a bone gets `setHealth(20)` and is revived. Its deathTime stays frozen, so it lies tipped and red.
  - Ocelot (`ocelotInteract`): a corpse is sat, tamed or bred like a living ocelot.
  - Horse:
    - `horse-live.js horseInteract`: no health gate.
    - `horse.js feedHorse`: the food is used, but health stays at 0.
    - Server: `server-horses.js` mount and open have no health gate. `usable()` keeps its alive test, so ContainerHorseInventory.canInteractWith closes a window opened on a corpse.
    - Client: `client-horse.js` (mountedHorse, bar) and `animal-use.js predictHorse` have no health gate.
  - Mooshroom (`mooshroom-golem-live.js`, `predictAnimalUse`): a corpse gives stew, and shears turn it into a cow. The cow gets `wh.g(aS())`, so health 0 with deathTime 0; it dies over its own 20 ticks with no onDeath, so no loot and no xp.
  - Pig: `pig-saddle-live.js pigMount` and `animal-use.js` server ride take the rider onto a saddled corpse. `stickUse` tests only riding a pig.
  - Zombie villager: `zombie-villager.js canCure` has no health test.
- Riding a corpse: the rider stays on until deathTime 20, when the mount is set dead (Entity.updateRidden). This covers:
  - single player `horseSeats.mount` and `vehicle.dead`;
  - the server's `server-riding.js keeps` and `server-vehicles.js ridingBox`.
  - A saddled dying horse is steered by its rider (`entities.js dying` passes `horseRideThink`; the `wi.e(FF)` rider branch).
- Dragon corpse:
  - Picking: single player `pick` skips only `dragonGone`, and the client's `remote-mobs.js pick` has no dragon-corpse skip. The 7 parts freeze at their last live boxes during the 200-tick death. The port already did this (`dragonTick` and the tracker's `dragonUpdate` return before `updateParts`).
  - Attack (`entities.js attack`, `server-mobs.js attack`): returns true at health 0, so the weapon wears and the 0.3 exhaustion is paid. `dragon-mobs.js` sets `recentlyHit` only at health > 0, and `playerHit(null)` is used for the dragon, because `sv.l(sa)` stores null for a part.
  - A right click on a dragon (alive or dying) does nothing: `player-edit-simulation.js interactEntityFirst`, `serverAnimalUse` and `predictEntityExtras` decline it. The part is not EntityLivingBase and its interactFirst is Entity's false.
- Tests: `src/corpse80-b80.test.js` (10). All 10 fail against the unpatched sources. No old test encoded these gaps, so none was changed.

## Evidence
- **Bytecode-read** (javap -c -p, 1.7.10 jar):
  - `wv.a(yz)`, `wn.a(yz)`, `wi.a(yz)`, `wi.g(yz)`, `wi.i(yz)`, `wm.a(yz)`, `wo.a(yz)`, `yq.a(yz)`, `abp.a`: no health or isEntityAlive test.
  - `sv.f(F)` (heal): returns when getHealth <= 0. `sv.g(F)` (setHealth): clamps to 0..max.
  - `wm.a(yz)` shears: setDead, `largeexplode`, new `wh`, `wh.g(aS())`, spawn, 5 red mushrooms, damageItem, `mob.sheep.shear`. Bowl only when growingAge >= 0.
  - `wv` watcher 18 is written only in `bp()` (updateAITasks). That does not run during the death (`sv.e` skips AI when `aN()` is true).
  - `wi.bh()` (isMovementBlocked): no health test. `wi.e(FF)` rider branch.
  - `sv.aF` (onDeathUpdate): deathTime++, setDead at 20.
  - `xa.R()` false and `wy.R()` true. `wy.a(ro, F)` → `xa.a(wy, ro, F)`: 3 rand floats for the target, target null, `e(ro, F)` only for a player or explosion source (refused at health <= 0), then returns true. `xa` onLivingUpdate returns after the death puff.
  - `sv.l(sa)` stores null for a non-living attacker target.
  - `wy.c(yz)` is Entity's false.
  - ContainerHorseInventory.canInteractWith tests isEntityAlive.
- **Port-read**: the dragon parts already freeze in `dragon.js dragonTick` and `entity-tracker.js dragonUpdate`.
- **Executed**: no new native probe. Port behaviour was checked only by the node tests below.

## Verification
- `node --test src/corpse80-b80.test.js`: 10 pass, 0 fail. The same tests fail 10 of 10 with the source changes stashed.
- Targeted suite: the new file plus 97 files that cover pick, interact, horse, pig, wolf, ocelot, mooshroom, zombie villager, dragon, riding and the multiplayer mobs. Command: `node --test --test-concurrency=4 ...`. Result: 1227 tests, 1227 pass, 0 fail.
- `npm run build`: passes; only the usual chunk-size warning.
- No full `npm test`, no browser.

## Follow-ups
- Browser-only, not seen:
  - the view while riding a corpse pig or horse up to its setDead;
  - a revived wolf lying tipped and red;
  - aiming at the frozen dragon parts during the death rise;
  - the horse window flash-opening on a corpse and closing next tick;
  - the dying horse steered by its rider.
- A dying unridden horse natively still runs its movement (`wi.bh` has no health test); the port's dying branch walks it with speed 0 unless it is ridden and saddled.
- `canCure` still requires `conversionTime === undefined`. Native `yq.a(yz)` has no isConverting test, so a second apple restarts the timer. That is untested here and left.
- `horse-gear-live.js riddenHorse` (the single-player inventory key while riding) still tests health > 0.
- The multiplayer client copy of a revived wolf (health back to 20 after death started) is untested.
- Client chunk-section lookup of the frozen dragon parts once the body rises about 20 blocks is not modelled.
- The live dragon's knockback and Fire Aspect still apply to the dragon itself; native applies them to the part.
