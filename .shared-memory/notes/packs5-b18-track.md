# packs5 (batch 18, resource packs round 5)

Branch b18-packs5.

## Changed
- Held items: third-person (`player-renderer.js`) and mob (`mob-equipment-renderer.js`) cache keys carry `itemFrameTag`; rebuild only on a frame change. `item-animation.js registerFrameTag` makes dropped/framed/held clocks follow the clock frame (previously frozen).
- `src/sprite-frames.js` (new): compass/clock frame count from the pack strip + mcmeta (native `framesTextureData.size()`); `compass.js`/`clock.js` take the count; `main.js` (compass tick, `--compass-frames`) and `maps-clock-live.js` use it.
- Item frame compass: own texture, angle set directly from frame x/z and `180 + dir*90` (`compass.js itemFrameCompassFrame`, `hanging-renderer.js syncCompass`, `first-person.js drawCompassCell`).
- Loading overlay: native shows none; web note removed (`resource-refresh.js`).
- Probe: `MapsClockProbe.frameCounts` (clockFrames 30, compassFrames 36 records) -> `public/research/maps-clock-reference.json`; test `src/sprite-frames.test.js` (4).
- Docs: `public/research/resource-packs.md` Round 5.

## Evidence
Probed (unchanged bqm/bql): frame selection and smoothing for 1..128 frame lists, item-frame direct set. Bytecode-read only: bqd.a/bqd.e frame list sizing, bnx item frame call, bao.c/brg.a/bgf overlay absence, non-surface random angle.

## Remaining gaps
- No GPU sub-rect atlas upload (optional item 4 not attempted).
- Browser unchecked: framed compass texture swap (uniform map replaced), HD compass/clock strips, creative strip icon with other counts, held clock/compass on mobs.
- Native shares one compass sprite (a framed draw leaves its frame for other compasses until the next tick); the port does not.
- Invalid compass/clock pngs tolerated instead of the missing texture.

## Proposed remaining-gaps text
- Item 8 (unchanged by this track).
- Item 9: replace "Still open: mob and third-person held items keep the frame current when built, compass/clock mcmeta, an unverified native loading overlay" with "Batch 18: mob and third-person held items follow animated icons (rebuilt on a frame change), compass/clock take their frame count from the pack strip and mcmeta (probed with 1-128 frame lists), framed compasses use the frame's own angle, and the native loading overlay was bytecode-read to be absent (none shown). Still open: GPU sub-rect atlas upload, browser verification of these paths ([resource-packs.md](resource-packs.md))."
