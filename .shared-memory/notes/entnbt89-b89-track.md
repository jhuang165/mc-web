# entnbt89 (batch 89): travelToDimension's source dimension, PortalCooldown on fireballs and rockets, raw mob Fire, eggs and bobbers, base key order

## Summary
This follows the entnbt88 follow-ups. It is not full parity; the open items are listed at the end.
- **travelToDimension source (item 1): fixed, with one gap.** `sa.b(I)` reads its source as `this.dimension` (sa.ap), which is the saved Dimension tag, not the world the entity stands in.
  - Let j = sa.ap and i = the argument. Then src = `MinecraftServer.a(j)` and dst = `MinecraftServer.a(i)`. `a(I)` maps -1 to c[1], 1 to c[2] and anything else to c[0].
  - When j == 1 and i == 1, dst becomes world 0 and sa.ap becomes 0. Otherwise sa.ap = i.
  - `oi.a(sa, j, src, dst)` (transferEntityToWorld) scales by the new sa.ap: -1 divides by 8, 0 multiplies by 8. Otherwise it uses the End entrance, or the spawn when j == 1 (that case can't happen). It then places the entity with the Teleporter only when j != 1.
  - The copy goes to the spawn point at `getTopSolidOrLiquidBlock` only when j == 1 and i == 1.
  - src is used only for `updateEntityWithOptionalForce` (chunk bookkeeping of the old entity). The entity's physics still uses its own worldObj, so a mismatched src changes nothing the port models.
  - An entity loaded with a mismatched tag keeps it. readFromNBT stores it, and only sa.b(I) changes it.
  - Observable results:
    - An untagged `/summon` in the End writes Dimension 0 (entnbt88). Through the exit portal it lands on the End's own obsidian platform at (100, 49, 0), not at the Overworld spawn.
    - An entity tagged Dimension 1 in the Overworld or the Nether crosses a Nether portal at x / 8 (or x * 8), keeps its own y, and gets no Teleporter and no portal built.
    - An entity tagged Dimension 1 in the Overworld that enters an End portal goes to the Overworld spawn.
    - A mismatch between Nether and Overworld does not change where the entity lands.
  - Port changes:
    - `entity-portal.js` adds `travelSource` and `travelRoute`. `placeAfterTravel` uses the route.
    - `entityDeparture` returns `source`, the saved Dimension, before it deletes `nbtDimension`.
    - `dimension-live.js depart` delivers from that source, and `finishAway` delivers from `t.source ?? OVERWORLD`. The away run's travellers carry it.
    - `deliver` computes the destination with `travelRoute`.
  - **Gap:** when the destination is the dimension the player is in, the port cannot add the copy to the live lists from `deliver`. The copy waits in a `late` inbox. `storedRecord` keeps a late inbox, and `deliverArrivals` clears the flag when the dimension next loads (a reload or a return trip). For an Overworld root record, the inbox already persisted on the record. Natively the copy appears at once.
- **Fireballs and rockets (item 2): fixed.** Bytecode-read:
  - `ze.h` (EntityFireball, and so large and small fireballs and wither skulls) calls `sa.h` at offset 58, after its setDead branch.
  - `zf.h` (rocket) calls `sa.h` at offset 25.
  - `sa.h` is just `C()`.
  - `fireballs.js tickBall` now calls `tickPortalCooldown` after the prev-rotation copy (one line plus one import line). `firework-rocket.js tickRocket` calls it when `server` is set, so the object-tracker client copy (server false) does not count.
  - Every class that calls `sa.h`: zc (arrows), zk (throwables), zd (eyes), xe (bobber), ze and zf. The first three already counted (b88). The bobber is never saved, so its cooldown cannot be observed.
- **Mob Fire on import (item 3): fixed.** `java-mobs.js` reads `Fire` raw on both mob paths (`sa.f` getShort). An absent Fire reads 0, getShort's default; it was clamped to -1 and up, with -1 as the default. The port's moveEntity still rests it at -1 on the first update (entnbt88 tick row).
- **Eggs and bobbers (item 4): confirmed, no change needed.** Bytecode-read:
  - sg's static block registers neither `zl` (EntityEgg) nor `xe` (EntityFishHook).
  - So `sa.W()` (`sg.b(this)`) is null. `sa.d(dh)` (writeToNBTOptional, the call `aqk` makes for each chunk entity) then returns false whatever the hook's isDead or riding state is.
  - The executed projectile-nbt row already has the egg at `saved: false`.
  - The export leaves both out. The egg counts as unsupported in the report, and the bobber is never iterated.
- **Base key order (item 5): confirmed, no change needed.** `sa.e` writes Pos, Motion, Rotation, FallDistance, Fire, Air, OnGround, Dimension, Invulnerable, PortalCooldown, UUIDMost and UUIDLeast, and `sa.d` writes `id` first. The new test exports 21 kinds and checks that each compound read back from the region file starts with exactly those 13 keys. The kinds are Pig, EnderCrystal, Item, XPOrb, PrimedTnt, FallingSand, Boat, MinecartRideable, MinecartChest, Painting, ItemFrame, Snowball, ThrownEnderpearl, ThrownExpBottle, ThrownPotion, Arrow, Fireball, SmallFireball, WitherSkull, EyeOfEnderSignal and FireworksRocketEntity. (On disk, Java's NBTTagCompound is a HashMap, so the file order is hash order; readers don't depend on it.)

## Evidence
- **Bytecode-read** (`javap -c -p` on the 1.7.10 jar):
  - `sa.b(I)`, `sa.h`, `sa.e`, `sa.d(dh)`, `sa.c(dh)` and `sa.W`;
  - `MinecraftServer.a(I)` and `oi.a(sa, int, mt, mt)`;
  - the `h()` prologues of `ze`, `zf`, `zk`, `zc`, `zd` and `xe` (each calls `sa.h`);
  - the collision calls: `zf` and `xe` call `d(DDD)`, `zc` calls `I()`, and `ze`, `zk` and `zd` call neither;
  - sg's static block, `sg.b(sa)`, and `aqk`'s call to `sa.d(dh)`.
- **Executed (existing):** `projectile-nbt-reference.json` egg row; entnbt88 tick rows (Fire rest).
- **Port-read:** `dimension-live.js` deliver, storedRecord, viewRecord and deliverArrivals; the export's `entity()`.
- No new probe. Executing travelToDimension needs a MinecraftServer with three WorldServers and a configuration manager, which the existing server double does not have.

## Verification
- `node --test src/entnbt89-b89.test.js`: 9 pass (new). It covers:
  - the route rows;
  - an End mob tagged Dimension 0 through the exit portal: the platform at (100, 49, 0), the late inbox kept by two saves, then delivered and dropped;
  - a natural End mob to the spawn;
  - an Overworld mob tagged Dimension 1 through a Nether portal at x / 8 with no writes, against the untagged mob, which gets a built portal;
  - entityDeparture's source;
  - the fireball and rocket countdown (positive only, none past ze.h's setDead branch, none on a client rocket);
  - the raw mob Fire;
  - egg and bobber export;
  - base key order for 21 kinds.
- Targeted neighbours: 164 test files that import entity-portal, dimension-live, fireballs, firework-rocket, fireworks-live, java-mobs, region-import, blaze-ghast-mobs, away-entities or away-world, or that mention portalArrivals or storedRecord. Run with `--test-concurrency=3`: 2121 pass, 0 fail. No old test needed changes.
- `npm run build`: passed once (only the usual chunk-size warning).
- The full `npm test` was not run (track rules).

## Follow-ups
- A copy whose destination is the dimension the player is in shows only after that dimension next loads. Natively it is spawned at once. To fix this, main.js would add the record to the live lists (mobs.restore, items, orbs, carts, boats).
- Arrows (zc.h doBlockCollisions) and rockets (zf.h moveEntity) collide with portal blocks natively and travel. A bobber (xe.h moveEntity) would vanish, because `createEntityByName(null)` returns null. The port moves only mobs, items, orbs, carts and boats between dimensions.
- **Browser-only:** nothing visual changed. A browser could confirm that a summoned End mob reappears on the platform after the End reloads, and that a summoned fireball's or rocket's cooldown counts down in a saved world.
