# fire85 (batch 85): fire counters and /summon follow-ups

## Summary
- **Fire counters after the first update (item 1): no port gap found.** Replayed per kind against the executed `tick` rows (`src/fire85-b85.test.js`): item, orb, boat, mobs count down (100 -> 99) and rest -20 at -1; carts, falling blocks and primed TNT keep a positive counter and rest -20 at -1; paintings, item frames never change it; fireballs/small fireballs/skulls read 99 / 20 (`fireballBurn`). All already matched through `blockCollisions`' tail (every moveEntity user rests a counter <= 0 at -1) and each class's own count-down. The b84 follow-up described the summoned value as kept: it is kept until the first update, as natively. Nothing changed in the tickers.
- **Water and rain (item 2): nothing to add.** Bytecode-read: `xl` (minecart), `xj` (falling block), `ss` (EntityHanging, so paintings, frames, knots) and the crystal `wz` never call `sa.h`, so no handleWaterMovement and no count-down; `xi` (boat), `zd` (eye), `zc` (arrow) do. Carts and falling blocks get only the moveEntity tail's rain `isWet` (already in the port, rain83/rain84); hanging entities and crystals have neither.
- **onSpawnWithEgg (item 3): the premise was reversed; the port already matches.** `bu.b` (bytecode-read, offsets 274-296): `if (!hasTag && entity instanceof EntityLiving) onSpawnWithEgg(null)`. An untagged /summon runs it; any tag, `{}` too, skips it. Executed (new `egg` rows): untagged ocelot 42 of 280 runs spawn two kittens, `{}` 0; untagged sheep roll fleece colours, `{}` always 0b. The port (untagged = `spawnNatural`, tagged = `restore`) reproduces both; replayed in the new test. Not matched: native runs onSpawnWithEgg before `spawnEntityInWorld`, so kittens/jockey mounts enter the list before the ocelot/spider (port: after).
- **Invulnerable (item 4): implemented.** `sa.aw()` returns the flag `sa.i` that `readFromNBT` sets; `sa.a`, `sv.a`, `yz.a` (also first before the creative check), the overrides in wolf/ocelot/silverfish/pigman/enderman/ghast/animal, `xi` boat, `xl` cart, `xk` item, `sq` orb, `ss` hanging and `wz` crystal return false at once. `sv.d`/`yz.d` (damageEntity) test it again. Executed (new `invulnerable` rows): a flagged pig/zombie keeps full health against generic and outOfWorld damage (the void, `sv.G`, goes through attackEntityFrom, so an invulnerable mob never dies of it); boat, cart, item, orb, painting, frame, crystal survive. Port: `entities.attackEntityFrom`, `Boats.attack`, `Minecarts.attack`, `ItemEntities.hurt`, `ExperienceOrbs.hurt`, `Hanging.attack` honour `invulnerable`; `/summon` sets it for mobs (`command-host.js`), items, orbs, boats, carts, paintings and frames. Falling blocks, TNT and projectiles take no damage, so the flag is moot.
- **Found by the new rows:** a summoned Item and XPOrb read `Health & 255` (0 when absent), so a summoned item dies from the first hit natively; the port kept 5. `entity-summon.js` now sets it (`Health` tag honoured).
- **Item 5:** the probe replay (`cmd-exec-b83.test.js`) has a recording `hanging` host; paintings and frames compare Fire and Invulnerable. Fireball/SmallFireball/WitherSkull: a fireball without `direction` is born dead natively (`EntityFireball.readEntityFromNBT`), so the probe now also runs `{direction:[..],Fire:100s|-20s}` rows for those three; the replay checks the raw counter reaching the holder and `fireballBurn` against the executed first update (99, 20).

## Evidence
- Executed: `tools/probes/CmdExec83Probe.java` extended (`egg`, `invulnerable` sections, direction tag rows), `tools/verify-cmd-exec.mjs` -> `public/research/cmd-exec-reference.json` (6 tab / 97 run / 234 summon, 0 crashed).
- Bytecode-read: `bu.b` flag at slot 12, `sa.aw`/`sa.i`, `sa.a(ro,F)`, `sv.a`, `sv.d`, `yz.a`, `yz.d`, `sv.G`, and which classes call `aw()` or `sa.h` (javap on the 1.7.10 jar).
- Port-read: tick paths per kind.

## Verification
- `node --test src/fire85-b85.test.js`: 39 pass (new). `src/cmd-exec-b83.test.js`: 4 pass (hanging host, skulls, direction rows).
- Neighbour run (summon, hanging, carts, boats, items, orbs, commands, region export, explosions, fireext, rain84, neg-stacks, entities, mob victims, combat, ~60 files): 434 + 73 pass, 0 fail. No old test needed changing besides the replay harness above.

## Follow-ups
- onSpawnWithEgg list order for the command path (kittens/jockey mount before the summoned mob).
- Invulnerable is not saved for items/orbs/hanging records (mob records carry it as a field); crystals already did.
- Fireball ticking with Invulnerable/water in a summoned state is covered by existing fireball tests only.
- Browser-only: nothing new.
