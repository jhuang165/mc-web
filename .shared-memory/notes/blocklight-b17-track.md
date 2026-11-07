# Batch 17 track: block light and block audit replays (b17-blocklight)

## Summary
- New native evidence: `tools/probes/BlockLightProbe.java` -> `tools/verify-block-light.mjs` -> `public/research/block-light-reference.json` (171 registered blocks, `Block.lightValue` and `Block.lightOpacity` from the unchanged jar).
- Divergence fixed: powered repeater (original 94, internal 112) emits light 9. `lighting.js lightEmission(112, lit)`, `scene.js` emission callback via `scene.repeaterLit` (set in `main.js` from `LiveRedstone.lit`), `updateBlocks` relights when a repeater's lit state changes or it is removed (`scene.repeaterEmit` remembers the state the volume last used), restored powered repeaters relight after `redstoneRuntime.restore`.
- Divergence fixed: cake collision box is 1/16 below the selection box (0.4375), `world.js collisionBounds`.
- The whole light emission and opacity table otherwise matched the native values for all blocks.
- Column replays: `src/block-audit-columns.test.js` replays the b16 `box`, `neighbour` and wart `tick` rows (boxes for metadata 0-15, six-side neighbour removal through LiveRedstone/carpet/stem-cake/NetherLive paths). No other divergence found.

## Tests
`src/block-light.test.js` (3), `src/block-audit-columns.test.js` (4), `src/block-audit.test.js` (OPEN_LIGHT exemption removed). Full `npm test`: 3804 tests, all pass (build ok). Regenerate evidence with `MC_RESEARCH=<dir with minecraft-1.7.10.jar> node tools/verify-block-light.mjs`.

## Remaining gaps
- Box/neighbour/tick columns were probed only for the 38 b16 blocks; the other blocks rely on subsystem tests. A sweep probe over all ids would extend it.
- Stem growth and dragon egg ticks are not replayed here (probe rows are NPE / covered by end-reference).
- The `main.js` world-level wiring (watchFlowers, Torches, Rails) is not driven by these replays, only the pure functions.
- Exempt collision rows: end portal, carpet (zero-height plane), nether fence (1.0 single box vs 1.5 via addCollisionBoxesToList).

## Proposed remaining-gaps.md block behaviour line
Block behaviour: light emission and opacity of every block id, plus box, neighbour-reaction and wart-tick columns of the 38 b16-audited blocks, are native-probed and replayed (batch 17); the remaining ~140 blocks' box/neighbour/tick rows and stem/egg ticks have no per-block native sweep.
