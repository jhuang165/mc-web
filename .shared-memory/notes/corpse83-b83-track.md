# Batch 83 corpse83: the rest of a corpse's living update

## Summary
- New module `src/corpse-living.js`, wired into `entities.js` with small edits to the `health <= 0` branch and to `dying`. It covers single player and the server (ServerMobs wraps the same EntityWorld).
  - `corpseEntityUpdate` replaces the corpse branch's bare `burn`. It runs:
    - the sprint particle's two nextFloat;
    - handleWaterMovement (`inWater` refreshed, fallDistance 0, the flow push, the splash on entering, and the fire put out because `burn` now sees the fresh flag);
    - the fire;
    - `air = 300`. sv.C's air test is `isEntityAlive() && ...`, so every corpse is reset; EntityWaterMob's wu.C does the same, with no ws.M() call.
    - `inWater` is now exported from entities.js for this.
  - `corpseEffects` runs in `dying` after onDeathUpdate and recentlyHit:
    - The revenge lapse uses the live path's expression: dead or gone, or 100 ticks after the hit.
    - It then calls `tickMobEffects`. Effects count down with their swirl draws and end on a corpse. Their hits are refused by attackEntityFrom, and heal/poison test the health (mob-effects.js already gated these).
    - Side effect: a mob that dies inside its tick (fire, drowning) now counts its effects that tick too. The live path `continue`d into `dying` before the potion step; natively sv.aO follows sv.aF in the same sv.C.
  - `corpseLivingHead`, before the blocked movement:
    - EntityEnderman.onLivingUpdate through `endermanTick`, which now passes `dead` as a getter, so an enderman the wet hit just killed also counts. `enderman.js tick` returns before the alive-gated `if (tgt) {...} else {...}` block. A wet, rained-on or sunlit corpse still teleports, draws its portal particles, carry roll and scream roll, and keeps screaming. It never chases.
    - EntityWither's xc.e head part (`witherUpdate`: the 0.6 damping, the chase on head 0's target, the yaw).
  - `squidCorpse` replaces the generic walk, push, body turn and limb swing for a dying squid:
    - snap, then `moveEntity(motion)` (ws.e(FF): no gravity, friction or limb swing), the landing and fall;
    - the push (sv.bo);
    - one squidWet push, then `squidLivingUpdate`: the tentacles, the coast on the frozen swim vector in water, or the 0.08 fall out of it;
    - `legacyBodyTurn` and the yaw.
    - Before this change, a squid corpse fell with the generic walk's gravity and friction and its tentacles froze.
  - `corpseLivingTail`, after the push:
    - EntityWolf's e()/h() (`wolfUpdate`: the wet shake, status 8, the head tilt, the shake sound and splashes). `dwHealth` is restored afterwards: watcher 18 is written by wv.bp (updateAITasks), which a corpse skips.
    - EntitySnowman's wr.e (`snowGolemUpdate`): the melt and drown hits are refused; the snow trail is laid.
    - The wither's side heads (`witherPost`).
- **Correction to the b82 note:** the iron golem's counters (attackTimer, holdRose) already ran on a corpse before this batch, through `push` → `golemTailTick`, together with its walking dust. A test now pins this.
- Not ported:
  - EntityMob's `entityAge += 2` in the light (yg.e). It is unobservable, because despawn runs in the AI, which a corpse skips.

## Evidence
- **Executed** (`tools/probes/CorpseLivingProbe.java`, `MC_RESEARCH=<dir with minecraft-1.7.10.jar> node tools/verify-corpse-living.mjs` → `public/research/corpse-living-reference.json`, tag b83corpse). The probe uses unchanged 1.7.10 classes on the SquidBatProbe and EndermanProbe world doubles, with an LCG copy of Entity.rand that counts draws.
  - `squidCorpse`, 2 × 22 rows. A squid lives 40 ws.h() ticks, then gets `sv.g(0)`, then 21 more ticks. ticksExisted counts before each h().
    - Kind "water": the corpse coasts with 0 draws per tick and its tentacles keep animating.
    - Kind "air": the water is switched off at the kill, and a Speed effect and a revenge target 92 ticks old are added.
      - It falls with vx = vz = 0 and vy -= 0.08, then × 0.98, and lands at y 0 on tick 55.
      - Speed counts 15 → 0 and is removed on tick 55. The swirl costs 1 draw (nextBoolean false) or 7 (true, plus 3 nextDouble).
      - The revenge target lapses on tick 49.
    - Both kinds: air 300 throughout; 200 draws at deathTime 20 (the puffs).
    - `src/corpse83-b83.test.js` replays both runs through `EntityWorld.tick`. It checks position, motion, every squid field, body yaw, air, deathTime, effects, revenge, the per-tick draw count and the Random state, for ticks 41-60.
  - `enderCorpse`: one ya.e() at 0 health in 6 environments × 300 seeds. Replayed exactly against `enderman.js tick` with `dead: true` (moved, screaming, aggressive, carried, particles, draws, Random state).
    - moved: night 0, sun 7, shade 0, water 154, rain 154, dimSun 0.
    - All 300 night corpses keep screaming. The no-target `else` (screaming = false) is inside the alive test.
  - `enderChase`: a corpse with a far, non-staring player target never teleports in 40 ticks, and chaseTimer stays 0.
- **Bytecode-read** (javap -c -p, 1.7.10 jar):
  - sa.C order: the sprint particle, N(), the fire, lava, y < -64.
  - sv.C: the air test is gated on `Z()`, else setAir(300). Order: hurt counters, then aF, then recentlyHit, then the revenge lapse (`!i.Z()` or `aa - bm > 100`), then aO.
  - aO's swirl draws.
  - wu.C sets air 300 when dead.
  - ws.e(FF) is `d(v, w, x)` only.
  - ws.e's tail, with one ws.M().
  - sv.e on a blocked tick: input zeroed, travel, then bo().
  - wv.e / wv.h: no health test.
  - wr.e: the hits, then the trail.
  - ya.e: one `Z()` test, around the target block.
  - xc.e: the damping, the chase and the yaw, then yg.e, then the heads.
  - wt.e: the counters and the dust.
  - yg.e: `bb()` and entityAge += 2.
- **Port-read**:
  - The mapping of `e.revenge` (age + 1 at the hit) to bm.
  - The engine tests for the wolf, snowman, sprint, water/splash/air, in-tick potion, wither and golem: they check port behaviour against the bytecode reading, not native rows.
  - With the entities.js / enderman changes stashed, 11 of the 12 new tests fail. The golem test passes, as expected.

## Verification
- `node --test --test-timeout=600000 src/corpse83-b83.test.js`: 12 pass, 0 fail.
- Neighbours, first batch, run with `node --test --test-timeout=600000 --test-concurrency=4`: corpse79-83, squid-bat, squid-bat-mobs, enderman, enderman-live, enderman-wolf-b42/43/44, wolf, wolf-world, wither-boss, wither-targets, mpwither-b63/64, mob-effects-b52/54/55, status-effects, iron-golem, mooshroom-golem, mpgolems-b66, revenge-target, deathfx-b59, deathdrops-b48, snow-integration, explosion-entities, headless-columns. Result: 394 pass, 0 fail.
- Neighbours, second batch, same command: entities, entities82-b82, creeperwitch-b45, blaze-ghast-world, legacy-body-b50, village-fight*, mob-victims-b51, zombie-villager, zombie-villager-reference, fireext82-b82, fire-times-b53, slime-world, horse-world, leash, ocelot, potion-fx, mob-riding. Result: 453 pass, 0 fail.
- After the lazy `dead` getter, `corpse83-b83` plus the enderman tests: 165 pass, 0 fail.
- `npm run build`: built (the usual chunk-size warning only).
- No old test encoded these gaps, so none was changed.
- No full `npm test`, no browser.

## Follow-ups
- Live zombie conversion (unported, bytecode-read): natively, after yq.cd (removeEntity only sets it dead), the rest of yq.h / sv.h runs in that tick: AI, a possible attack, push, steps and their draws. The port `continue`s.
  - This is entangled with the port's removal marker (health 0 / removed), so it was left.
  - At the same x and z, the villager and the zombie do not push each other (applyEntityCollision d² < 0.01).
- EntityEnderman.attackEntityFrom (ya.a) has no health test: a projectile hit teleports even a corpse. The port gates `endermanHurt` on health > 0 in attackEntityFrom. That code is in attack83's path and was not touched.
- The wither's head particles: natively they are drawn on the server's Entity.rand too (xc.e's tail). The port draws them on a separate visual JavaRandom (seeded from Math.random) for live and dead withers alike. This is a live gap, not corpse-specific.
- The live squid (`squid-bat-mobs.js squidUpdate`) runs no push (sv.bo). The corpse path now does; the live one was left as it was.
- EntitySheep.onLivingUpdate is client-only (the head eat animation); not ported here.
- Browser-only, not seen:
  - a squid corpse coasting or falling with its tentacles still moving;
  - an enderman corpse teleporting in water or sunlight, and its portal particles;
  - a wolf corpse shaking off water, with the splash particles and sound;
  - the snow trail under a dying snowman;
  - a corpse's splash on entering water;
  - the potion swirl over a corpse.
