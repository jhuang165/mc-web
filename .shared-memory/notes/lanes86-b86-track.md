# lanes86 (batch 86) track

Branch `batch86-lanes86` (from 0.114.0, e814bef37). Task: the thrown-entity tracker lanes after mpthrown84 and mphook85: stand-in lanes, late viewers, hooks across range and dimension changes.

## Summary

1. **One shared entry per entity.** `ThrownTracks` (src/multiplayer/thrown-tracks.js) now holds one `ThrownEntry` (an `ObjectEntry` with a watcher set, the `SharedEntry` pattern of server-mob-entries.js) per entity, as native `EntityTracker` holds one `EntityTrackerEntry` with its `trackingPlayers`. Batch 84 kept one entry per (player, entity). All watchers share the baseline (lastScaled, angles), the last-sent motion (`j/k/l`) and the tick counter. Every packet goes to the set; the spawn and its S1C go only to the watcher being tried.
2. **Late viewers.** A player who comes into range later (the re-test after moving more than 4 blocks or a column change, or the entity's own re-test after it moves more than 4 blocks) gets an S0E built from the entity's current position, rotation and motion (`func_151260_c`), then the S12, and the shared motion is set to the current one. Its later packets are deltas from the one shared baseline, the same packets the other watchers get. Checked for all nine kinds: arrow (S0E motion, shooter id), snowball, egg, pearl, potion (damage), bottle, eye, rocket, and the hook with its angler id and row `sh`.
3. **Join state correction.** The players in range when an entity joins get the S0E at the join (`mn.a(sa,int,int,boolean)` calls `my.b(world.playerEntities)`), built from the join state that `birth` copied. Batch 85's note and test 3 of `src/mphook85-b85.test.js` had the S0E at the flush state. That test now expects `spawn.z === 16` (the join); `move.dz === 96` is unchanged.
4. **Dimension changes.** A player who is no longer among a tracker's players leaves every set without an S13 (`untrackEntity`; the client builds a new RemoteDispense with the trip). On return, every entry tries the player at once and sends a new S0E. Batch 84's per-player entries were never pruned, so a returning player got nothing until the entity died. Port order: the arrival is tried before that tick's tracker pass, so its S0E is the state the shared entry last read.
5. **Range leave.** The watcher leaves the set, and its S13 is held one tick like the other destroys (`mw.d(sa)`, destroyedItemsNetCache).
6. **Stand-in lanes.** `ServerDispense` (server-dispense.js) has one `ThrownTracks` per lane (`tracksOf(lane)`). The instance's lane uses `thrownTracks` and each stand-in lane gets its own, all with the same cadence table (`OBJECT_KINDS` from `mn.a(sa)`). Each tracker gets only the players of its lane's dimension. The exact `k: 'a'` and `k: 'b'` rows for arrows, thrown balls and potions are gone from `snapshot`; TNT, fireballs, golem snowballs and skulls keep theirs. `laneFor(0)` asked from a Nether or End instance returns the Overworld instance (`sim.dispenseHome`). Before, it returned a dimension-0 stand-in, because `dimState(0)` is null. At the start of each tick, a stand-in whose dimension now has its own instance is adopted there. The Nether and End instances were already on tracker rows since batch 84.
7. **Hooks across a dimension change.** A dimension change no longer kills the hook (server-fishing.js). The hook keeps ticking in its own dimension against the angler's raw coordinates, and dies at the first update past 1024 squared, when the angler is not alive, or when the angler holds no rod. A rod use from the other dimension sets `farReel`. The reel runs in the hook's dimension at the fishing tick: the catch spawns in the hook's world and the XP orb in the angler's. `hookOf(p)` returns the hook only in the angler's current dimension (server-mobs blast rows). The angler is not a hit target of a hook in another world.

## Evidence

- **Bytecode-read** (`javap -c -p` on tools/research/minecraft-1.7.10.jar):
  - `mn.a(sa,int,int,boolean)` 37..85: `new my`, the set add, then `my.b(playerEntities)` at join.
  - `my.b(mw)`, tryStartWachingThis:
    - the range test on `d/32`, `f/32`, and `d(mw)` isPlayerWatchingChunk;
    - `c()` (func_151260_c) from the current entity fields, then `j/k/l = v/w/x` (shared), and the S12 when `u`;
    - out of range: remove and `mw.d(sa)`.
  - `mn.a()`: every entry's `my.a(List)` first, then the players with `my.n` re-test every entry.
  - `mn.a(sa)` / `mn.b(sa)` for an EntityPlayerMP: every entry tries or drops the player.
  - `my.<init>`: the floor(pos*32) baseline.
  - `my.a(List)`: the 16-squared re-test with `b(List)`.
  - `oi.a(mw,int)` 78..86: `ahb.f(player)` (setDead, list removes, `b(sa)` untrack), then `isDead = false`.
  - `xe.h` 167..246: setDead + `angler.bK = null` if the angler is dead, not alive, holds no rod, or is more than 1024 squared away.
  - `xe.e` 294..298: the item spawns in `this.o` (the hook's world); 303..363: the orb in `b.o` (the angler's).
  - The cadence table from `mn.a(sa)` is unchanged from batch 84.
- **Executed:** `src/lanes86-b86.test.js` (5 tests) and the neighbour suites below. These run the port, not the 1.7.10 classes.
- **Port-read:** the tick order of a join relative to the lane's tracker pass, and the far reel running at the fishing tick rather than inside the use. Native order depends on which world ticks first.

## Verification

- `node --test --test-timeout=600000 src/lanes86-b86.test.js src/mphook85-b85.test.js src/mpthrown84-b84.test.js src/mpstats2-b64.test.js src/b62-lead.test.js src/mpend2-b64.test.js`: 34 pass, 0 fail.
- `src/mphook85-b85.test.js` test 3 was updated to the join-state S0E. Before the update it failed (expected 112, got 16).
- `src/mpdispense-b61.test.js src/mpprojectiles-b62.test.js` (with b62-lead, mpend2, mpstats2): 43 pass, 0 fail. `src/fishing.test.js src/fishing-simulation.test.js src/mpstats2-b64.test.js`: 26 pass, 0 fail.
- 21 neighbours (attack83, blast81, explfx79, mpball82, mpcombat74, mpcopies81, mpexplosion78, mpdragon2, mpgolems, mpfx80, mpstats3, mplightning, mpwither-b64, mpprojectiles2, mpplace82, mpsleep, mpspawners2, mpsummon, mpwither-b63, particles73, serverprops2): 193 pass, 0 fail.
- `src/rain83-b83.test.js src/sounds73-b73.test.js src/spexec79-b79.test.js src/mppredict85-b85.test.js src/mpperf84-b84.test.js src/multiplayer.test.js src/dispense.test.js`: 45 pass, 0 fail.
- The new test file fails 5/5 on the pre-change code (stash check).
- `npm run build`: passes. The full `npm test` was not run (track rule).

## Follow-ups

- server-mobs.js (not mine): blast rows read `hookOf(v.player)`, so a hook left in another dimension is not pushed by explosions in its own world. They should list `fishing.trackList(dim)` hooks instead.
- The single-player `ObjectTracker` (object-tracker.js, not mine) still sends its first S0E at the flush state. It has one viewer, so only the join-state baseline matters there.
- A stand-in lane's tracker could, in theory, spawn to a player whose dimension state is built during the flush (chunk gate -> `worldOf` -> ensureNether -> adopt). The instance's tracker would then send the same entity again under another id. This is not reachable through `arrive`, which builds the state first.
- Browser-only (not checked): late-viewer copies appearing at the right place and flying smoothly; a copy reappearing after a round trip through a portal; the hook line when the angler is in another dimension or out of the client's world (native draws to the stale angler entity); the cross-dimension catch flying toward coordinates in the other world.
