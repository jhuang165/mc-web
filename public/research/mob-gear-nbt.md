# Mob gear, leashes and portal cooldowns in Java region saves

Evidence: `tools/probes/MobGearNbtProbe.java` runs the unchanged 1.7.10 classes (`sw` EntityLiving, `sa` Entity, `yq` EntityZombie, `yl` EntitySkeleton, `yh` EntityPigZombie, `su` EntityLeashKnot, `sg` EntityList) on the HorseGearProbe world double. `tools/verify-mob-gear-nbt.mjs` writes `public/research/mob-gear-nbt-reference.json` (class SHA-256 digests, 18 gear, 2 leash and 1 knotLoad record). `src/mob-gear-nbt.test.js` replays it through `javaMobFromNbt`, `EntityWorld`, `importJavaRegionArea` and an `exportJavaSave` round trip (23 tests).

## What the native classes do (`EntityLiving.writeEntityToNBT` / `readEntityFromNBT`)

- Write order: `CanPickUpLoot`, `PersistenceRequired`, `Equipment`, `DropChances`, `CustomName`, `CustomNameVisible`, `Leashed`, `Leash`. Every EntityLiving writes all of them. `Equipment` is five compounds in slot order held, boots, leggings, chestplate, helmet (an empty slot is an empty compound); `DropChances` is five floats (default 0.085); `PortalCooldown` (Entity) is the raw `timeUntilPortal` int.
- Read: `CanPickUpLoot` and `PersistenceRequired` are always read (absent = false). `Equipment` is read only when it is a list: all five slots are replaced, entries that are missing or empty become empty slots, a list of another element type empties every slot, a non-list tag is ignored. `DropChances` takes its floats one by one; the rest stay 0.085; a non-float list changes nothing. `Count` and `Damage` are kept raw (a Count 7 sword loads as 7). `PortalCooldown` is not clamped (-7 and 100000 load as written).
- Constructors leave every hand empty: a bare skeleton, wither skeleton and pigman have no bow or sword until `onSpawnWithEgg` equips them.
- `Leash` is `{X, Y, Z}` of the knot's block, or `{UUIDMost, UUIDLeast}` of the player holder. The knot does not write: `su.d` (writeToNBTOptional) returns false, `su.b` and `su.a` are empty, and its tag is `{}`. So a native chunk never holds a LeashKnot entity; the knot is made again from the mob's Leash X/Y/Z on its first leashed tick. (A foreign `LeashKnot` compound loaded through `sg.a` becomes a knot at its `Pos`; TileX/Y/Z are not read.)

## What the port does

- Export (`region-export.js`): every mob writes `CanPickUpLoot`, `Equipment` and `DropChances`. Zombies, zombie villagers, pigmen, skeletons and wither skeletons write their native stacks (enchantments as `ench`); a witch writes its held potion; others write empty slots and 0.085. `PortalCooldown` is the live value (`portalCooldown`). `Leash` is X/Y/Z of the knot or the holder's UUID (0/0); no LeashKnot entity is written, because 1.7.10 never does.
- Import (`java-mobs.js`: `mobGearNbtFields`, `portalCooldownFields`): the same fields come back as `equipment`, `dropChances`, `canPickUpLoot`, `persistent`, `portalCooldown` and `leash`, through the item converter (so unmapped items read as empty slots and are tallied in the item report). A tag with none of the three gear keys keeps the type's default gear. `/summon` uses the same reader. Region import counts a `LeashKnot` entity in `report.entities.leashKnots` instead of reporting it lost.
- Riding stays reported as lost (separate work).

## Gaps

- The player UUID of a lead holder is written as 0/0 (this build has no profile UUID; a real client would drop a lead that does not match its profile). Import accepts any UUID as the player.
- Slots 1-4 of mobs other than zombie, pigman, skeleton and wither skeleton are not read (nothing equips them live), and a witch's non-potion held item is reported ignored in `/summon`.
- The live default hand of a bare skeleton (bow) and pigman (golden sword) is the earlier port's choice and differs from the native constructor (empty); native saves always carry `Equipment`, so imports are exact.
- `PortalCooldown` above 300 is kept at 300 by the live portal state.
