# track88 (batch 88) track

Branch `batch88-track88` (from 0.116.0, fd68ecc68). Task: entity tracking after sptrack87. Four parts:
1. a player returning to a dimension, on the mob trackers;
2. single player's objects spawned inside `tickEntitySimulation`;
3. where an arriving player falls among the spawns of the entity walk;
4. the late viewer's mob packets.

## Summary

1. **Mob trackers, columns sent to a returning or arriving player.** The mob trackers had the issue sptrack87 fixed for thrown entities. Executed, before the fix: a pig in a later column gave the returning player only its S0F, while the player who stayed got `move dx 29`. After the fix the returning player gets `spawn, meta, move dx 29`, which is the native double delta.
   - `SharedMobTracker` (src/multiplayer/server-mob-entries.js) gives entries and watchers a `seq`, their join order, which stands in for loadedEntityList order.
   - A watcher that is joining, or whose columns went out this tick (`fresh`), is tried before the pass:
     - An entry older than the watcher is tried with the live state, which is this tick's state.
     - An entry newer than the watcher is tried with a copy `beforePass()` took before the mobs updated (`tryStartWith`). This is the state read before its update.
     - Both then get the pass's packets from the shared baseline.
   - Batch 61 to 87 re-tested a fresh watcher after the pass instead. That line (`g.initialised = false` on fresh) is removed.
   - `beforePass()` is a new line in `ServerMobs.tick` (src/multiplayer/server-mobs.js), after `this.use(first)`.
   - `addPlayer` sets `watcher.peek`, which is true when columns were queued this tick (ServerChunkViews adds `fresh` in its tick, before the mobs). It also sets `watcher.sameTick`.
2. **Single player, no mob system.** `tickEntitySimulation` (src/entity-simulation.js) takes an optional `hooks.born()`. It is called after each primed TNT's explosion, after each projectile hit and after the hatch events.
   - main.js passes `born: () => objectTracker.births(trackLists())` on the unwalked path only, on the existing `tickEntitySimulation(` line.
   - So a drop or a chained TNT that one explosion spawns keeps its spawn state when a later explosion in the same pass pushes it. Without the hook, its S0E had the end-of-pass state.
3. **The arriving player's slot.**
   - Natively the portal transfer runs in networkTick, after every world's walk and tracker pass. The arriving player is appended to the destination's loadedEntityList, so the spawns of the next walk come after it.
   - The port moves players in `afterTick`, after the Overworld's tick and before the Nether's and the End's. So when a player arrives in the Nether or the End, the destination's pass in that same port tick stands for a native walk that ran before the player joined, and its spawns should come before the player.
   - This changes the S0F or S0E only for an entity spawned in that pass whose chunk gate opens later: it should carry the state of the tick the gate opens, not the state read before it.
   - Fixed for mobs: a joining watcher with `sameTick()` takes its seq after the pass's new entries.
   - Fixed for thrown entities:
     - `ServerDimensions.arrive` stamps `p.arrivedAt = sim.ticks` (one new line);
     - `ServerDispense.makeTracks` passes `arrived: p => p.arrivedAt === sim.ticks`;
     - `ThrownTracks.update` gives such a watcher a seq after this update's new entries.
   - Arrivals in the Overworld come after its pass, which is already the native order.
4. **The late viewer's mob packets.**
   - The head byte and the S0F encoding already matched fz(sv): x and z by size class, y = floor(y * 32), and the angles as (byte)(int)(v * 256 / 360). There is a new test for this.
   - `SharedEntry.startPackets` now puts the packets in my.b's order:
     1. S0F;
     2. the full S1C (every watched value the port models, plus the bat's flag);
     3. the S1B packets;
     4. S04 `{type:'equipment', slot, item}` for each non-null slot 0..4.
   - `checkGear()` (in `beforePass`) models EntityLivingBase.onUpdate's equipment check. A slot not equal to the last copy goes out as S04 to the tracking players, and the copy is kept. The entry starts with a copy of the current slots, because the port's entry is created after the mob's first update.
   - `RemoteMobs.apply` (src/multiplayer/remote-mobs.js) clears the client copy's constructor gear at the spawn and applies S04.

## Evidence

- **Bytecode-read** (javap -c -p, 1.7.10 jar):
  - `my.b(mw)`, tryStartWachingThis, in this order:
    1. the spawn packet `c()`;
    2. S1C `hw(id, dw, true)` unless `dw.d()`;
    3. S20 `il` for a living entity;
    4. S12 if `u` and not fz;
    5. S1B(0), then S1B(1) for the leash;
    6. S04 `hz` for each `sv.q(i) != null`, i = 0..4;
    7. S0A for a bed;
    8. S1D for each `sv.aQ` effect.
  - `my.c()`: for `ry` or `xa`, `i = qh.d(au()*256/360)`, then `new fz(sv)`.
  - `fz(sv)`:
    - x and z by `as.a`;
    - y as floor(t*32);
    - yaw, pitch and head as `(byte)(int)(v*256/360)`;
    - motion clamped to ±3.9 and times 8000.
  - `sv.h` 65..178: at the start of the update, `add.b(g[i], q(i))`; on a difference, `mn.a(sa, ft)` sends S04 `hz` to the tracking players, then `g[i] = q(i).m()`.
  - `mw.h` -> `mn.a(mw, apx)` -> `my.b(mw)`: the chunk's entities are tried at the player's slot.
  - The transfer ordering (`oi.a(mw, int)` in networkTick) was read in batch 87 and re-used here.
- **Executed:** src/track88-b88.test.js, 9 tests, all run on the dedicated server or the real trackers. Eight fail on the base code and pass after the change. The head-byte test passes on both, because the encoding was already native. The temporary probe also ran: a pig, a player going to the Nether and back, comparing the first spawn and the moves.
- **Port-read:**
  - `seq` stands in for loadedEntityList order.
  - The copy `beforePass` takes, before `mobs.tick`, stands in for the state before the entity's update.
  - The look try covers every entry rather than only the entities of the columns just sent. The chunk gate still decides.
  - `peek` reads ServerChunkViews' `fresh` set before `takeFresh` consumes it.

## Verification

- `node --test --test-timeout=600000 src/track88-b88.test.js`: 9/9 pass.
- Targeted neighbours: `node --test --test-concurrency=3 --test-timeout=600000 src/track88-b88.test.js` plus 93 files. They were picked by a grep for the edited modules, `mobPackets`, `RemoteMobs`, `mobs.tracker`, `ThrownTracks`, `tickEntitySimulation`, `dimensions.arrive`, `checkPortal`, `mobs: true` and `server-mobs`, and include sptrack87, lanes86, mpperf87, mpstream72, mpmobs*, mpnether*, mpend*, mpthrown84, mphook85, entity-simulation* and mppistons. Result: 945/945 pass. No old test needed a change.
- `npm run build`: built.
- No browser checks.

## Follow-ups

- S20 (attributes) and S1D (effects) in my.b are not modelled for mobs: the copies have no attribute map or effect list.
- Native sends a second S04 at a new entity's first update, because `g[]` starts null. The port's entry starts from the current slots, so that duplicate is not sent. It is harmless on the client.
- Mob entries are created after the mob's first server update (spawner and natural spawns). This is the mob analogue of single player's `birth`, and it is not done here.
- Skeleton arrows do not update in their spawn tick.
- The look try covers all entries, not only those in the sent chunks.
- The thrown `arrived` path is tested at unit level (ThrownTracks). The dedicated-server order (i) run for an entity spawned in the arrival pass is port-read: it relies on the chunk gate being closed in that pass.
- Browser-only: equipment drawn on mob copies (held items and armour through S04), and the overshoot of a returning player's copies from the double delta.
