# Batch 86 lead (0.115.0)

Ten tracks cut from e814bef37 (0.114.0), merged --no-ff on `batch86-lead` in `../wt86-lead`. Track agents ran on Opus, by request. Rules: `../artifacts/b86-lead/track-rules.md`.

## Merged (track tip, merge)
- summon86 197172e26, ac893e055
- seat86 c0938eb1c, 58f5572de (auto-merged `src/boats.js` with summon86)
- awaystore86 72bbaa2b6, 55f45e604
- predict86 08ddd5054, 42f29842e (auto-merged `src/main.js`)
- mobrec86 3a5b6eb08, da0b04c90
- lanes86 42a0ba8d6, 505541c6a
- mpperf86 7e2377479, c1ac7d639 (auto-merged `src/item-entities.js` with summon86)
- spcopy86 3ccc191cd, 73991051e (auto-merged `src/main.js`)
- console86 06caded37, 4597c57c2 (conflict in `public/research/commands.md`: both dated entries kept)
- blastcover86 a889eb39b, 2a2fcf16b (auto-merged `simulation.js`, `server-dispense.js`, `server-mobs.js`)

## Lead fixes
- 4597c57c2: kept both batch 86 entries in `public/research/commands.md`.
- d06d54958: `src/skins73-b73.test.js` scans every non-test module for Alex or slim models; console86's new harness `src/dedicated-cmds-replay.js` names its probe player Alex. The scan now skips that file.

## Lead checks
- spcopy86 makes every client move go through the native checks unless it calls `setLocation`. In `main.js`, /tp, pearls, bed wake and `__mc.teleport` call it; riding, sleeping and respawn are direct cases; a portal trip rebuilds the world through `openWorld`. No uncovered teleport path found (port-read).

## Cross-track tests
- 55 files (every changed test plus boat, thrown, hook, blast, tracker, summon, away, dedicated and copy neighbours) with MC_MPPERF83/84/85/86=verify: 692/692.

## Verification
- One full `npm test` on 2a2fcf16b: 9612 tests, 9611 pass, 1 fail (the skins test above; fixed, file rerun 22/22).
- `npm run build` ok; bridge tests ok. No browser checks.

## Found wrong in the batch 85 list
- Dispensed TNT has no placer natively (`kr` builds it with null), so that item was not a gap.
- mobrec86: the port already matched every new squid, conversion and pigman record.
- lanes86: the Nether and End instances were already on tracker rows; only the stand-in lanes sent exact rows.

## Open
"Still open from batch 86" in `public/research/remaining-gaps.md`.
