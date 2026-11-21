# entnbt91 (batch 91): arrows and rockets cross portals in the away run and on the server; native-vs-port NBT audit of every EntityList id

## Summary
Not full parity; open items are at the end.
- **Away run (done).** `away-entities.js` `portalTravel` now also walks `arrows.list` and `rockets.rockets` (same `EntityPortals.step` / `entityDeparture` / `travellers` / `finishAway` / `deliver` chain as orbs, items and mobs). Arrows and rockets pass `counted: true` (their own update already ran sa.C), and an arrow with `groundAtStart` passes `noCollide` (zc.h returns before I()).
- **Dedicated server (done, arrows and rockets only).**
  - New `src/multiplayer/server-portal-shots.js` (`ServerPortalShots`): per tick it walks the arrows of every dispense lane and the rockets of every dimension instance, and moves one that stands in a portal to the destination with `travelRoute`, the finite-world coordinate scaling of `ServerDimensions` (MIDDLE 64, MARGIN 24) and `placeEntity`, keeping the save record (damage, pickup, life, tile, inGround, shake / Life, LifeTime, FireworksItem). No shooter is kept (zc.b saves none). PortalCooldown is 300, Dimension is dropped as in the live path.
  - `server-dimensions.js`: constructs `this.shots`, calls `this.shots.step()` in `afterTick`, and `arrive` now calls a new `placeEntity(e, from, to, teleporter = true)` (the player's placement, shared).
- **NBT audit (new).** `tools/probes/Entnbt91Probe.java` + `tools/verify-entnbt91.mjs` summon every registered EntityList id through the real CommandSummon (plain, and rich for living ones) and write `public/research/entnbt91-reference.json` (88 rows, 250 KB): `writeToNBTOptional` hex, and the `createEntityFromNBT` copy written again. The new test imports each native tag through `importJavaRegionArea`, exports through `exportJavaSave` and compares every tag.
- **Fixes from the audit.**
  - `region-export.js`: every mob now writes `CustomName` ("" when unnamed) and `CustomNameVisible` (the port wrote them only when named: sw.b writes both unconditionally); a pigman writes `IsBaby` only when a child and `IsVillager` only when set (it wrote both always; the native PigZombie row has neither); a Giant and an Ender Dragon no longer write `Age` / `InLove` (not EntityAgeable); an item no longer writes `PickupDelay`.
  - `entity-base-nbt.js` `mobBaseOf`: a chunk mob keeps a saved `Air` other than 300 (it was reset to 300 on every load; the port models mob air in `breathe`).
  - `region-import.js` `cartFromNbt`: reads `CustomDisplayTile` / `DisplayTile` / `DisplayData` / `DisplayOffset` (the export and the cart renderer already model them; the import dropped the display block).

## Evidence
- **Executed** (real 1.7.10 classes through CommandSummon, `entnbt91-reference.json`): per-id key sets and values of Item, XPOrb, PrimedTnt, FallingSand, Painting, ItemFrame, all projectiles, rockets, all carts, Boat and every mob id; and the load-then-save copy of each (no id fails to reload; `Mob` and `Monster` are abstract and not summonable).
- **Bytecode-read:** `sw.b` writes CustomName (bG) and CustomNameVisible (bI) with no branch; no class in the jar holds the string `PickupDelay` (so 1.7.10 neither saves nor reads it); `zc.h`, `zf.h`, `sa.b(I)` as in entnbt89 / 90.
- **Port-read:** the away and server walks (`away-entities.js`, `server-dispense.js`, `server-dimensions.js`).

## Verification
- `node --test --test-concurrency=2 src/entnbt91-b91.test.js`: 5 pass (4 portal tests + the audit). With the three source changes stashed the audit test fails (missing CustomName, Air 100 -> 300, missing cart display); portal tests were checked failing without their fixes earlier in the batch.
- The 90 test files that name region-export, region-import or entity-base-nbt: 1145 tests, 1145 pass, 0 fail (`grep -lE "region-export|region-import|entity-base-nbt|keptBaseImport|mobBaseOf" src/*.test.js | xargs node --test --test-concurrency=2`). `npm run build` once: ok.

## Found wrong in the batch 90 / earlier lists
- Earlier notes and the comment at `region-export.js` said CustomName is written "only when named": wrong for mobs (bytecode and executed). Tile entities (chests etc.) do write it only when named, that stays.
- `PickupDelay` on the exported Item was a later-version key.
- Pigman `IsBaby` / `IsVillager` always written, Giant / Dragon `Age` / `InLove`: not native.
- Probe artifacts, not losses: a /summon tag without Air / xTile / Fire reads 0 natively (a thrown entity naturally starts at -1), and CommandSummon sets a hanging entity's Rotation.

## Follow-ups (still open)
- Server mobs, items, XP orbs, carts and boats still do not cross portals (only players, arrows, rockets do): the server has no per-entity travel for them.
- `HurtTime` / `AttackTime` are written 0 (native keeps the counter); a witch's Equipment[1..4], DropChances and CanPickUpLoot are lost on import (witch only models the held potion); a fireball's saved in-ground state is not modeled; the firework item tag is rewritten with an empty `Explosions` list; the import still reads `PickupDelay` (native ignores it; the delay a reloaded item has needs a bytecode check of the EntityItem constructor); `Fire` of a hanging entity (-1 exported, native value for a natural one not proven).
- Browser-only: seeing an arrow or rocket arrive in the Nether in an away trip and on the server; a command cart with a custom display block loaded from a Java save.
