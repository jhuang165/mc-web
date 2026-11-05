# Batch 5 lead handoff (2026-11-05, claude-lead)

Merged five Sonnet worktree tracks into main with `--no-ff`, in this order: spawn-eggs, ocelot, mooshroom-golem, eye-of-ender, horse. Each track's details are in its note: spawn-eggs-track, ocelot-track, mooshroom-golem-track, eye-of-ender-track, horse-track.

## Merge resolutions
Hot files were resolved by taking the union of both sides, adding each mob to every name, sound, health and spawn table:
- `combat.js`, `commands.js` (SUMMONABLE), `entities.js`, `java-mobs.js` (+ test)
- `region-export.js` (NAMES), `mob-renderer.js`, `population-runtime.js`
- `player-edit-simulation.js`, `main.js` (setProjectiles also draws eyes and golem snowballs)
- `original-items.js`, `item-names.test.js`

Other merge fixes:
- Fall damage is skipped for the chicken, bat, ocelot, snow golem and iron golem (EntityGolem.fall).
- `population-creative.js` was regenerated with `tools/build-population-creative.mjs`.
- The recipe audit is now 292 checked recipes and 2628 checked cells.

## After the merge
- 5b9280a: `itemFromOriginal` keeps item 383's damage (the EntityList id). Before this, `/give @p 383 1 100` and imported eggs were rejected. A test was added.
- 9837d13: added `horse` to the import-vanilla-media regex, then ran it (`cat` was already listed). This added 72 clips (mob/cat, mob/horse), for 385 in total. The manifest diff is additive only; `media.test` was updated.

## Verification
- Checked on localhost:5181 with `?silent` in a new world, using LAN cheats and Creative:
  - Ocelots render: wild, and the Siamese, red and black cats, sitting.
  - The mooshroom has its mushrooms and the snow golem its pumpkin.
  - All five horse types render. A saddled horse in diamond armour shows its markings.
  - The Horse, Ocelot and Mooshroom eggs spawn the right mob from the hotbar.
  - A thrown eye climbs away.
  - The bottle leaves XP orbs.
  - The fire charge places fire.
  - The 12-frame ring fills the 3×3 with block 149, and the starfield draws.
  - No console errors.
- `npm test` 2173 pass; `npm run build` ok.
- Not checked in the browser: mooshroom shearing, the golem snow trail and snowballs, taming and riding a horse, cat sitting on a chest. Each has unit tests against the probe.

## Next
- End dimension (travelToDimension 1).
- Horse inventory GUI, leads and the jump bar.
- Magma cube and blaze (eggs exist but do nothing).
- Dispenser egg behaviour.
- Native SpawnerAnimals pass for ocelot and mooshroom.
- Snow golem particles.
- Use the real stronghold starts for the eye of ender.
