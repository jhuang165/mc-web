# Batch 81 corpse81: the dying horse's AI, converting zombie corpses, the inventory key while riding, and hits on a dragon part

## Summary
- Dying horse (`entities.js dying`):
  - EntityHorse overrides isMovementBlocked (`wi.bh`) as "saddled rider, or eating, or rearing", with no health test. So an unblocked dying horse runs its AI tasks (`sw.bn`) as a living one does, where the port used to walk it at speed 0. Panic, wander and the rest still move it during the 20 death ticks.
  - A saddled rider still steers (b80). An eating or rearing corpse gets zero input.
  - The rest of the horse update now runs on the corpse too: the tail roll `nextInt(200)` before the move; after it, `horseTick` (the mouth and rear counters, the anim, the 900 heal roll, which draws but does not heal, and the 300 eat roll on grass); then the body turn.
  - Other corpses keep the base `sv.bh` (health <= 0), so they still get no AI.
- Zombie villager:
  - `canCure` drops `conversionTime === undefined`, since `yq.a(yz)` has no isConverting test. startConversion clears Weakness, so a second apple works only on a zombie weakened again, and it restarts the timer.
  - `yq.h` counts the conversion down with no health test. A dying converting zombie now ticks its timer (`entities.js` corpse branch, before the fire). If the timer runs out during the death, the villager appears and the corpse goes.
- Inventory key while riding:
  - In `bao.p`, the key asks `bje.j`: riding any EntityHorse (no saddle or health test). If so, it sends C0B 7 (`bjk.j`) and never opens the player's own screen.
  - The server side `nh.a(jj)` → `wi.g(player)` opens the window only for a tame horse (riddenBy null or this player).
  - Single player: `main.js inventory()` now uses `ridingHorse` to decline, and `horse-gear-live.js riddenHorse` is that tame test (no saddle, no health). A dying horse's window opens and the existing `horseReach` check (alive-only) closes it.
  - Multiplayer client: the C0B 7 send drops `ridesSaddled` (the import was removed from main.js; the export is kept in client-horse.js).
- Hits on a live or dying dragon (`entities.js attack`):
  - The hit entity is the part `wy`, which extends `sa`, not `sv`. In `yz.r(sa)`, the following are gated on `instanceof sv`: enchantment damage (`afv.a(sv, sv)`), the Knockback level (`afv.b`), the critical, both Fire Aspect setFire calls, Thorns and the damageDealt stat.
  - So on the dragon: Sharpness/Smite/Bane and the Knockback level count 0, there is no critical (`info.critical = false`), nothing is set alight, there is no Thorns, and `lastAttackDamage = 0`, so the stat wrappers' increment of 0 adds nothing.
  - The sprint knockback still counts (`info.knockback`), so the player slows and stops sprinting. The `addVelocity` lands on the part, so the dragon is not pushed.
  - The sword still wears: the wy branch hands the dragon to ItemStack.hitEntity.
  - Callers use `info.critical ?? critical` for the crit particles: `player-edit-simulation.js` (single player) and `server-mobs.js` (S0B 4).
- Tests:
  - New `src/corpse81-b81.test.js` (5). All 5 fail against the unpatched sources.
  - Updated old-gap tests:
    - `horse-gear.test.js`: a tame unsaddled horse now opens; an untamed one is null.
    - `zombie-villager.test.js`: `conversionTime: 100` with Weakness is now curable.

## Evidence
- **Bytecode-read** (javap -c -p, 1.7.10 jar):
  - `wi.bh`, `sv.bh`, `sv.e` (the bh branch, then `br()`/`bk()` → `bn()`), `sw.bn`.
  - `wi.e()`: tail roll, then the 900 / 300 rolls and the herd. `wi.h`. `wi.e(FF)`: the unsaddled branch calls `wf.e(FF)`.
  - `yq.a(yz)`, `yq.h`, `yq.cc` (watcher 14), `yq.cd`.
  - `bao.p` (the inventory key), `bje.j`, `bjk.j`, `nh.a(jj)` (actions 6 and 7), `wi.g(yz)` (isRemote, rider, `cc()` tame). The names come from `joined-1.7.10.srg`.
  - `yz.r(sa)` (every `instanceof sv` gate, the wy → dragon hitEntity branch). `wy extends sa`.
- **Port-read**: `livingHurt` uses `hurtResist`, not `e.hurt`, so attack's hurt-window test never refuses a dragon (native `xa.a(wy, ro, F)` returns true); not changed.
- **Executed**: no new native probe.

## Verification
- `node --test src/corpse81-b81.test.js`: 5 pass. With the source changes stashed, 0 pass and 5 fail.
- Targeted run, 208 test files: horse, zombie, dragon, corpse, enchantment, stats, pvp, fire, player-edit, combat, death, villager, riding and mount tests, plus every test that reads entities/main/player-edit-simulation/server-mobs/horse-gear-live/zombie-villager source. Command: `node --test --test-concurrency=4`. Result: 2588 tests, 2588 pass, 0 fail.
- No full `npm test`, no browser.

## Follow-ups
- Browser-only, not seen:
  - a dying horse panicking or wandering while it tips over;
  - E while riding an untamed horse doing nothing;
  - a tame unsaddled horse's window;
  - no crit particles on dragon hits.
- Every corpse still skips the rest of its onLivingUpdate natively run with blocked movement. Not done:
  - EntityAgeable growth, EntityAnimal love and its heart draws on Entity.rand;
  - the body turn for corpses other than the horse;
  - ticksExisted / entityAge;
  - a foal corpse's growSize.
- The horse's herd follow (`wi.e` `co()` branch) is still unmodelled, for live horses too.
- The multiplayer client's own prediction of a dragon hit (the client-side critical on a part) was not checked; that belongs to mpcopies81.
- `yq.cd` on a corpse: native still runs `yg.h` after removeEntity in that tick (a deathTime of 20 there would drop xp). The port `continue`s; this is an edge case and unprobed.
