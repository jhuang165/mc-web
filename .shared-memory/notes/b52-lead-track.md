# Batch 52 lead (2026-11-12)

## Summary
Eight Sonnet tracks cut from 8cd3f1725 (release 0.80.0) in `../wt52-<name>`, merged --no-ff on `batch52-lead` in this order: dragoncopy, ridecart, digstart, displayfx, cmdchat, mobexport, savedorder, trackerflush. No merge conflicts (`src/main.js` and `src/entities.js` auto-merged). Release 0.81.0. Each track's details are in `<name>-b52-track.md`.

Lead commits:
- 6e7bd1611: removed the ridecart track's committed smoke script (`artifacts/` scripts stay out of the repo).
- 32af910af: the display cart's grass block. The displayfx track drew it all white (grey top from the terrain atlas), reading `blm.a` as forcing white. The bytecode (offsets 237-364) sets glColor to `i(meta)` * brightness just before `renderFaceYPos` when the block is `ajn.c` and `useInventoryTint` is on, then back to white. So only the top face is tinted (7cbd6b, the executed `getRenderColor`). `displayTopTint` plus a second material on BoxGeometry group 2; the displayfx test now checks it against the executed colour.

## Verification
- Full `npm test` once on the merged branch: 6482/6482 pass. `npm run build` ok. Bridge unittest OK. `git diff --check 8cd3f1725` clean.
- Muted headless smoke (`artifacts/b52-lead/smoke.mjs`, `smoke2.mjs`, `smoke3.mjs`; vite 5590, killed afterwards):
  - Real right click placed a block (0 to 1). A held dig broke a grass block (id 1) and kept going into the floor below, as a held button does.
  - Real left click hit a cow after the walk (10 to 9).
  - Display carts: grass block with a green top and plain sides, oak and spruce leaves tinted, tall grass tinted (`carts.png`). The pumpkin stem (104:5) is inside the cart walls: its item box is 0.25 high.
  - Real right click mounted an empty cart. Pushed along x, the player's x equals the cart copy's x every sample while the live cart leads (`ride.png`).
  - Command errors draw red in the chat window from their components (`chat.png`: permission refusal and unknown command).
  - `save()` ran with the order stamps, no error. Ticks: 160 per 8 s in the Overworld and the Nether, no long tasks while turning. The only errors are the known 404 and localStorage messages.
  - Not seen: the lightning ignition, effect export, saved order after a reload, the same-tick destroy flush and the dig-start effects (tests only).

## Follow-ups
See "Still open from batch 52" in `public/research/remaining-gaps.md`.
