# Batch 71 steps71: step block follows Entity.moveEntity

## Summary
- `src/step-block.js` (new): `stepBlock(world, x, posY - yOffset, z)` returns the cell `floor(y - 0.2)`, the block (a fence, wall or fence gate below replaces it, unconditionally), `replaced` and `ladder` (ladder only, no vines).
- `src/main.js` (short hook in the walking step): block from `stepBlock` using `position.y - motion.ySize`; air is silent; redstone ore is touched only when not replaced; ladder step distance from the same call. The old `floor(y - 0.05)` is gone.
- `src/mob-steps.js`: `mobStepEvents` uses `stepBlock` (fence tops are no longer silent; vines no longer count vertical).
- Server mobs and thrown-entity steps go through `mobStepEvents` already; no remote-player step code exists in `src/multiplayer/`.
- Docs: `public/research/player-step.md`, `mob-steps.md` (Batch 71 lines).

## Evidence
- Bytecode-read: Entity.moveEntity (sa.d) offsets 1529-1883: `canTriggerWalking && !(sneak && onGround) && ridingEntity == null`; fence-like replacement is unconditional; `block == ladder` zeroes dy; step needs `block.material != air`.
- Executed: `StepBlockProbe` on the unchanged EntityPlayerSP, 7776 cases (21 blocks above and below, 4 heights, yOffset 0/1.62, step/dist/sneak), `public/research/step-block-reference.json`.
- Found wrong: the brief's "when that block is air" (native replaces whenever the block below is fence-like); vines counted as a ladder (native: ladder only).

## Verification
- `node --test src/steps71-b71.test.js` 4 pass; `src/mob-steps*.test.js src/player-step.test.js src/ladders*.test.js src/block-sounds*.test.js` 33 pass. `node --check` on main.js and mob-steps.js. Scope check: `stepBlock` import added, `motion` is module scope. Full npm test not run (batch rule).

## Follow-ups
- `motion.ySize` is passed as-is; native decays ySize by 0.4 at the top of moveEntity before the step, so a step right after a sneak drop differs by a few hundredths (not probed).
- `statsLive` still uses `countsVertical` (includes vines); not touched.
- Only a browser could show the audible result.
