# Batch 70 lead: ten Sonnet tracks merged on `batch70-lead`, released as 0.99.0

Cut from 13d0f60fb (0.98.0). Worktrees `../wt70-<name>` on `batch70-<name>`; shared rules `../artifacts/b70-lead/track-rules.md`. No browser checks by request.

## Merged (--no-ff, in order)
- spfixes70 9e9eb64a9
- mpclicks70 d57bbf163
- sptab70 ac61dd6bc
- carts70 478ec832a
- researchdocs5 126f7b392: conflict in `enchantment-effects-tools.md`; kept spfixes70's line (Bane's slowness is applied) over the sweep's stale line.
- particles70 ed9ff59e9
- serverprops2 75836594f
- projectiles5 3c93ad6f0
- researchdocs4 4545ee619
- playerrender70 5af6ca7ae: conflict in `third-person.md`; kept the cape line and the sweep's pose line. The `main.js` hooks (`playerBody.tick` motion, `playerRenderer.name`) were checked for scope.

No code conflicts. Per-merge targeted tests passed, including the catalogue tests and the player-throw and block-action replays.

## Lead fixes
- 5ae0cf013 (test only): `bonemeal2-b66.test.js` moved the tall grass from (66, 10, 64) to (64, 10, 68). A red mushroom grown by the first click (Math.random, 40%) can put a cap side (radius 2, from y 11) in the cell above, so the double plant could not grow. Six runs of the file pass after the move.

## Verification
- Full `npm test` once on 5af6ca7ae: 8192 of 8193 passed; the one failure is the bone-meal test above (fixed test only, file re-run 6 times).
- `npm run build` ok; `python3 -m unittest discover -s tools -p 'test_memory_bridge.py'` ok.

## Open
See "Still open from batch 70" in `public/research/remaining-gaps.md`. Notably: the player footstep cell and the fence step rule, Weakness on mob damage, the slime split cap of 40, missing spawner ids (squid, bat, magma cube, villager), shadows for slimes and falling blocks, PvP reach for sleepers, item and orb tracking ranges, view-distance chunk streaming, the cape texture source.
