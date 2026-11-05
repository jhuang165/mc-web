# Horse track (batch 5)

Branch: `batch5-horse`. Evidence: `public/research/horse-reference.json`; doc: `public/research/horses.md`.

## Changed files
New: `src/horse.js`, `src/horse-live.js`, `src/horse-renderer.js`, `src/horse.test.js`, `src/horse-world.test.js`, `tools/probes/HorseProbe.java`, `tools/verify-horse.mjs`, `public/research/horse-reference.json`.

## Merge hints (shared files, one-line hooks)
`src/entities.js`, `src/combat.js`, `src/commands.js`, `src/population-runtime.js`, `src/java-mobs.js` (+ `java-mobs.test.js` key list gains EntityHorse), `src/region-export.js`, `src/vehicle-simulation.js`, `src/main.js` (rider state replaced by `seatsFor`), `src/player-edit-simulation.js`, `src/mob-renderer.js`.

## Gaps
GUI/armour/chest UI, leads, mule breeding, undead horse spawning, jump bar HUD, renderer unverified visually.

## Tests
`horse.test.js` 14, `horse-world.test.js` 7. Full suite 2126/2126, build ok.
