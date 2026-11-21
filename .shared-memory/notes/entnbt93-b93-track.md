# entnbt93 (batch 93): DeathTime round trip for a mob saved mid-death

## Summary
Not full parity; open items at the end.
- `entities.js`: `serialize()` now includes a mob in its death animation (`health <= 0`, integer `death` 0..19; not the dragon, which has its own save, nor a crystal); `restore()` accepts a Health 0 record whose `death` is 0..19 (it refused every Health 0 record) and the mob finishes the animation (`deathUpdate` counts to 20, then removal).
- `entity-base-nbt.js` `mobBaseOf`: reads the DeathTime short (as `deathTime`).
- `java-mobs.js` `javaMobFromNbt`: for a record at Health 0 and DeathTime 0..19 (missing = 0) sets `death`; `deathTime` is never left on the record.
- `region-export.js`: a mob at Health 0 writes its live `death` as DeathTime (was always 0).
- New: `src/entnbt93-b93.test.js` (3 tests), `tools/probes/Entnbt93Probe.java`, `tools/verify-entnbt93.mjs`, `public/research/entnbt93-reference.json`.

## Evidence
- **Executed** (`Entnbt93Probe`, unchanged 1.7.10 classes through CommandSummon, `entnbt93-reference.json`): a cow summoned with HealF 0 / DeathTime 7 is saved (writeToNBTOptional) with DeathTime 7, 8 after one update, 12 after five, and is not saved after 19 more (setDead at 20). A Health 0 record without DeathTime loads dying from 0. A Health 0 record with DeathTime 25 is never removed (counter 25, 26 ... 46, still saved). A live cow with DeathTime 9 keeps 9 forever.
- **Bytecode-read** (batch 92): `sv.b/sv.a` write and read DeathTime.
- **Port-read:** serialize / restore / export pipeline; the zombie probe NPE'd on onUpdate (no sky light table in the double), so rows use a cow (same EntityLivingBase code).

## Verification
- `node --test --test-concurrency=2 src/entnbt93-b93.test.js`: 3 pass. With the four source files reverted from Git: 2 pass, 1 fail (the round trip).
- Wider run: see lead reply (every test naming region-export, region-import, entity-base-nbt, java-mobs or serialize()).
- Build not run (no import changes).

## Found wrong in the batch 92 list
- "DeathTime is always written 0 (a dying mob is removed after its animation)": native saves a dying mob (not setDead until deathTime 20), so the port lost it. Fixed for mobs.

## Follow-ups
- Not done, the other audit keys of the task: no executed divergence was found or investigated for `AbsorptionAmount`, `ActiveEffects`, `Leash`, villager `Offers`, horse items, `ExplosionPower`, enderman carried, `ItemRotation`, `Motive`, minecart display; the entnbt91 reference round trip (84 rows) already compares them tag for tag and passes. Only the rows' values were exercised, not edge values.
- A Health 0 mob with DeathTime >= 20 (native: immortal corpse) and a live mob with DeathTime > 0 (native keeps the rotated pose) are still dropped / reset in the port.
- Players, the dragon and a crystal still write DeathTime 0.
- Browser-only: none of the death animation after a reload was viewed.
