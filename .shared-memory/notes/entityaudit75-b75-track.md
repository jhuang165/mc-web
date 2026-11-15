# Batch 75 entityaudit75: projectile and object entity audit

## Summary
Audited the Partial projectile and object rows against executed probes of the real 1.7.10 classes.
Closed: export of FallingSand, PrimedTnt and EnderCrystal now matches native NBT field by field.
Closed: Java region import of XPOrb, PrimedTnt and FallingSand (before, they were counted as lost although the catalogue said imported).
Closed: FallingSand with air or an unregistered TileID becomes sand on import and /summon, as native.
Closed: thrown balls entering water threw a ReferenceError (projectiles.js lacked the enterWater import).
Closed: the wither skull ignored the box-based water test and flow push (wither-boss-mobs.js).
Found wrong: the XPOrb note that xpColor, search state and target are not saved is native.
Found wrong: the PrimedTnt row said TNT is never saved; native saves Fuse as a byte.
Also fixed the replay: water id 9 maps to the port id, and the arrow last column is shake, not pickup.

## Evidence
Executed: tools/probes/ObjectNbtProbe.java -> public/research/object-nbt-reference.json (23 records: xporb, falling, tnt, crystal).
Executed: tools/probes/ThrowFlightProbe.java -> public/research/throw-flight-reference.json (17 per-tick flights: snowball, pearl, potion, bottle in air, water and floor; arrow air, water, floor; wither skull air, water).
Recalled from anvil-blocks-reference.json: a falling anvil carries HurtEntities 1.

## Verification
node --test src/entityaudit75-b75.test.js: 27 pass, 0 fail.
node --test over 56 test files that use projectiles.js, entity-list-replay.js or wither-boss-mobs.js: 691 pass, 0 fail.
node --test src/catalogue-consistency.test.js src/content-catalogue.test.js: 6 pass, 0 fail.
Region/mob/summon neighbours (region-export, region-import, projectile-nbt, summon-*, java-mobs, mob-nbt and others) passed earlier: 85 and 76 pass.
Full npm test not run (batch rule).

## Follow-ups
Region import drops an orb with Value 0 or over 2477 or Health 0, and a falling non-falling block such as stone; native keeps both.
FallingSand Data is masked to 4 bits and Time 0 becomes 1 on import.
An EnderCrystal is still imported through the mob path.
Per-tick flight of Fireball, SmallFireball and Firework was not re-executed here; existing references stand.
Browser checks worth doing: a ball entering water, a Java region with orbs, TNT and falling blocks.
