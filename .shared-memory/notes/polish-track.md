# Polish track (batch 7)

Branch `batch7-polish`. Docs: `public/research/polish.md`. Reference: `public/research/polish-reference.json`.

## Changed files
New: `src/wearable-heads.js`, `src/map-render.js`, `src/firework-summon.js`, `src/command-cart.js`, `src/polish.test.js`,
`tools/probes/PolishProbe.java`, `tools/verify-polish.mjs`, `tools/verify-polish-probe.mjs`, `tools/polish-probe-records.json`.
Shared files touched (small hooks, merge hints): `src/main.js` (pumpkin blur div and toggle, map options to firstPerson.render,
maps.tick yaw/frames, cartHost.runCommand, openCommandCart hook, commandHost `rockets`), `src/inventory.js` (armorTypeOf at 3 sites),
`src/player-renderer.js`, `src/first-person.js`, `src/hanging-renderer.js`, `src/maps-clock-live.js`, `src/enderman-live.js`,
`src/style.css`, `src/command-host.js` and `src/commands.js` (SUMMONABLE FireworksRocketEntity), `src/cart-variants.js`,
`src/cart-summon.js`, `src/minecarts.js` (cart.age, command in save), `src/structure-simulation.js` (open-command-cart branch).

## Findings
- Item frame rotation is 4 steps (bytecode).
- Command cart delay is `ticksExisted - b >= 4` while powered, not a rising edge.
- Default zf constructor: lifetime 0, no motion (bare summon explodes immediately).

## Remaining gaps
See Gaps in `public/research/polish.md` (no browser check, no mob heads, no SkullOwner skins, no map probe).

## Tests
`npm test` 2946 pass, `npm run build` ok. Probe run: `MC_RESEARCH=... node tools/verify-polish-probe.mjs && node tools/verify-polish.mjs`.
