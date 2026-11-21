# Batch 90 lead track

## Merged
On `batch90-lead`, cut from 1d51974cf (0.118.0), in this order: horse90, spcopy90, mobpackets90, mpobjects90, tiles90, mpperf90, entnbt90, console90, credit90, mobrec90. Track agents ran on Sonnet, by request; shared rules in `../artifacts/b90-lead/track-rules.md`. No merge conflicts.

## Lead fixes
- horse90 x spcopy90: `PlayerView.sneakOff` (horse90) called `setLocation` without `late`, so the sneak dismount's S08 was answered in the same tick, against spcopy90's new rule for world-pass S08s. It passes `{ late: true }` now (dd6b0b496); `lead90-b90.test.js` fails without it.
- tiles90 left `chunk-store.test.js`'s legacy migration test encoding the old furnace representation: a furnace cell with stray metadata (0, 1, 6-15) now exports and returns with the default facing 3, as `block-registry.test.js` already allows (ec2251ba1).
- `track88-b88.test.js` "a late viewer gets S0F..." was flaky (2 in 32 loaded runs on the batch; 0 in 48 on 0.118.0, but a standalone probe shows the same random helmet wear on both): the skeleton's leather cap is worn by the daylight roll on its `Math.random`-seeded Random, sending an unrelated S04. The test puts a roof over the pen (ec2251ba1); 16/16 loaded runs pass.

## Verification
- One full `npm test` on the merged tree (396505eda): 10140/10142. The two failures are the chunk-store and track88 items above; after the fixes, `chunk-store`, `block-registry`, `region-import`, `tiles90` 25/25 and `track88` 16/16 loaded runs.
- `npm run build` ok (existing chunk-size warning).
- Cross-track spot runs on the lead after each merge (horse90, spcopy88-90, horse88/89, mpperf90, tiles90, mpobjects90, mobpackets90, entnbt89/90, credit89/90, mobrec89/90): all pass.
- No browser checks, by request.

## Found wrong in the batch 89 list
See "Done in batch 90" in `public/research/remaining-gaps.md`: the PlayerView sneak delay held only for horses and pigs; the native S20 row order is not deterministic; S1D has no ambient field; only chunk data had wrong metadata; native `/setblock` ignores a dispenser's metadata; a broken mount sent two S08s.

## Open
"Still open from batch 90" in `public/research/remaining-gaps.md`.
