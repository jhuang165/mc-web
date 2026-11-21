# entnbt92 (batch 92): HurtTime / AttackTime, witch gear, fireball in-ground, firework Explosions, PickupDelay and hanging Fire round trip

## Summary
Not full parity; open items at the end.
- `entity-base-nbt.js` `mobBaseOf`: reads HurtTime and AttackTime (shorts, only kept when non-zero) into `hurt` / `attackTime`.
- `entities.js`: restore keeps `hurt` and `attackTime`; a generic `attackTime--` runs beside both `hurt` decrements for mobs outside TARGETS_ATTACKER; `silverfishState` seeds `attackTime`; `serializeOne` writes the live value (blaze state, silverfish state or the record).
- `blaze-ghast-mobs.js`, `nether-melee-live.js`: blaze state and pigman fields start from / keep the loaded `attackTime`.
- `region-export.js`: HurtTime and AttackTime write the live values (were 0); a hanging entity writes `Fire` 0 when the record has none (was omitted); witch Equipment slot 0 is the held potion, slots 1-4 come from the record.
- `java-mobs.js`: a witch keeps Equipment[1..4] (slot 0 nulled, it is the `held` potion), non-default DropChances and CanPickUpLoot.
- `java-projectiles.js`, `fireballs.js`: Fireball / SmallFireball / WitherSkull import and export `xTile yTile zTile inTile inGround`; `Fireballs.serialize/load` carry `tile` and `inGround`; `load` resets `ticksAlive` and gives an in-ground ball its own rand (the existing `stick()` rule needed one).
- `fireworks.js`, `fireworks-nbt.js`: a rocket item tag read without an `Explosions` list is written without it (`unlisted`); a crafted one keeps its list, even empty.
- `region-import.js`, `entity-summon.js`: an Item no longer reads `PickupDelay` (delay is 0).
- New: `src/entnbt92-b92.test.js` (6 tests), `tools/probes/Entnbt92Probe.java`, `public/research/entnbt92-reference.json` (4 rows).
- Old tests changed: `region-import.test.js` and `summon-coverage.test.js` expected delay 10 from PickupDelay; that encoded a non-native read (bytecode below), now 0.

## Evidence
- **Executed:** `Entnbt92Probe` writes natural EntityPainting / EntityItemFrame (real constructors, plus `ItemHangingEntity.onItemUse`) after 0, 1, 101, 205 `onUpdate` calls and two `moveEntity` pushes: `Fire` is 0 at every step, so the old "omit Fire" was wrong. Reference rows in `entnbt92-reference.json`. The entnbt91 reference (88 rows) feeds the audit; the audit exemptions for HurtTime, AttackTime, Fire, witch gear, fireball tile fields and the Explosions list are removed.
- **Bytecode-read:** `sv.b/sv.a` write and read HurtTime, DeathTime, AttackTime; `sv` counts hurt and attack timers down; `xk.a(dh)` (EntityItem read) reads Health and Age and the item, no pickup delay; `aey` (RecipeFireworks) writes Explosions, `acs` (ItemFirework) only reads it; EntityFireball read/write of the tile fields.
- **Port-read:** the import, restore, serialize and export pipeline and the legacy-AI mob attack timers.

## Verification
- `node --test --test-concurrency=2` over 144 files (143 existing tests that name region-export, region-import, entity-base-nbt, java-mobs, java-projectiles, fireballs.js, fireworks, entity-summon, blaze-ghast-mobs, nether-melee-live, mobBaseOf or keptBaseImport, plus the new one): 1837 tests, 1837 pass, 0 fail.
- Fails without the fix: with the 12 changed source files reverted from Git, `node --test --test-concurrency=1 src/entnbt92-b92.test.js` gives 6 tests, 1 pass, 5 fail. With the fix: 6 pass.
- `npm run build` once: ok. The 6-test file re-run after the final edit restore: 6 pass (the 144-file run was on identical content).

## Found wrong in the batch 91 list
- "Hanging Fire is omitted natively": wrong, executed Fire is 0 at every step.
- PickupDelay read on import: not in 1.7.10 (batch 91 already removed the write; the read remained).
- Fireball in-ground, witch gear, HurtTime / AttackTime, Explosions were listed as lost; confirmed lost and now kept.

## Follow-ups
- Other lost tags not audited beyond the entnbt91 exemptions: DeathTime is always written 0 (a dying mob is removed after its animation in the port).
- A fireball's `ticksAlive` is not saved by native either; reset on load is a port choice.
- Browser-only: none of the hurt flash, witch potion use or fireball sticking was viewed.
