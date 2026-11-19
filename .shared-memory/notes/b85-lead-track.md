# Batch 85 lead (0.114.0)

Ten tracks cut from 3bf09d50a (0.113.0), merged --no-ff on `batch85-lead` in `../wt85-lead`. Track agents ran on Sonnet. Rules: `../artifacts/b85-lead/track-rules.md`.

## Merged (track tip, merge)
- boatseat85 277d6b8d6, b2fc9c2f3
- mppredict85 a1e4c3d51, a38d7ede6
- mphook85 6be9914bd, 6c46ef66a
- spcopy85 3f4be6807, 90588023e
- pickup85 7baa10309, e816a4a7a
- dedtab85 14532e27f, 660b08bc3
- fire85 1559babac, 2b6d1c55a
- mpperf85 f2d1d5fcc, 197ed918f
- blastprobe85 41d192ee6, 8527d6675 (auto-merged `src/hanging.js`)
- convert85 1093ed4aa, ba2cbed8f (auto-merged `src/entities.js`)

No conflicts.

## Lead fixes
- b7c15aa25: `src/mpsurvival-b58.test.js` asserted that Creative players cannot pick up on the server; pickup85 made them collect, as natively (EntityItem.onCollideWithPlayer has no mode gate). The test now expects the pickup.

## Cross-track tests
- 36 files (every changed test plus boat, thrown, tab, blast, dragon, hanging, explosion and tracker neighbours) with MC_MPPERF83/84/85=verify: 447/447.

## Verification
- One full `npm test` on ba2cbed8f: 9483 tests, 9482 pass, 1 fail (the mpsurvival test above; fixed, file rerun 8/8).
- `npm run build` ok; bridge tests 5/5 ok. No browser checks.

## Found wrong in the batch 84 list
- fire85: a non-positive fire counter already rests as natively; carts, hanging entities, falling blocks and crystals have no native water pass; onSpawnWithEgg runs only with no tag, so the ocelot summon already matched.
- pickup85: the farmland self-check is not native (BlockFarmland has no onBlockAdded; setBlock notifies only the neighbours).
- mphook85: native throwable copies never hit entities on the client (`zk.h` isRemote); fishFx has no duplicates to remove.
- dedtab85: the 64 tab rows already matched once replayed.

## Open
"Still open from batch 85" in `public/research/remaining-gaps.md`.
