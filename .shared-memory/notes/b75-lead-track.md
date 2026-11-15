# Batch 75 lead: merges, joins and release 0.104.0

## Merged (git log --first-parent on batch75-lead)
- researchdocs8, mpbuckets75, skintex75, spfixes75, mpplayerfx75 (clean)
- mpusesweep75: conflict in `src/multiplayer/simulation.js` (mpbuckets75's `bucketUse`/`installFluidHooks` import and air/block use calls vs mpusesweep75's `airUse` from `server-air.js`); both kept, the bucket call first on both the air path and the block path.
- spsounds75, mppushgrid75, guiaudit75, entityaudit75 (clean).

## Lead checks
- mpplayerfx75 first removed the PvP attacker 0.6 slowdown. javap on `bll` (EntityOtherPlayerMP): `a(ro, float)` (attackEntityFrom) returns true, so EntityPlayer.attackTargetEntityWithCurrentItem applies the slowdown against players. The track restored it (6d5232105): `server-pvp.js` keeps the 0.6 scaling, mob hits only clear sprint.
- Skeleton-horse lightning traps: `mt` (WorldServer) creates the bolt `xh` and no horse, so traps are not in 1.7.10 (bytecode-read).

## Verification
One full `npm test` on the merged tip: 8629 tests, 8627 pass, 2 fail. Both were test bugs, fixed in the release commit (no game code changed):
- `mpspawn73-b73.test.js` "past the old 80 mobs": a fixed bound of 79 + 12 monsters failed at 93 on some random draws. The cap is checked once per type at the start of a pass (as SpawnerAnimals), so the last allowed pass can overshoot by more than one group. The test now asserts the native property: past the cap, and 50 more passes add no monster. 10/10 file runs pass.
- `mpdragon2-b65.test.js` "right click on a dragon egg": the counting box used y 33..47 around the player instead of 34..48 around the egg (y 41), missing a +7 teleport. 5/5 file runs pass.
Every b75 track branch passes the spawn test alone; the merged tip passed it 20/20 before the edit, so no merge regression. `npm run build` ok; bridge tests ok. No browser checks (by request).

## Browser-only (not verified)
Skin/cape orientation and hat-layer blending (skintex75 straight alpha), server bucket fizz sound/particles, entity right-click results in the client, the Controls list (guiaudit75).

## Open
See "Still open from batch 75" in `public/research/remaining-gaps.md` and the ten `*-b75-track.md` notes.
