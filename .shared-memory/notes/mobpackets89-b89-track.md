# mobpackets89 (batch 89) track

Branch `batch89-mobpackets89` (from 0.117.0, 6cd02f772). Task: mob tracking packets after track88:
1. S20 (entity properties) for mobs;
2. S1D (entity effect) for mobs, and the client's effect particles;
3. the mob tracker entry made at the spawn;
4. a skeleton's arrow updating in the tick it is shot.

This is not full parity. What is still open is listed under Follow-ups.

## Summary

1. **S20.** New `src/mob-tracked-attributes.js`:
   - `watchedAttributes(e)` returns the watched rows `{ name, base, mods: [[amount, op]], value }`: generic.maxHealth, generic.movementSpeed, and horse.jumpStrength for horses.
   - The movement value is the same one `aiMoveSpeed` reads. entities.js now exports `moveSpeedModifiers(e)` (a small local change to `aiMoveSpeedReference`).
   - `firstDirty(e, rows)` gives the rows a mob's first gated pass sends.
   - `SharedEntry` (src/multiplayer/server-mob-entries.js):
     - `startPackets` emits S20 with every watched row right after the S1C (`my.b(mw)` order).
     - The new `sendLocation` override runs `sendAttributes()` inside the gated branch, after the position packets and S1C. The S12 of `velocityChanged` comes after it.
     - `sendAttributes()` sends `firstDirty` on the first pass, then the rows whose base, modifiers or value changed.
   - The client copy (`RemoteMobs.attributes`) stores the rows on `client.attributes`.
   - Natively the walk animation (limbSwing) comes from the position delta, not movementSpeed (EntityLivingBase.onUpdate reads posX - prevPosX). So the copy only stores the attribute; nothing animates from it.
2. **S1D.**
   - `startPackets` emits one S1D per active effect after the S04s, in HashMap<Integer> order (`effectsInMapOrder`). `effectPacket` encodes the id and amplifier as bytes and clamps the duration to a short.
   - **The task's claim that the world sends S1D / S1E as mob effects change is false for 1.7.10.**
     - EntityLivingBase's `onNewPotionEffect` / `onChangedPotionEffect` / `onFinishedPotionEffect` (sv.a(rw), sv.a(rw, Z), sv.b(rw)) only move attribute modifiers and flag the potion update.
     - Only EntityPlayerMP (mw) overrides them to send S1D / S1E, and only to its own connection.
     - So a mob's watchers get S1D only when they start watching. Later changes reach them as the watcher 7/8 colour (S1C) and as S20 for modifier effects.
   - `RemoteMobs.effect` keeps the S1D list on `client.effects`, combining like PotionEffect.combine. `living()` counts the list down and never removes an entry: removal is guarded by `!isRemote`.
   - The copy now draws the mobSpell swirl from watcher 7 through `fx.particle`, using the same `potionParticles` / `deathRandom` order as copy-meta's copyPotionSwirl.
   - The renderer's `isInvisible(mob)` follows the watched invisible flag (`mob.effects` is set from `client.invisible` each tick).
3. **The entry made at the spawn.** Natively World.spawnEntityInWorld → onEntityAdded → EntityTracker.addEntityToTracker makes the entry and runs updatePlayerList before the mob's first update. The port makes the entry in the tracker pass after the entity pass. Changes:
   - `SharedMobTracker.beforePass` records a snapshot (`births`) of each mob without an entry; ServerMobs adds one line, `this.tracker.birthList = () => this.mobs.entities`.
   - `create` builds the entry (baseline, S0F state) from that snapshot. `updatePlayerList` uses it for the spawn try, and a watcher joining in the same server tick (`late89`) is not tried by it.
   - The first update's equipment check (EntityLivingBase.g starts empty) now sends the held slots again after the spawn try. For a mob spawned during the pass it sends them at the next beforePass.
   - Bytecode-read: the first pass (`ticks == 0`) sends no position packet but stores the last sent position, because `flag` holds at `ticks % 60 == 0` (my.a 977..995, outside the `ticks > 0` test). So the first update's move is absorbed natively too. The port's TrackerEntry already did this.
   - **Old tests updated (they encoded the gap):** src/track88-b88.test.js
     - The late viewer's S04 list now has the first update's duplicates.
     - The S0F head byte test sets the angles at the spawn: the S0F carries the spawn state.
4. **Skeleton arrows.**
   - `ServerProjectiles` wraps `mobs.shoot`: `shot()` copies the arrow's join state for the tracker (`ThrownTracks.birth`), and `tickJoined()` (after the mobs' pass) gives it its first update in the same tick.
   - Before this, arrows ticked in `tickLane`, before the mobs, so a fresh arrow waited for the next tick.
   - `ServerDispense.tickLane`'s arrow loop is split into `arrowCtx(lane)` / `tickArrow(lane, a, ctx)`; the behaviour is unchanged.
   - The Nether has its own ServerProjectiles, so the same path applies there.

## Evidence

- **Executed:** `tools/probes/MobPackets89Probe.java` via `node tools/verify-mobpackets89.mjs` → `public/research/mobpackets89-reference.json` (32 records; class digests for sv, sw, tq, tl, tn, yj, rv, rw, my).
  - For each of the 29 living classes: the dirty set after the constructor (`made`), after onSpawnWithEgg (`egg`) and after an NBT read (`read`), plus every watched row.
  - For Pig, EntityHorse and Zombie: the dirty sets after Speed, the same Speed again, a stronger Speed, Slowness, Health Boost, Regeneration and clearActivePotions, plus the values with effects.
  - Results:
    - Only maxHealth and movementSpeed are watched (and the horse's jump).
    - Re-adding the same Speed dirties movementSpeed again.
    - Regeneration dirties nothing.
    - Pig with Speed II, Slowness and Health Boost: maxHealth 14 and movementSpeed 0.2974999991804361.
- **Bytecode-read** (`javap -c -p` on the 1.7.10 jar):
  - my.b(mw) packet order (S0F, S1C, S20 tq.c(), S12, S1B, S04, S1D);
  - my.a(List) calling my.b() (S20 of tq.b(), then clear) inside the gated branch, before the last-position stores;
  - tq.a(tn) watched-only dirtying;
  - the in(int, rw) encoding;
  - the sv potion callbacks and the mw overrides;
  - spawnEntityInWorld → mn.a(sa);
  - updateEntities' index walk (the arrow updates in the pass it spawns);
  - yl.a(sv, F) ending in spawnEntityInWorld.
- **Port-read:** the port's tick order (dispense.tick → mobs.tick → … → dispense.tickJoined) and tracker internals.

## Verification

- `node --test --test-timeout=600000 src/mobpackets89-b89.test.js src/track88-b88.test.js`: 19 pass, 0 fail.
- Neighbours: 69 files (every test naming server-mob-entries, SharedMobTracker, RemoteMobs, server-dispense/projectiles, skeletonShoot, tickJoined, aiMoveSpeed, ServerMobs or mobPackets, plus the mpperf85/86, mptrackers71, awaytracker, entity-tracker, mob-effects, potion-fx, mobs84 and spcopy88 tests), run with `--test-concurrency=4`: 645 pass, 0 fail.
- `npm run build` once at the end: built (only the usual chunk-size warning).
- No browser checks (track rules). Only a browser can confirm:
  - the remote mobs' mobSpell swirl as drawn;
  - an invisible mob hidden (with no shadow) in multiplayer;
  - nothing visibly wrong from the S04 duplicates.

## Follow-ups

- The port's change test misses the native no-op S20 when the same effect is re-added (executed: native dirties it). Fixing it needs a dirty flag set on each add.
- S20 row order: native HashSet order; the port uses a fixed order (maxHealth, movementSpeed, jump).
- The head S19 natively follows S1C / S20; entity-tracker.js (mpperf89's file this batch) sends it before.
- Wither movementSpeed: the port has 0.6, native is (double)0.6F = 0.6000000238418579.
- Watcher 8 (ambient) is not carried by copy-meta, so the copy's swirl is never the ambient one.
- PotionEffect.performEffect on the client is not modelled (the copy only counts down).
- The mob spawn packet's `mobState(e)` (the S0F's mob-specific fields) reads the live state, not the birth snapshot.
- Arrows or mobs spawned mid-pass by other paths (dispensers, eggs during the pass) still update one tick late in the port.
