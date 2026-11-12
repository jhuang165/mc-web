# Batch 50 lead (2026-11-12)

## Summary
Eight Sonnet tracks cut from ca6a447bf in `../wt50-<name>`, merged --no-ff on `batch50-lead` in this order: knotsplash, cmdoutput, cartrender2, mobresist, meleeorder, trackerids, awayorder, legacybody. No merge conflicts. Release 0.79.0. Each track's details are in `<name>-b50-track.md`.

Lead fix (5acda9b58): with knots on the crosshair pick, `serverAcceptsClick` (`main.js`) called `mobs.ai.brain` on the knot stand-in and threw, so a knot click never landed. The knot's C02 eye height is now 0, `Entity.getEyeHeight`, since `EntityHanging` does not override it. A guard test is in `knot-splash-b50.test.js`.

## Verification
- Full `npm test` once on the merged branch: 6373/6373 pass. `npm run build` ok. Bridge unittest OK. `git diff --check` clean.
- After the lead fix, only `knot-splash-b50.test.js` was re-run (11/11).
- Muted headless smoke (`artifacts/b50-lead/smoke.mjs`, vite 5590, killed afterwards):
  - Real clicks: a click on a cow lands after the walk (10 to 3 health). A summoned knot breaks on a click after the fix; before it, the page threw "reading 'ai'".
  - Carts: stairs and fence display carts draw their item form, identical to the cartrender2 branch (`fence-lead.png` vs `fence-cr2.png`). A TNT cart copy counts its fuse and spawned 66 smoke particles.
  - Ticks: 160 per 8 s in the Overworld and the Nether, no long tasks while turning. The only errors are the known 404 and localStorage messages.
  - Not seen: boat splash. The boat copy reached 0.17 blocks a tick on land, below the threshold.
- Smoke-script pitfalls: negative pitch looks down, and `page.mouse.move` after the pointer lock turns the camera, so set `look` just before clicking. `cow.ai` is the world's shared AI object; do not set fields on it.

## Follow-ups
See "Still open from batch 50" in `public/research/remaining-gaps.md`.
