# entnbt97 (batch 97): player and mob NBT edge cases against the real classes

## Summary
- `tools/probes/Entnbt97Probe.java` (player) and `Entnbt97MobProbe.java` (mob) run edits through a real EntityPlayerMP / mob load, tick and save. `tools/verify-entnbt97.mjs` writes `public/research/entnbt97-reference.json` (players 156 rows, edge 93 rows, leashTicks).
- `src/player-nbt.js`: Motion NaN is kept (`loadedMotion`), new `restoredMotion` (JSON null back to NaN); `src/main.js` uses it (one line plus one import, code-read only).
- `src/bed.js`, `src/region-import.js`: a negative awake SleepTimer is kept (the tick counts only above 0). `abilities.flySpeed/walkSpeed` pass through as `record.abilitySpeeds` and `src/region-export.js` writes them.
- `src/survival.js`: food level, saturation, exhaustion and tick timer are no longer clamped to 0..20 / 0..food / 0..40 / 0..80 (native keeps them raw). `src/experience.js`: Score may be negative.
- Mob: `src/java-mobs.js` (no HealF and no Health: health = modified max), `src/mob-attribute-list.js` (modifier UUID defaults 0,0; same-UUID modifier on one attribute replaces the earlier; Base defaults 0; knockback bonus compares against base clamped 0..1), `src/region-export.js` (a lost lead no longer writes the raw `Leash`; unticked native writes `Leashed=1b` only).
- Test `src/entnbt97-b97.test.js`. Old `src/entnbt96-b96.test.js` edited: two Motion NaN asserts encoded "reads as 0", which is non-native (executed NaN is kept).

## Evidence
- Executed: Motion NaN kept, infinity reads 0; negative awake SleepTimer stays and is written; HealF 0..20 clamp, NaN kept, int Health ignored; food/saturation/exhaustion/timer, XpP/XpLevel/XpTotal/Score kept raw; playerGameType overrides abilities (creative sets mayfly/instabuild/invulnerable, survival/adventure clear them and flying, type 3 reads 0, adventure mayBuild 0); abilities booleans from any numeric tag, speeds read only with flySpeed present, kept raw (negative, NaN, infinity).
- Executed (mob): absent HealF and Health gives modified max; missing modifier UUID reads 0,0; duplicate UUID last wins; unknown attribute names skipped; Base absent 0; Leashed unticked writes `Leashed=1b` with no `Leash`; after the first tick a knot is kept as {X,Y,Z}, UUID holders without entity, empty/non-compound Leash, missing Z and Leashed:0 drop the lead. Native crashes ("Loading entity NBT") on modifier Operation 7, a modifier without Name, DropChances list of seven (the port does not model the crash; rows skipped).
- Executed: DropChances, CanPickUpLoot, PersistenceRequired already matched.
- Bytecode-read: `yz.h` (onUpdate) SleepTimer counts only when above 0.
- Port-read: the `main.js` Motion line; `world-import.js importedRuntime` whitelist.

## Verification
- `node --test --test-concurrency=2 src/entnbt97-b97.test.js src/survival.test.js`: 28 pass, 0 fail (entnbt97 alone: 6 pass).
- Related run (165 files importing bed, level-dat, region-export, region-import, experience, mob-attribute-list, java-mobs or player-nbt, plus survival, food-items, hardcore): 1944 tests, 1943 pass, 1 fail (`survival.test.js` "untrusted saved resources and stats are bounded"), fixed afterwards: it asserted food 900 reads 20, which is non-native (executed 500 stays 500); changed to 900 and re-ran (28 pass). Old `entnbt96-b96.test.js` Motion NaN asserts also changed for the same reason.
- Fails-without-the-fix: checked. With the 8 src files reverted (main.js left changed), the new test file does not even load (import of `restoredMotion`) and fails 0 of 1; restored, 6 pass.
- `npm run build`: ok (once).

## Found wrong in the batch 96 list
- Batch 29 claim that an unusable Leash tag is written back as it was: executed shows an unticked mob writes `Leashed=1b` and no `Leash`.
- Batch 96 assumed Motion NaN reads as 0 (executed: kept).
- JsonToNBT does not parse exponent notation (`1.0E30d`, `NaNd` become strings), so exponent rows are not usable probe inputs.

## Follow-ups
- Open: XpP/XpLevel/XpTotal out-of-range (`Experience` stores total only); NaN HealF, saturation, exhaustion not preserved; port movement ignores loaded flySpeed/walkSpeed; UUID leash holder is resolved by `relinkMobs`, not at mob import; `world-import.js` `playerState` is not in RUNTIME_FIELDS (port JSON format); crash rows not modelled; scope item 3 (Fire, Air, PortalCooldown, Invulnerable, Dimension on generic entities) not started.
- Browser-only: nothing was viewed in a browser; the `main.js` Motion line is code-read only.
