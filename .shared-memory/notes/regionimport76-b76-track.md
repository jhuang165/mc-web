# Batch 76 regionimport76: object entities in the Java region import

## Summary
Closed: Java region import and /summon keep an XPOrb with Value 0 or above 2477, Health 0 and a negative Age (the orb list no longer filters them on load).
Closed: FallingSand of a block that does not fall (stone) is kept; the entity lands like sand and places that block.
Closed: FallingSand Data keeps its whole byte (Data 31 is 31, not masked to 15); the landing setBlock stores the low 4 bits only.
Closed: FallingSand Time 0 stays 0 (the first tick then checks the block still stands) instead of becoming 1; DropItem is read, kept, saved and exported (false means no item on a timeout or a blocked landing).
Closed: an EnderCrystal no longer goes through the mob readers; javaCrystalFromNbt reads Entity.readFromNBT fields only (Pos, Rotation, Fire default 0, Invulnerable). Health, effects, gear, leash and names in a foreign tag are ignored, as native.
Closed: crystal Invulnerable is honoured (attackEntityFrom returns false) and exported.
Found wrong: the b75 "Time 0 becomes 1" note (native keeps 0) and the b75 test that asserted stone as lost.
Port approximation kept: a crystal record still lives in the mob list (the port's only crystal store); a block whose port cell cannot hold the saved low nibble (stone Data 15) carries it as `data`.

## Evidence
Executed: public/research/object-nbt-reference.json (ObjectNbtProbe rows, from b75): xporb Value 0 / Health 0 and Value 70000 -> 4464 / Health 300 -> 44 load and save back; falling TileID 1 loads as Tile 1; Data 31 saves 31; Time -1 saves -1; crystal Foo is dropped and only Fire stays.
Bytecode-read: xj.a(dh) (EntityFallingBlock.readEntityFromNBT): TileID else Tile&255, Data&255, Time&255, DropItem only when present, HurtEntities absent and anvil sets it; xj.h landing passes the raw Data field to ahb.d (setBlock), gated by DropItem on both drop paths.
Bytecode-read: wz (EntityEnderCrystal) a(dh) and b(dh) are empty; wz.a(ro, F) returns false first when aw() (invulnerable) is true.
Port-read: the nibble store of setBlock was not re-read in the jar; the port sets meta & 15.

## Verification
node --test src/regionimport76-b76.test.js: 9 pass, 0 fail.
Related: entityaudit75-b75, region-export, region-import, falling, experience, xp-orbs, xp-orbs-b71, summon-coverage, summon-reference, summon2-b68, mpsummon-b67, crystal-fire-b57, java-mobs, nbtexport73-b73, projectile-nbt, mob-nbt: 182 pass. falling-damage, explosion-entities, end, entity-ids, object-tracker-extras, order74-b74, living-simulation, dragondeath-b56, catalogue tests: 76 pass.
Two old tests changed because they asserted the gaps (xp-orbs health 0 dropped, falling.test.js dirt save ignored; entityaudit75 stone lost, Value 0 lost).
Full npm test not run (batch rule). No browser checks.

## Follow-ups
A foreign falling block that fails to land drops item id = block id with damage 0 (or sand/anvil rules); a wool or log block should drop damageDropped(meta). TileEntityData of a falling block is not read.
The anvil impact reads the whole Data byte natively; the port's anvilImpact with Data above 15 was not checked.
An orb or crystal as a chain rider/mount is untested.
