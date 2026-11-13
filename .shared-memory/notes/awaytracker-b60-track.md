# Batch 60 awaytracker: non-mob entities keep their tracker phase across a Nether or End trip

## Summary
- `src/away-track.js` (new): `keptIn(spawn)` (chunk of the entity inside the 128-block spawn square) and `awayCatchUp(mobs, objectTracker, lists, world, idle)`, which catches up the kept mobs and the kept objects (items, orbs, arrows, thrown, TNT, falling blocks, rockets, eyes, boats, carts, paintings, frames, knots; not the angler's hook) together, so one HashSet order and one id sort cover both.
- `src/entity-tracker.js`: `idleCatchUp(mobs, size, ticks, joint)` passes `joint` to `idleUpdate`. `src/entities.js`: `idleTrack(ticks, keep, joint)` passes it on.
- `src/main.js` (three short edits): `awayIdle` taken where the b59 call was; the catch-up runs once the object lists are loaded, just before `mobs.jointTracking` is set; import swapped.
- `src/awaytracker-b60.test.js` (new, 5 tests).

## Evidence
- Executed (existing, b58): `tracker-joint-reference.json` dimAge cases: mob and object entries made in an unwatched world run the silent tick and are sent at the join in set order; the spawn packet carries the entity's current state, not the entry's last sent state (`trackerphase-b58.test.js` replays it for items, orbs, arrows, boats, carts, frames and mobs together). The new wiring calls that same `idleUpdate`.
- Bytecode-read (b59): `MinecraftServer` ticks every world's EntityTracker with no player; the spawn area stays loaded in the Overworld only.
- Bytecode-read (new, javap on `bjb` = NetHandlerPlayClient, method `a(hs)` = handleRespawn): when the packet's dimension differs from the player's, it runs `new bjf(...)` (WorldClient) and `bao.a(bjf)` (loadWorld). So every client copy is gone at a dimension change and a new one is made from the spawn packet.
- Recalled: a spawn packet makes a new client entity (ticksExisted 0).

## Findings on the three gaps
- Non-mob entities: real, closed above (single-player wiring only; multiplayer not touched).
- Mob "final state": mostly wrong. The re-entry spawn packet is built from the entity's current state (executed, b58), and the copy starts at that position with no interpolation. What native keeps and the port does not is the entry's last-sent history (see follow-ups); that is not "final state" of the copy.
- Mob age: the live mob's age is kept (saved record `age`, tested; the catch-up does not tick entities). The client copy's age is 0 at the join natively (new WorldClient, new entities), so "not kept" is what native does: found wrong for the copy.

## Verification
- `node --test src/awaytracker-b60.test.js` -> 5 pass.
- `node --test src/tracker*.test.js src/dimension-live.test.js src/dimension-away.test.js src/away-world.test.js src/away-trip.test.js src/entity-tracker*.test.js src/trackeridle-b59.test.js src/awaytracker-b60.test.js src/object-tracker*.test.js` -> 283 pass, 0 fail.
- `npm run build` ok. Full npm test not run (batch rule). No browser checks.

## Follow-ups
- Entries are made at the final state of the trip, not run through the away worker's 1200 moving ticks. Natively an entry's last sent position, motion and angles are those of its last update before the freeze (up to 4/32 block off the final position), so the first relative move packets after the return can differ by that offset. Exact replay needs the worker to run the tracker per tick and hand back entry states.
- Entities that entered the loaded area during the trip (spawned in the away run) get the whole trip's age instead of their own.
- Mobs outside the spawn area keep their saved `age` on reload (native ticksExisted is not saved and restarts at 0); unchanged and probably only visible in animation phase.
- A browser look at objects returning after a Nether round trip was not done.
