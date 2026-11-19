# Batch 82 corpse82: what a dying mob still runs, the converting corpse's experience, and the horse herd tail

## Summary
- Corpse update (`entities.js`, the `health <= 0` branch and `dying`), single player and the server (ServerMobs wraps the same EntityWorld):
  - ticksExisted: `e.age++` now runs for a corpse too. World.updateEntityWithOptionalForce adds 1 before every onUpdate.
  - AI task phase: a movement-blocked tick adds 1 to `aiSkipped`, so the `tickCount` that ai.js derives (age - 1 - aiSkipped) stays put. This covers every corpse, plus the saddled-ridden, eating or rearing horse corpse. A revived wolf resumes the phase it had.
    - Before this change, an unblocked horse corpse ran its AI with a frozen tickCount; it now advances 1 per tick.
    - The live saddled-ridden horse also counts as blocked now (`wi.bh` is true for it).
  - Growth and love (`ageAndLove`, taken out of the live path unchanged): a calf corpse grows, and a foal corpse's box widens (`horseGrowSize`). A fed corpse in love counts down and draws the heart arguments (3 gaussians, 3 floats) every 10th tick; a child loses its love. This runs after push and before horseTick or chickenUpdate, as on a live mob.
  - Body turn: every corpse turns its body after onLivingUpdate. That is `turnBody` (the body helper, or the legacy walking-direction turn); the squid uses `legacyBodyTurn`.
  - Sun (`sunIgnite`, taken out of the live path unchanged): an adult zombie or skeleton corpse in daylight draws the roll and can catch fire.
  - Pigman: the angry-sound countdown (`pigmanTick`) runs on a corpse before the conversion step.
- Converting corpse (`convertedCorpse`): when the conversion of a dying zombie ends on the tick its deathTime goes 19 → 20, `deathUpdate` still runs with the pre-cure deathTime and recentlyHit. The experience drops after the villager joins the list, and the 20 puffs are drawn. With deathTime below 19 nothing else happens.
- Horse herd (`horse-live.js horseTick`, `closestBredHorse`, `herdTargetOf`):
  - The wi.e tail is ported as a target pick only. It applies to a Bred foal (flag 16, which only NBT "Bred" sets in 1.7.10) that is not eating.
  - Search: the closest Bred horse whose box meets the foal's own box grown by 16 on every axis. Distance is getDistanceSq; ties go to the first in list order. Corpses count.
  - Beyond 2 blocks (squared distance > 4), native builds a path and stores it with `EntityCreature.setPathToEntity` (td.bp).
  - **Native consequence:** only the old-AI `td.bq` (and `td.bS`, called from bq) reads td.bp. The horse is AI-enabled (`wi.bk` returns true), so in 1.7.10 a foal never walks toward the herd, and no Entity.rand is drawn.
  - The port stores the chosen horse in a WeakMap (not saved) and builds no path. **The lead's description ("an untamed adult horse moves toward a nearby horse") does not match the bytecode.**

## Evidence
- **Bytecode-read** (javap -c -p on the 1.7.10 jar; names from joined-1.7.10.srg):
  - `ahb.a(sa, Z)`: ticksExisted `aa++` before `sa.h`.
  - `sv.h`: `e()`, then the body turn `f(FF)`, with no health test.
  - `sv.e`: `bh()` zeroes the input and skips `bn`/`bq`; travel and push still run.
  - `sw.e`: loot pickup is gated on `aT` (dead).
  - `rx.e`: growth. `wf.e`: love reset unless growingAge is 0; the heart draws are g g g, then f f f.
  - `wi.e`: tail roll, `wf.e`, 900, 300, eat counter, then the herd: `co()`, `cb()`, `cm()`, `a(sa, D)` with selector `wj`, `f(sa) > 4`, `ahb.a(sa, sa, F, Z, Z, Z, Z)`, `td.a(ayf)`.
  - `wi.k(Z)` (flag 16) is called only from `wi.a(dh)` ("Bred").
  - `td.bp` is read only in `td.bq`, `td.bQ` and `td.bS`. The only `td.bS` caller in td is bq; the other callers are wv and yk, on themselves.
  - `wi.bk` returns true.
  - `yq.h`: the conversion, then `yg.h`. `yq.cd`: `ahb.e(sa)` (removeEntity) sets the zombie dead, and its onUpdate goes on to `sv.aF` (deathTime++, experience at 20).
  - `yh.h`: the angry sound countdown, no health test.
  - Health and alive tests: a scan of every living-subclass `e()`/`h()` override for `aS()`, `Z()`, `K` and `aT` found only xz.h (the creeper fuse, isEntityAlive), ya.e (one isEntityAlive test in the enderman), yp.e (the witch's drink) and sw.e (the `aT` loot gate).
- **Executed**: no new native probe. Port behaviour was checked only by the node tests below.

## Verification
- `node --test src/corpse82-b82.test.js`: 7 pass, 0 fail. With the `entities.js` changes stashed, 6 of 7 fail. The herd test depends only on horse-live.js; its result shows that native herd logic has no effect on movement or draws.
- Targeted run, 249 test files (horse, corpse, death, zombie, pigman, skeleton, animal, villager, wolf, body/turn, replays, saved order, village, away, riding, mob, entity, tracker, spawn, leash, probe and similar names): `node --test --test-concurrency=4 --test-timeout=600000 <files>`. Result: 2973 tests, 2973 pass, 0 fail.
- No old test encoded these gaps, so none was changed.
- No full `npm test`, no browser.

## Follow-ups
- Still skipped on a corpse (they run natively, with no health test):
  - EntityMob's `entityAge += 2` in light (unobservable: despawn needs `sw.bn`);
  - the potion countdown in `sv.C` (updatePotionEffects);
  - the revenge-target lapse;
  - EntitySquid.onLivingUpdate (tentacles and draws);
  - EntityWolf's e()/h() (shake and head tilt);
  - EntitySnowman's melt and snow trail;
  - EntityEnderman.onLivingUpdate (except its one alive-gated part);
  - EntityWither.onLivingUpdate (witherPost and the heads);
  - EntitySheep.onLivingUpdate (client only);
  - the iron golem's counters (its walking dust already runs through push).
- A live zombie whose conversion ends still runs the rest of its onUpdate natively (AI, a possible attack, draws) after removeEntity. The port `continue`s; unprobed.
- Browser-only, not seen:
  - a corpse's body easing toward its head while it tips over;
  - a zombie corpse catching fire in the sun;
  - the converted corpse's orbs.
