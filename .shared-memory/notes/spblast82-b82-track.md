# Batch 82 spblast82: blast order, the fire roll's Random, and what a blast pushes

## Summary
- **Ghast fireball blasts are inline now.** Natively `EntityLargeFireball.onImpact` (`zg.a(azu)`) calls `World.newExplosion(null, x, y, z, power, true, mobGriefing)` and then `setDead`, all inside the ball's own update.
  - `entities.js`: after a ball's `tickOne` in the walk, a host with `explodeInline` runs the ball's explosion events right away (same `takeExplosions` path as the creeper). A host without `explodeInline` still queues them.
  - This covers single player (`main.js` sets `explodeInline`) and the dedicated server (`server-mobs.js` sets it too, and its balls use the same EntityWorld walk). The away run's `explodeInline` covers it there as well.
- **Wither spawn blast inline.** `EntityWither.updateAITasks` (`xc.bn`) calls newExplosion and then playBroadcastSound 1013 in the wither's own update. `wither-boss-mobs.js` `witherAITick` now calls `m.explodeInline(ev)` when the host has it, and otherwise queues the event as before.
- **Checked, no change needed:**
  - Blaze small fireballs (`zi.a`) do not explode. Their fire is already lit inside `impact`.
  - Wither skulls were already inline: the `skull` walker in `entity-simulation.js` runs `mobExplosion` right after the skull's update.
- **Fire roll Random.** `agw.<init>` builds `explosionRNG` as `new Random()` (unseeded).
  - `explosion.js` `explosionOutcome`: `own` now defaults to null. A flaming blast with no `own` makes `new JavaRandom(Math.floor(Math.random() * 2 ** 48))`. `Date.now` is gone from `explosion.js`.
  - `explosion-simulation.js` `applyExplosion` passes its own Random from Math.random, made only when the blast is flaming and `ignite` exists. This matches the b80 lead fix in `server-mobs.js`.
  - Seeded tests: a non-flaming blast draws nothing new from Math.random. A flaming single-player blast now draws one Math.random before its outcome. None of the neighbour tests below needed new expectations.
- **Pushes (bytecode-read `agw.a()`).** For each entity, doExplosionA runs `attackEntityFrom(ro.a(this), damage)` and then adds the push to motion, whatever attackEntityFrom returned. `agi.a` (Blast Protection) only scales an EntityLivingBase.
  - New `src/explosion-extras.js`:
    - Large fireballs: setBeenAttacked. If `getExplosivePlacedBy` is set, the ball turns to the placer's look and the placer becomes its shooter. This is `ze.a`, because `ro.a(agw)` gives an "explosion.player" source with the placer as its entity. Then the push is added.
    - Small fireballs and wither skulls: `zi.a`/`zp.a` return false and skip setBeenAttacked, but the push still lands.
    - Firework rockets (`zf`), eyes of ender (`zd`, a 0.25 box from posY with yOffset 0) and fishing hooks (`xe`): Entity's default attackEntityFrom (setBeenAttacked) plus the push.
    - Leash knots (`su` extends `ss`): EntityHanging.attackEntityFrom breaks them, gated by the query box and the distance.
  - `explodeNonLiving` calls these, using `state.rockets`, `state.eyes`, `state.hooks` and the new `placer` argument (applyExplosion passes `attacker`). `main.js` passes rockets, eyes and the active fishing hook. `away-entities.js` passes rockets.
  - **Server:** `ServerMobs.explode` used to push only mobs, primed TNT and players, and break only paintings and frames. It now runs `explodeNonLiving` on the dimension's systems:
    - items and orbs;
    - dispense arrows, balls and rockets, and eyes (`_eyes`, which is not created if missing);
    - falling blocks;
    - hanging entities;
    - minecarts and boats. A cart that breaks drops at once into `host.items`, and a TNT cart's blast nests through `cartHost`.
    - each view's fishing hook;
    - the mobs' fireballs, skulls, potions, golem snowballs and knots.
  - `itemsBefore`/`orbsBefore` are taken before `explodeMobs`, as in single player, so loot a blast kill drops is not pushed by that blast. `placer` is now computed before the entity pass and reused for the chained TNT.

## Evidence
- Bytecode-read (javap -c -p, 1.7.10 jar):
  - `zg.a(azu)`: newExplosion `ahb.a(Lsa;DDDFZZ)` at offset 70, then `B()` setDead.
  - `xc.bn`: newExplosion at 56, then `ahb.b(IIIII)` 1013 at 83.
  - `agw.<init>`: `new java/util/Random()` into field `j`. `agw.a(Z)` uses `j.nextInt` for the fire roll.
  - `agw.a()` entity loop (618 to 958):
    - `ahb.b(Lsa;Lazt;)` list;
    - `sa.f` distance / size <= 1;
    - eye `sa.g()`;
    - `ahb.a(Lazw;Lazt;)` density;
    - `sa.a(Lro;F)` with the result popped;
    - `agi.a(Lsa;D)`;
    - motion `v/w/x +=`, for every entity.
  - `ro.a(agw)`: "explosion.player" `rp` with `agw.c()` when it is non-null, else plain "explosion".
  - `ze.a(ro, F)`: `aw()`, then `Q()`, then the source entity's `ag()` look into motion and accel * 0.1, then shooter if `sv`.
  - `zi.a` and `zp.a` return `iconst_0`.
  - `zd`, `zf` and `xe` do not override `a(ro, F)`. `zd(ahb, D, D, D)` is setSize 0.25 x 0.25, then setPosition, then `L` (yOffset).
- Port-read:
  - The knot box and position are copied from `piston-push.js` / `horse-gear-live.js`.
  - Inside a swap, the server's systems are the swapped dimension's (`host.dispense`, `host.vehicles`, `host.falling`), the same pattern as the existing primed TNT and hanging calls.

## Verification
- `node --test --test-timeout=600000 src/spblast82-b82.test.js`: 7 pass. The tests cover:
  - The fire roll repeats under a seeded Math.random, with Date.now stubbed to throw.
  - A non-flaming blast draws no Math.random.
  - Single-player pushes of fireballs, rockets, eyes and hooks, and knot breaks.
  - The large ball takes the placer's look.
  - A server blast pushes items, orbs and carts, and a broken cart drops at once.
  - The server ghast ball explodes during its own walk turn (`mobs.slot === ball`).
  - The wither spawn blast runs inline, and a bare host queues it.
- Neighbours, all passing:
  - explosion, explosion-simulation, explosion-entities, blast81, block-actions-replay, entity-simulation-replay, mpexplosion78, mpfx80, explfx79: 53/53.
  - blaze-ghast-world, blaze-ghast, fireballs-b41/b42/b43, fireballs-native, mpwither-b63/b64, wither-boss, wither-targets, mpdragon2-b65, game-rules, mob-griefing: 172/172.
  - fixes68, hanging, hurt-drops-b49, mob-effects-b55, mob-victims-b51, mpgolems-b66, mphorseclient77, mphorse78, mpmobs2-b60, mpmobtypes-b61, mpmobs-b59, mpperf79, mpspawn73, mptrade-b66, mpvehiclehits-b67, mpuse2-b65: 151/151.
  - mpvillage-b66, player-knockback, projectile-nbt, projectiles5/6, random-persistence, render81, ring-events, singleleft-b62, spexec78/79, spfixes75, xp-orbs: 137/137.
  - away-order-b50, away-throws, away-vehicles, entityprobes2-b67, saved-order b52/b53/b54/b56/b57, savedorder6/7/8, trackerorder-b61, mpprojectiles/2, mpdispense-b61, mpend/mpend2: 182/182.
- `npm run build`: passes (the usual chunk-size warning).
- No full npm test and no browser checks.

## Follow-ups
- The port still runs doExplosionA kind by kind (mobs, items, orbs, arrows, ..., TNT, player), not in the native chunk-list order of one list. Only cross-entity effects (a kill's loot, a nested blast) could tell.
- The away run's `applyExplosion` still gets no minecarts or boats (its drop hook is not wired). Eyes and hooks are not in the away run.
- Server client copies:
  - The new pushes set `velocityChanged`. Not checked: whether each server tracker lane (items, rockets, eyes, hooks) sends S12 for it.
  - Carts and boats reach clients through the `vehicles` state message only.
- The wither skull's own exploder (`zp.a` passes `this`) is still `source: null` in the port. That only matters for self-exclusion, and the skull is dead by then.
- Browser-only (not checked):
  - items, carts, rockets and eyes visibly flying from a server blast;
  - a ghast ball's blast landing a frame earlier than before against nearby mob motion;
  - the wither spawn blast's timing on screen.
