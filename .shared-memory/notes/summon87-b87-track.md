# summon87 (batch 87): Entity NBT base keys through /summon, save, export and import; item Age; summoned head yaw

## Summary
- **Primed TNT and falling blocks (item 1): fixed.** `EntityTNTPrimed.h` (`xw.h`) and `EntityFallingBlock.h` (`xj.h`) never call `Entity.onEntityUpdate` (`sa.C`) (bytecode-read). So Air, Rotation, PortalCooldown, Dimension, UUID and Invulnerable stay as `readFromNBT` left them, and `moveEntity` only changes OnGround, FallDistance and Fire. The executed `Summon87Probe` shows the full /summon tag written back by `writeToNBT`: Rotation [400, -200] becomes [40, -200], plus FallDistance -3.5, Fire 7, Air 11, OnGround 1, Dimension -1, Invulnerable 1, PortalCooldown 9 and UUID 5/6. An id-only summon writes Air 0, Rotation 0, Dimension 0, PortalCooldown 0 and a random UUID. The new `src/entity-base-nbt.js` does the read (`entityBaseOf`: setRotation's yaw % 360 and pitch % 360, raw FallDistance, raw ints), the save (`entityBaseSave`, defaults left out) and the restore (`entityBaseRestore`). It is wired into these places:
  - `entity-summon.js`: PrimedTnt and FallingSand. FallingSand used to keep only Fire.
  - TNT save and load in `main.js`, `away-entities.js` and `multiplayer/server-dispense.js`.
  - `falling.js` serialize and restoreEntity. The load no longer clamps a negative FallDistance to 0.
  - `java-objects.js`, the import of both kinds: raw FallDistance, the falling block's Fire, and the base keys.
  - `region-export.js`: the record's `rotation` and `air` were already used. Dimension and PortalCooldown were always written as 0 and now come from the record (see the last bullet).
- **Entity.updateFallState** (`sa.a(DZ)`, bytecode-read): on the ground only `fallDistance > 0` lands (fall, then 0), so a negative value read from NBT is kept. `entities.js moveEntity` and the minecart's own copy in `minecarts.js` used to reset it to 0 every time. Both now match. `boats.js` (boatcheck87) has its own `updateFallState`, which already only resets above 3.
- **Item Age (item 2): fixed, and the task premise corrected.** `xk.a(dh)` reads `getShort("Age")` with no clamp. `xk.h` does `++age` unconditionally, and on the server `age >= 6000` is setDead (bytecode-read). Executed results:
  - Age -32768 becomes -32767 after 1 tick, -32765 after 3 and -32728 after 40, and the item is still alive.
  - Age -1 becomes 0 after 1 tick.
  - Age 5999 becomes 6000 after 1 tick, and the item is dead.

  **1.7.10 has no -32768 "never despawns" sentinel; that is 1.8 behaviour.** A negative age only makes the item live `6000 - age` ticks. A negative Age is now kept by summon (`entity-summon.js`), by the browser load (`item-entities.js`, clamped to the short range instead of 0..5999) and by the region import (`region-import.js`, the raw short). The save and the export already wrote it.
- **Summoned mob head yaw (item 3): fixed.** Executed: 300 summons for each of 8 mobs (Pig, Zombie, Creeper, Spider, Slime, Villager, EntityHorse, Blaze) and 5 tags (none, `{}`, Rotation [90,30], [400,-200], [-90,0]).
  - rotationYaw = Rotation[0] % 360. prevRotationYaw keeps the raw float. rotationPitch and prevRotationPitch = Rotation[1] % 360.
  - renderYawOffset, prevRenderYawOffset and prevRotationYawHead are always 0.
  - rotationYawHead is the EntityLivingBase constructor's `(float)(Math.random()*PI*2)`, which is degrees in [0, 6.28). It never equalled rotationYaw in any of the runs.
  - `new EntityTrackerEntry(e, 80, 3, true).lastHeadMotion` (`my.i`) is 0..4. So the S0F head byte is 0..4, and S19 follows the first real head turn of 4 or more steps.

  Before this fix the port set head = body = yaw (`syncInterpolation`). `command-host.js` now sets the native fields on both the tagged and the untagged path. `entity-tracker.js` (mpperf87) already sends from those fields, so it is unchanged.
- **Sweep (item 4): clear mismatches fixed.**
  - The export's PortalCooldown is now the record's value for every kind. Boats and carts saved it but the export wrote 0.
  - The export's Dimension is now `nbtDimension` when the record has one, else the region's dimension (the Entity constructor sets the provider id; `travelToDimension` sets the destination). Nether and End entities used to export 0.
  - `/summon Boat` now applies setRotation's % 360 to yaw and pitch and keeps UUIDMost/Least.
  - `/summon Minecart*` now keeps OnGround, raw FallDistance, Rotation (% 360), UUID and PortalCooldown. Before, it kept only Fire, Invulnerable and Motion.

## Evidence
- **Executed:**
  - `tools/probes/Summon87Probe.java` runs the unchanged `bu.b` on Summon86Probe's server double; `tools/verify-summon87.mjs` writes its output to `public/research/summon87-reference.json`.
  - The reference has 43 base rows: 27 kinds with the full base tag, class-only tags, and 6 untagged summons. It also has 5 item tick rows and 40 head rows.
- **Bytecode-read:**
  - `sa.e` (writeToNBT) and `sa.f` (readFromNBT): Motion |v| > 10 becomes 0; Rotation goes through `sa.b(FF)`.
  - `sa.a(DZ)` (updateFallState), `sa.<init>` (dimension = provider id).
  - `xk.a`, `xk.b` and `xk.h` (EntityItem read, write and update).
  - `xw.h` and `xj.h` (no `sa.C` call), `sv.<init>` (yaw roll, head = yaw), and `bu.b` (setLocationAndAngles after readFromNBT).
  - `my.<init>` and `my.c()` (lastHeadMotion = floor(head * 256 / 360), S0F truncation).
- **Port-read:** the sweep table below, `entities.js serializeOne` TRANSIENT/INTERPOLATED, `region-export.js entity()`, boats/minecarts/item-entities/experience save code.

## Verification
- `node --test src/summon87-b87.test.js`: 7 pass (new). It covers:
  - the TNT and falling save, export, import and export again, compared with the executed rows;
  - a source check that the TNT and falling paths use the helper;
  - the setRotation remainders;
  - updateFallState;
  - item Age through summon, ticks, load, export and import;
  - Dimension and PortalCooldown in the Nether and Overworld export;
  - head yaw against all 40 head rows, with Math.random stubbed to exact values, and the tracker's lastHead.
- Targeted neighbours, run with concurrency 2 and checked to be non-empty lists:
  - 22 files: summon, cmd and command-tags, falling, item, region, entityaudit, fireext, projectile-nbt and skins73. 255 pass, 0 fail.
  - 23 files: entities, away, dispense, carts, explosion, entity-portal, rain, mpcmd. 221 pass, 0 fail.
  - 20 files: movement, replays, saved-order. 365 pass, 0 fail.
  - 14 files: trackers, spcopy, mobrec, carts-b70, level-dat, java-world, streaming-world. 168 pass, 0 fail.
- No old test encoded these gaps (grepped for the changed lines and for source-text checks), so none needed changing. The full `npm test` was not run (track rules). `npm run build` passed once (only the usual chunk-size warning).

## Follow-ups (sweep mismatches left open)
- **Mob saves:** `entities.js serializeOne` drops Fire, OnGround, FallDistance and Rotation pitch (TRANSIENT/INTERPOLATED). The export writes Fire -1, OnGround from the live flag, and the record's yaw with pitch 0.
- **Air:** summoned non-living entities (items, orbs, boats, carts, hanging, projectiles) export Air 300. Native writes the tag's Air, which is 0 when the tag has none. None of them restore it, because only EntityLivingBase.onEntityUpdate puts 300 back. Their records have no `air` field.
- **UUID:** items, orbs, hanging, projectiles, and TNT/falling blocks without a UUID tag have no stored UUID. The export derives one from the position, whereas native keeps the constructor's random UUID.
- **Projectiles:** the export passes a subset to `entity()`, so PortalCooldown is 0 and the Dimension is the region's.
- **Hanging:** a summoned or saved PortalCooldown is not kept.
- **Dimension:** a mob summoned in the Nether or End without a Dimension tag exports the region dimension; native writes 0. There is no `nbtDimension` on mob, item, orb, boat or cart records.
- **portalCooldown clamp:** the load clamps portalCooldown to 1..300 for items, boats and carts, while native keeps the raw int. The mob export also writes only values above 0.
- **Browser-only:** the visual facing of a freshly summoned mob, whose head starts about 0..6 degrees from south while the body is at 0 and turns as the body helper runs. The client's render of the S0F head byte.
