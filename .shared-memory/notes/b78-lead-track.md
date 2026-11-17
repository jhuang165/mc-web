# Batch 78 lead: merges, fixes and release 0.107.0

## Merged (git log --first-parent on batch78-lead)
- mphorseview78, spswing78, packs78, loot78, mpexplosion78, mphorse78, mpperf78, mpadventure78, falling78, spexec78.
- No textual conflicts. Auto-merged overlaps: `server-dispense.js` and `server-mobs.js` (loot78 + mpexplosion78), `entities.js` (loot78, mpperf78, mpadventure78, spexec78), `simulation.js` (mpexplosion78, mphorse78, mpadventure78, falling78), `main.js` (several). Overlap tests after the joins: loot/explosion/dispense 29/29, perf/loot/horse under `MC_MPPERF78=verify` 17/17, adventure/falling/swing/explosion/loot 35/35, spexec/adventure/loot 29/29; `mpnether3-b63` 9/9 (mphorse78 left it unfinished).

## Lead checks
- mpadventure78 says 1.7.10 never refuses an Adventure item use with a stack in hand: `add.z()` calls `adb.v()`, which returns true (javap), and no direct `adb` subclass overrides `v()` (lead scan). Kept.
- spexec78's jukebox fix: `adr` puts records under the bare name (`Map.put(aload_1, this)`), and the aux 1005 branch of `bma` passes `"records." + name` to `playRecord`, whose `adr.b` lookup then misses, so no "Now playing" message (javap). Kept.
- mphorse78's shutdown keeps the horse both in the world and in `Riding` (a second horse on login); reasoned from `stopServer` bytecode, not executed.

## Full-test failures and fixes (332c5b5ae)
- 25 `player-throws-b46` replays: spexec78 removed the `GaussianRandom.nextGaussian` override (Math.log) in favour of `JavaRandom`'s StrictMath version, whose cache is `haveNextGaussian`/`nextGaussianValue`; the test set and read the removed `spare` field. Test updated; no code used `spare`.
- `recipe-catalogue` 312 vs 308: falling78 mapped fire (51) to the port's fire block, so the audit could build the four native fire-block chainmail recipes, which the port lacked. `ARMOR_MATERIALS` Chain now takes `FIRE`; all 312 mapped recipes match with 0 mismatches; `recipe-parity-catalogue.md` regenerated; `catalogue-consistency` no longer lists C25/C26/C125/C126 as known absences.

## Verification
One full `npm test` on d70e437d5: 8899 tests, 8873 pass, 26 fail (above). After the fixes, targeted reruns: throws 26/26, recipe + catalogue + villager-persistence 10/10, survival/falling78 57 pass, 13 recipe-reading files 266/266. No second full run (one per change, by request). `npm run build` ok; bridge tests ok. No browser checks (by request).

## Browser-only (not verified)
Remote rider body yaw, the horse preview, S27 knockback, dressed server mobs and zombie villager armour, the swing change, pack frames and spawn egg tints after the canvas change, chainmail in the crafting grid.

## Open
See "Still open from batch 78" in `public/research/remaining-gaps.md` and the ten `*-b78-track.md` notes.
