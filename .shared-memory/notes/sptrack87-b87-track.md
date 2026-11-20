# sptrack87 (batch 87) track

Branch `batch87-sptrack87` (from 0.115.0, b95bfd9ac). Task: entity tracking after lanes86. Four parts: the single-player tracker's spawn state, the state a player returning to a dimension gets, a hook left behind as a blast target, and the stand-in lane duplicate.

## Summary

1. **Single-player spawn state.** `ObjectTracker` (src/object-tracker.js) has a new `birth(e)`. It copies an object's state before its first update, and `create` starts the entry from that copy. The entry's baseline and its S0E therefore carry the spawn state, and the next position packet is the move from there.
   - Before this, an object spawned inside the list walk, or an eye or hook ticked before the tracker pass, got its first S0E at the state after its first update.
   - The `tracker-birth.js` record of a boat or cart still wins.
   - A copy older than the last pass is stale and is replaced. This covers an entity that was never tracked, for example one in an unloaded chunk.
   - An item takes the copy's random yaw, so later reads agree with the S0E.
   - main.js calls it in four places, each a one-line edit:
     - `mobs.walks = birthWalks(entityWalkers(...), () => objectTracker)`, where each walker tick copies the entity before ticking it;
     - before `eyes.tick`, for every eye;
     - before `fishing.tick`, for an active hook;
     - on the unwalked path (no mob system), for every tracked list before `tickEntitySimulation`.
2. **A player returning to a dimension.** `ThrownTracks.update` (src/multiplayer/thrown-tracks.js) no longer tries a new watcher before the pass with the state the entry read last tick. A watcher whose chunks went out this tick is tried inside the pass instead. That is either a new watcher (a player arriving or returning) or one with `fresh` columns.
   - An entry older than the watcher is tried after the entry reads this tick's state. In native terms, the entity is before the player in loadedEntityList, so it has already updated.
   - An entry newer than the watcher is tried before the read, with last tick's state, because natively it has not updated yet.
   - Both then get this pass's packets. For an older entry the new watcher gets the S0E of the current state plus the delta from the shared baseline. This is the native double delta.
   - Watchers and entries carry a `seq` (join order) to tell older from newer.
   - The second loop (a player who moved more than 4 blocks or is new) still re-tests after the pass. The `fresh` re-test moved before it.
   - The same thing happens in both port orders:
     - order (i), Overworld to Nether: the transfer comes in afterTick, before the Nether's tick;
     - order (ii), Nether to Overworld: the transfer comes after the Overworld's flush.
   - Natively the transfer is always after every world's tracker (networkTick), so the dest's next tick is the first chance either way.
   - The S0E is the state of the first pass in which the gate opens: the first tick with the gate always open, or the tick the column streams in with the chunk views.
3. **A hook left behind is a blast target in its own world.** `ServerFishing.hooksIn(dim)` (src/multiplayer/server-fishing.js) lists every live hook of `dim`, wherever the angler is now. `ServerMobs.explode` (src/multiplayer/server-mobs.js, one line) reads `hooksIn(host.dispense.dim)` instead of `hookOf(view.player)`.
   - `host.dispense` is the swapped dimension's instance: dim 0, -1 for the Nether, 1 for the End.
   - So an Overworld blast pushes the hook of an angler who went to the Nether, and a Nether blast at the same coordinates does not.
4. **Stand-in lane duplicate: already prevented. No code change.**
   - In this test, the stand-in lane's tracker does spawn the arrow to the Nether player inside its update when the Nether is built and the stand-in adopted mid-update.
   - `ServerDispense.flush` checks `this.extra.has(dim)` in its player loop after the lane updates, so it skips that player and the rows never go out.
   - The Nether instance's own tracker then sends the one copy under its own id.
   - In a whole tick the players' loop (`ServerDimensions.within`) builds the Nether before the flush anyway, so the mid-send build only happens when the flush is driven alone.
5. **Old test updated.** `src/lanes86-b86.test.js` test 2 encoded the gap: `spawn.z === Math.floor(read * 32)`, the state read last tick. It now expects this tick's state (`Math.floor(e.z * 32)`, and not the last-read one).

## Evidence

- **Bytecode-read** (`javap -c -p` on tools/research/minecraft-1.7.10.jar):
  - The spawn chain:
    - `ahb.d(sa)` (spawnEntityInWorld) adds the entity to loadedEntityList (`e`, offset 98), then calls onEntityAdded.
    - `mp.a(sa)` (WorldManager.onEntityCreate) calls `mt.r().a(sa)` (trackEntity).
    - `mn.a(sa,int,int,boolean)` calls `my.b(playerEntities)`.
    - So the S0E (`my.c`) is built from the fields at the spawn. A spawn inside updateEntities is appended to the list being walked and updates in the same pass.
  - `my.b(mw)` writes only `j/k/l` (the motion, offsets 254..276). The position baseline `d/e/f` is untouched, so the pass's `my.a(List)` sends the delta from the old baseline to every watcher, the new one included.
  - The world tick (`MinecraftServer.updateTimeLightAndEntities`): for each world, `mt.b()`, then updateEntities, then `mt.r().a()` (updateTrackedEntities). After all worlds comes `nc.c()` (networkTick).
  - The portal transfer runs inside networkTick: `nh.a(jd)` → `mw.i()` → `sa.C()` → `mw.b(int)` → `oi.a(mw,int)`.
  - `oi.a(mw,int)`, in order:
    - 81: `mt.f(player)`;
    - 96: transferEntityToWorld, then `mt.d(sa)` (trackEntity: every entry tries the player);
    - 103: `a(mw,mt)` (`mq` removePlayer / addPlayer).
    - So at trackEntity time the player is not in the new PlayerManager yet, the chunk gate `mq.a(mw,int,int)` fails, and nobody spawns there. None of the thrown classes set forceSpawn: no `putfield sa.n` in zc, zj, zl, zm, zo, zn, zd, zf, xe or sa.
  - `mw.h()` (EntityPlayerMP.onUpdate, the player's own slot in updateEntities) sends the S26. Then, at 489..495, for each chunk it calls `mt.r().a(mw, apx)`, and `mn.a(mw, apx)` calls `my.b(mw)` for every entry whose entity's chunk coordinates (`sa.ah/aj`) are that chunk.
  - `mn.a()`'s second loop: the players whose own entry set `my.n` re-test every entry after all `my.a(List)`.
- **Executed (the port, not the 1.7.10 classes):** `src/sptrack87-b87.test.js`, 8 tests, plus the neighbour suites below.
  - The dedicated-server test makes each transfer at the port's own point. It wraps `checkPortal` inside afterTick, then checks the first S0E against the entity's state at that flush, for both orders.
  - The stand-in test drives `ServerDispense.flush` with the Nether built inside the stand-in tracker's update.
- **Port-read:**
  - Where the Nether gets built in a whole tick (`within`, in the players' loop). Shown by a probe run, not an assertion.
  - That entry order (`seq`) stands for loadedEntityList order.
  - That the port's column streaming at the start of the dimension's tick stands for `mw.h`'s chunk send at the player's slot.

## Verification

- `node --test --test-timeout=600000 --test-concurrency=2` on 28 files: 321 pass, 0 fail. The files: sptrack87-b87, lanes86-b86, mphook85-b85, mpthrown84-b84, mpstats2-b64, mpstats3-b65, b62-lead, mpend2-b64, tracker-timing-b48, object-tracker, object-tracker-vehicles, object-tracker-extras, object-tracker-hits, mpexplosion78-b78, blast81-b81, blastcover86-b86, fishing-simulation, fishing, mpdispense-b61, mpprojectiles-b62, mpprojectiles2-b63, tracker-joint2-b53, trackertransient-b64, player-throw-replay, mobrec86-b86, deathdrops-b48, mobcells73-b73 and skins73-b73.
- On the pre-change source the new test file fails to load, because it imports `birthWalks`. The stand-in test passes on the old code by design (finding 4).
- No test source-matches the main.js lines changed. I grepped the 33 tests that read main.js.
- `npm run build`: passes. The full `npm test` was not run (track rule).

## Follow-ups

- The single-player birth copy covers walked objects, eyes and the hook. Objects that update outside the walk and before the tracker pass may still start at their post-update state, if such paths exist. I found none beyond eyes and the hook.
- On the unwalked path (no mob system), objects spawned inside `tickEntitySimulation` are not copied. Most of them are not updated in the same pass there anyway.
- Native `mw.h` sends the chunks and tries their entities at the player's slot. In the port, columns stream at the start of the dimension's tick, before the use, dispense and entity passes. So an entity spawned between the stream and the player's slot natively comes after the player (its spawn try passes the gate). The port's split by `seq` matches that, but where the player's slot falls among spawns inside the walk is not modelled on the server.
- The mob trackers (server-mob-entries.js, not mine) may have the same returning-player state question. I did not check them.
- Browser-only, not checked:
  - a single-player arrow, eye, hook or item drop appearing at its spawn point and moving smoothly from there;
  - a copy reappearing at the right place after a portal round trip, including the native one-tick overshoot of the double delta;
  - a hook left in the Overworld visibly jumping from a blast while its angler is in the Nether.
