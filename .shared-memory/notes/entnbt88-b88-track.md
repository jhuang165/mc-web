# entnbt88 (batch 88): Entity NBT base keys for mobs, items, orbs, boats, carts, hanging entities and projectiles

## Summary
This follows the summon87 follow-ups. It is not full parity; the open items are listed at the end.
- **Mob saves (item 1): fixed.** `entities.js serializeOne` deleted Fire, OnGround, FallDistance and rotationPitch, because they are in TRANSIENT/INTERPOLATED. The new `mobBaseSave` puts them back when they differ from the defaults, so older records keep their shape. `restore` applies `mobBaseRestore` after `syncInterpolation` and `physics()`. readFromNBT sets rotationPitch and prevRotationPitch to the saved pitch. The region import (`java-mobs.js javaMobFromNbt`) now reads Rotation[1] % 360, OnGround, raw FallDistance and Dimension (`mobBaseOf`). `summonedMobRecord` no longer reports `Rotation[1] (pitch)` as ignored, because the summon sets it and the save now keeps it. Executed tick row: after one AI update a Pig summoned with Fire -20, FallDistance -2 and Rotation [10, 25] writes Fire -1, FallDistance -2 and Rotation [10, 0]. The port's own tick (ai.js look helper, moveEntity) does that work; only the save was missing.
- **Air (item 2): fixed.** Native writes the tag's Air, which is 0 when the tag has none, for summoned and imported items, orbs, boats, carts, hanging entities and projectiles. Only EntityLivingBase.onEntityUpdate puts 300 back. In the executed rows, an item, orb, boat, cart, snowball, arrow and painting summoned with Air 11 still write 11 after their updates, while the Pig writes 300. A constructed entity (a "new:" row) writes 300. These records now carry `air` when it was read: `keptBaseOf` for /summon, `keptBaseImport` for the chunk import, and `keptBaseSave`/`keptBaseRestore` for the browser save. A natural entity has no `air` field and exports 300 as before.
- **UUID (item 3): fixed.** `sa.<init>` draws `UUID.randomUUID()`, and readFromNBT replaces it only when the tag has both longs. Every holder's save now calls `ensureUuid` (entity-uuid.js), which draws a random UUID on the first save and keeps it after that. The holders are items, orbs, boats, carts (already), hanging entities, arrows, throwables, witch potions, fireballs and skulls (`keptBaseSave`), plus TNT and falling blocks (`entityBaseSave`). Eyes and rockets save their whole record. /summon draws the UUID at once (`keptBaseOf`, `entityBaseOf`). Nothing reads a UUID before writeToNBT, so drawing it lazily is observably the same. The export's position-derived UUID (`uuidOf`) is now only a fallback for records saved before b88.
- **Projectiles and hanging entities (item 4): fixed.** `javaProjectileFromNbt` now adds the kept keys (Air, UUID, PortalCooldown, Dimension) to every record. Arrows (`bow.js`), throwables (`projectiles.js`), witch potions, fireballs and skulls (`fireballs.js`, tiny edit), eyes and rockets keep them through their save and load. `region-export.js` passes them to `entity()`, so the export no longer writes PortalCooldown 0 and the region's Dimension. Arrows, throwables, witch potions and eyes count the cooldown down by one per server update (`tickPortalCooldown`; sa.C does `if (am > 0) --am` on a WorldServer, bytecode-read). Fireballs and rockets keep the cooldown but do not count it yet (see Follow-ups). Hanging entities (`hanging.js` toJSON and load, and /summon Painting and ItemFrame) keep Air, UUID, PortalCooldown and Dimension. EntityHanging.onUpdate never calls sa.C, so their cooldown is never counted down; the executed painting row writes 9 after 2 updates.
- **Nether summon Dimension (item 5): confirmed, then fixed.** Executed in the probe's world with provider id -1:
  - An untagged or `{}` summon writes Dimension 0, for Pig, Zombie, Item, XPOrb, Boat, MinecartRideable, Arrow, Snowball, PrimedTnt and Painting.
  - `{Dimension:1}` writes 1.
  - EntityList.createEntityByName (a natural entity) writes -1 and Air 300.

  Bytecode-read: only `sa.<init>`, `sa.f` and `sa.b(I)` (travelToDimension) write `sa.ap`; `sv`, `sw`, `ahb`, `mt` and `bu` do not. Fixes:
  - `command-host.js` sets `nbtDimension = 0` on the untagged mob path.
  - `summonedMobRecord` reads Dimension.
  - Items, orbs, boats, carts, hanging entities and projectiles take it through `keptBaseOf` and `keptBaseImport`.
  - `entityDeparture` (`entity-portal.js`) deletes `nbtDimension`. travelToDimension sets the destination, and the export then writes the region's dimension.
- **PortalCooldown clamp (item 6): fixed.** readFromNBT's getInteger is raw. In the executed rows, 5000 and -7 load and save unchanged on the probe's non-WorldServer double (items, orbs, boats, carts, snowballs, arrows, paintings, pigs). Bytecode-read, a WorldServer counts only a positive value down. Raw values are now kept by:
  - the loads of items, orbs, boats and carts (`keptBaseRestore`), and `cart-summon.js`;
  - the mob restore (was 1..300) and `java-mobs.js portalCooldownFields` (was > 0 only);
  - `EntityPortals.state` (was 0..300) and its write-back (a negative value is kept);
  - the mob and item export (was > 0 only).
- **Boat fall (item 7): no change needed.** EntityBoat.updateFallState (`xi.a(DZ)`, bytecode-read; executed fall rows) works like this:
  - On the ground with fallDistance > 3, it calls fall(), breaks the boat (not remote, not dead) and sets fallDistance to 0. Otherwise the value is kept: -2, 2.5 and 3.0 stay, and 3.5 breaks the boat with FD 0.
  - In the air over anything but water with dy < 0, fallDistance = (float)(fallDistance - dy). -2 becomes -1.5 for dy -0.5.
  - Over water, or moving up, the value is unchanged.

  `boats.js updateFallState` matches every row, and the new test replays them. A pig on the ground keeps -2 and lands 2.5, which is Entity.updateFallState from summon87.

## Evidence
- **Executed:**
  - `tools/probes/Entnbt88Probe.java` (on Summon87Probe/Summon86Probe's server double; the unchanged `bu.b`).
  - `tools/verify-entnbt88.mjs` writes `public/research/entnbt88-reference.json`.
  - The reference has 16 nether rows (12 summons with provider id -1, and 4 `new:` rows from `sg.a`), 12 tick rows (writeToNBT after n `sa.h` calls) and 9 fall rows (one `sa.d(0, dy, 0)` on a boat and a pig).
  - Run with `node tools/verify-entnbt88.mjs`; it needs the JDK and the ignored `tools/research/` jar.
- **Bytecode-read:**
  - `sa.<init>`: UUID.randomUUID, `ap` = provider id, datawatcher 1 = 300.
  - `sa.f`: setAir(getShort), getInteger Dimension and PortalCooldown.
  - `sa.C`: the `am` countdown only `if (!isRemote && world instanceof mt)`.
  - `sa.b(I)`: dimension = destination.
  - `xi.a(DZ)`.
  - The writers of `sa.ap`.
- **Port-read:** TRANSIENT/INTERPOLATED in `entities.js`, the projectile holders' save and load, `region-export.js entity()` and the object exports.

## Verification
- `node --test src/entnbt88-b88.test.js`: 7 pass (new). It covers:
  - Nether /summon export of Dimension, Air and PortalCooldown against the rows, plus a dropped item's -1 and 300;
  - stored and stable UUIDs;
  - raw PortalCooldown on load for items, orbs, boats, carts and mobs, and the portal walk's countdown;
  - entityDeparture;
  - the mob save, restore, export and import of Fire, OnGround, FallDistance and pitch;
  - projectile and painting import, save and export of the kept keys;
  - keptBaseOf;
  - the boat fall rows against `Boats.updateFallState`.
- Targeted neighbours: 298 test files, run with `--test-concurrency=3` from a non-empty list. The list holds every test importing an edited module (or `away-entities`/`dimension-live`), the `entities.js` importers that serialize or restore, and the source-text scanners. Final run: 3533 pass, 0 fail.
- The first run found 8 failing tests in 7 files. They are fixed in these test files:
  - `mob-gear-nbt.test.js`: the zombiePortal -7, 301 and 100000 rows encoded the old > 0 and 300 clamps; they now expect the raw native value.
  - `summon87-b87.test.js`: an id-only `entityBaseOf` had uuid `undefined`; it is now a random UUID.
  - `level-dat.test.js`: the hanging round trip now carries `nbtDimension: 0`.
  - `block-actions-replay`, `entity-simulation-replay` and `player-throw-replay`: these compare independent runs, so their comparisons now leave out `uuid`. Each run draws its own random UUIDs, as native does.
- `keptBaseImport` leaves out Air 300 (a record without `air` exports 300), so imported records keep their shape.
- `npm run build`: passed once (only the usual chunk-size warning).
- The full `npm test` was not run (track rules).

## Follow-ups
- **travelToDimension source world:** a summoned Nether entity with Dimension 0 (or any mismatched tag) would make native `travelToDimension` pick the wrong source world (it reads `this.dimension`). The port's portal code uses the live dimension, so it does not reproduce that quirk.
- **Fireballs and rockets:** they keep PortalCooldown through the save but do not count it down per update (sa.C runs for them natively).
- **Mob Fire on import:** `java-mobs.js` still clamps a chunk mob's Fire to -1 and up (one tick of moveEntity's rest value). Native keeps -20 until the first update.
- **Eggs and bobbers** still have no EntityList id, so they are not exported.
- **Browser-only:** nothing visual changed. A browser could only confirm that a world saved and reloaded in the tab keeps a mob's pitch and a burning mob's fire (both drawn from these fields).
