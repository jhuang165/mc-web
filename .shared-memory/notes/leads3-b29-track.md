# leads3 (batch 29): leash death, dimension change, unusable tags, horse GUI at size <= 0, hoppers

## Summary
- New native probe `tools/probes/Leads3Probe.java`, `tools/leads3-hopper.mjs`, `tools/verify-leads3.mjs` -> `public/research/leads3-reference.json` (leadDeath 33, leadDimension 12, horseNeg 420, hopper 20 scenarios). Replayed by `src/leads3.test.js` (shared replay `src/horse-neg-replay.js`).
- Leashed mob death: natively nothing clears the lead; the corpse keeps ticking `updateLeashedState`, a far or dead holder drops the lead item during the 20 ticks, removal loses it silently. Port: `gearDeath` no longer unleashes, `dying()` runs `leashTick` (tiny `entities.js` hunks).
- Unusable `Leash` tag on import: `java-mobs.js gearNbtFields` returns `leash: {lost: true}`; `horse-gear-live.js leashRestore` drops a lead item on the first tick (`gearFieldsFrom` keeps the marker).
- Dimension change: probed; the port flow already matched (`deliver` for a player holder, `leashRestore` for mob and knot holders). Only change: the arrival lead item gets random EntityItem motion (one line in `dimension-live.js`).
- Non-player rider on an untamed horse: `tameTick(h, r, null)` has no temper change and no taming draw; `horse-live.js` throws a mob rider with status 6.
- Horse GUI: saddle and armour slots take the 64 limit natively (whole stack on left click); `saddled` is "slot 0 non-null". Fixed in `horse-gear.js`.
- Creative drop bounds (size 1..64, damage >= 0) in `creative.js`; hopper negative stacks for every facing and double chests all match without code changes.

## Verification
- `node --test src/leads3.test.js src/leads2.test.js`; full `npm test` and `npm run build`: see the final reply.
- Native evidence is probe-run except the creative drop bounds, the spam counter and the delete slot (bytecode-read only).

## Follow-ups (proposed gap lines; remaining-gaps.md not edited)
- `horse-gear.js cleanItems` still drops saved horse stacks with count <= 0 and caps at 64; native `AnimalChest` readFromNBT keeps any count.
- The creative drop spam limiter (+20 per drop, refused at 200) is not modelled.
- Region export writes `Leashed` plus the player UUID for a `{lost: true}` record that has not ticked yet; natively the unusable tag would be written back as it was.
- A player holder that is in the new dimension too (player travelled first) is not modelled across `deliver`: the port always drops the lead for a mob that travels alone.
