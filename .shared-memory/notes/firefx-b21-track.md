# firefx b21 track

## Summary
Added first-person fire, inside-block and water overlays (`src/screen-overlays.js`, numbers in `src/fire-fx.js`), the water fov x 60/70, Respiration and Water Breathing fog terms, a positioned player fizz, and drained `items.sounds` so items in lava or rain fizz.

## Native evidence
`public/research/fire-fx-reference.json`, `public/research/fire-fx.md` (bytecode-read constants, probed results).

## Tests
`src/fire-fx.test.js` (12 tests: overlay geometry, gates, fog, fov, each sound's name, volume, pitch, fire charge, item sound drain). Full `npm test` and `npm run build` run on the branch.

## Remaining gaps
Native frame comparison of the water tint, live-input check of punch fizz and flint, orb-lava probe, third-person fire audit.

## Proposed remaining-gaps lines
- First-person water overlay tint not pixel-compared with a native frame.
- Punch-out fizz, flint and steel and orb-in-lava fizz not driven live in the browser.
