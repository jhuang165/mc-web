# portals92 (batch 92): mobs, dropped items, XP orbs, minecarts and boats cross portals on the dedicated server

## Summary
Not full parity; open items are at the end.
- **New `src/multiplayer/server-portal-travel.js` (`ServerPortalTravel`).** One walk per dimension over the mob list (`ServerMobs.mobs.entities`), item list (`ItemEntities.items`), orb list (`ExperienceOrbs.orbs`) and the cart and boat lists (`ServerVehicles.carts.carts`, `.boats.carts`). It reuses the single-player code: `EntityPortals.step` (the 300-tick `timeUntilPortal`, `setInPortal`, the doBlockCollisions box, End portal at once), `entityDeparture` (the NBT record from the owner's `serializeOne`, the saved `Dimension` as travel source, rider dropped, cooldown 300) and, for the destination, `ServerPortalShots.placed` -> `ServerDimensions.placeEntity` (finite-world scaling, Teleporter, End platform / spawn exit). No second copy of the portal rules.
  - Arrival: a mob is `restore`d from its record (new id, portal motion, cooldown kept) and joins the destination `ServerMobs`; an item goes through `ItemEntities.load` (its `joined` hook gives it a new eid); an orb is rebuilt with `ExperienceOrbs`; a cart or boat through `Minecarts.fromJSON` / `Boats.fromJSON` with a new id in the destination list.
  - The client sees it through the existing trackers: the old entity leaves the list (mob entry diff -> S13, item / orb row diff -> destroy, vehicles message `del`), the copy enters the destination's list (S0F / spawn row / vehicles `set`). Departures happen after the dimension's tick and message, so the destroy and the spawn go out with the next message (native: the S13 follows the update that moved the entity).
  - Skipped as natively or as the single-player walk: a mob with a rider or a vehicle (BlockPortal ignores it; the countdown still runs), `ender_dragon` and `ender_crystal` (`SKIPPED`: no moveEntity/doBlockCollisions). A ridden cart or boat never starts a countdown; one already counting down travels, its player rider is put down (`ServerVehicles.dismount`) and a mob passenger that mounted late stays. A lead held by a player drops as an item at the destination (the holder is not there). `allow-nether=false` stops the Nether and End walks and a Nether portal trip in the Overworld (an End portal still travels), as for arrows.
- `server-dimensions.js`: constructs `this.travel`; `afterTick` walks the Overworld (`travel.step(0)`), `netherMessage` walks the Nether or End after that dimension's tick and message.
- `server-portal-shots.js`: the placement half of `arrive` is now `placed(...)`, shared with the new class (no behaviour change for arrows and rockets).

## Evidence
- **Bytecode-read** (`javap -c -p` on the 1.7.10 jar):
  - `sa.b(I)` as in entnbt89: client world or dead -> return; `sg.b(this)` names the class and `sg.a(name, world)` builds the copy; `copyDataFrom(old, true)` copies NBT; old entity removed, copy spawned in the destination. An id `sg` does not register would yield no copy (every port kind is registered).
  - Overriders of `b(int)` among entity classes in the jar: `xk` EntityItem (super, then `k()` the merge search on the original), `xp` EntityMinecartContainer (`dropContentsWhenDead = false` first, then `xl.b`), `mw` the player. No other class (so the Wither, like any mob, travels natively; the dragon never reaches a portal collision because it does not call moveEntity).
- **Port-read:** server list shapes, tracker diffs (`serverStep` sweep, object tracker `rows`, vehicles `del`), the single-player `dimension-live.js deliver` / `arriveLive` that the arrival code mirrors.
- Not Executed: no probe run (travelToDimension needs a MinecraftServer with three worlds, as in entnbt89).

## Verification
- `node --test --test-concurrency=2 src/portals92-b92.test.js`: 9 pass. With the two `travel.step` calls removed 7 of the 9 fail (the two that pass assert a ridden mob and the dragon stay).
- Every test naming server-dimensions, server-portal, ServerDimensions, `dimensions.nether`, netherMessage, `ensureNether` or entnbt91 (31 files): 261 tests, 261 pass, 0 fail. `npm run build` once: ok.

## Found wrong in the batch 91 list
- None. The batch 91 line "mobs, items, orbs, carts and boats on the server do not cross portals" is now closed.

## Follow-ups (still open)
- A lead held by a knot: natively `Leash` X/Y/Z is looked up in the destination world and re-attaches if a knot stands at the same cell (Port-read from the single-player code only; not modelled, the lead keeps its record and `leashTick` breaks it).
- Server mob fields that the tracker or AI keeps outside the save record (target, tracker `known`, pending S1C) start fresh on the copy.
- Walk order: the Overworld is walked after its own tick but before the Nether ticks (an Overworld arrival in the Nether ticks there in the same port tick, as native world order 0, -1, 1); the End and Nether walk after their tick. Not checked against an executed trace.
- Browser-only: seeing a mob, item, orb, cart or boat vanish and appear in the other dimension on a live server.
