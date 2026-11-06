# In-flight projectile NBT and creeper Fuse / ExplosionRadius

Evidence for the Java save interchange (`src/region-export.js`, `src/region-import.js`). It is not full save parity: the converted projectiles carry the native fields the browser models, and the rest stay transient.

Probes (unchanged 1.7.10 classes, run by `node tools/verify-projectile-nbt.mjs` with `MC_RESEARCH` pointing at the directory that holds `minecraft-1.7.10.jar`):

- `tools/probes/ProjectileNbtProbe.java` → [projectile-nbt-reference.json](projectile-nbt-reference.json), 21 records. Each entity is built with its constructor, written with `Entity.writeToNBTOptional` (`sa.c`), edited, and read with `EntityList.createEntityFromNBT` (`sg.a`). The record keeps the edited tag and the loaded entity written again.
- `tools/probes/CreeperNbtProbe.java` → [creeper-nbt-reference.json](creeper-nbt-reference.json), 9 records. A creeper is loaded from NBT with `Fuse`/`ExplosionRadius` edited and run through `EntityCreeper.onUpdate`, `getCreeperFlashIntensity`, `fall` and the explosion on the CreeperProbe world double.

## What the probes showed

- **Layouts.** EntityThrowable writes `xTile`/`yTile`/`zTile` (shorts, -1 unset), `inTile`, `shake`, `inGround` (bytes) and `ownerName` (a string, empty when unowned). EntityPotion adds a `Potion` item compound (`id` 373, `Count`, `Damage`); when it is missing the read falls back to the legacy int `potionValue` (default 0, a plain bottle). EntityArrow writes the three tile shorts, `life` (short), `inTile`, `inData`, `shake`, `inGround`, `pickup` (bytes) and `damage` (double, default 2.0); a missing `pickup` reads the legacy boolean `player`, else 0. Entity's own keys (Pos, Motion, Rotation, Fire, UUIDMost/UUIDLeast ...) come first. A fresh projectile has `Fire` 0, not the -1 of mobs.
- **EntityEgg has no EntityList id**, so `writeToNBTOptional` returns false: a native save never contains an egg. The browser's in-flight eggs are therefore not exported (counted as unsupported). `EntityFishHook` is likewise not saved.
- **Fireballs** (`Fireball`, `SmallFireball`, `WitherSkull`) write `direction`, `xTile`.., `inTile`, `inGround`, and `ExplosionPower` (large only). The browser saves no fireballs (`Fireballs.serialize()` is empty), so import counts them as lost.
- **Creeper.** `Fuse` is read with `getShort` and `ExplosionRadius` with `getByte` only when the tag is numeric (an int tag narrows: 70000 → 4464, 200 → -56; a string leaves 30 and 3). The fuse counts `timeSinceIgnited` up by the swell state and explodes when it reaches `Fuse`; the flash divides by `Fuse - 2`; `fall` caps the counter at `Fuse - 5`; the explosion size is `ExplosionRadius * 2` (an int product) when powered, else `ExplosionRadius`. `ignited` calls `ignite()` after the read. The save writes the live fields back.

## Browser mapping

| Java | Browser list | Notes |
| --- | --- | --- |
| `Snowball` | `projectiles` | no kind |
| `ThrownEnderpearl` | `projectiles` (`kind: enderPearl`) | needs a non-empty `ownerName` (becomes the local player); otherwise lost |
| `ThrownPotion` | `thrownPotions` | `damage` = stack damage or `potionValue`; `ticks` restarts |
| `ThrownExpBottle` | `thrownPotions` (`kind: expBottle`) | |
| `Arrow` | `arrows` | tile x/z shift with the import offset, `inTile`/`inData` go through the block registry (an unmapped block drops `inGround`) |
| `Creeper` | `entities` | `Fuse` → `maxFuse`, `ExplosionRadius` → `explosionRadius` (`fuseTime` is still `timeSinceIgnited`, which is not saved) |

Export reverses this (`java-projectiles.js` `javaProjectileToNbt`; potions in `thrownPotions` are bucketed by column in `regionSource`). `world-import.js` now keeps `thrownPotions` in the imported runtime.

## Not converted

Shooter and ownership beyond "the local player", shake/inGround of throwables (vestigial in 1.7.10), the entity RNG, in-air age, eyes of ender, fireworks rockets and fishing bobbers on export, fireballs on import. Full parity is not claimed.
