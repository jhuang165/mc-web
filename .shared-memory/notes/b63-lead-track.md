# Batch 63 lead (claude-b63-lead), release 0.92.0

Ten Sonnet tracks in `../wt63-<name>` on `batch63-<name>`, cut from 0.91.0 (3144b37f2), merged --no-ff on `batch63-lead`. Rules: `../artifacts/b63-lead/track-rules.md`. No browser checks (user request).

Merged (track note `<name>-b63-track.md` each): horses2 2b1b4e76a, heldrender b07cfb81f, mpstats 9fe0c8bc3, mpprojectiles2 9995c9b04, mobcopies3 59297d9f4, mpvehicles3 1c9614eab, mpwither 7f908b05b, mpend a6e694732, mppvp 0f43004bb, mpnether3 f15e8f242.

Conflicts (all kept both sides):
- `main.js` `edit()` multiplayer line: the command cart screen (mpvehicles3), the connected bow draw (mpprojectiles2) and the C02 player attack (mppvp) are all in it.
- `simulation.js` constructor: stats, wither, commandBlocks and pvp fields; `server-mobs.js` imports (owners and wither).
- `server-dimensions.js` / `server-nether.js` (mpend and mpnether3): both imports, the End in the constructor next to `pinOverworldVehicles`, `removePlayer` clears both dimensions' mobs and vehicle views, the tick message uses `sim.presence(dim)` with the orbs and pickups, `entitiesIn` has the cart modes and `n.dim ?? NETHER`.

Lead fixes:
- **The End's orbs and vehicles.** mpnether3 made orbs, the pickup list and vehicles per dimension but hard-coded the Nether; mpend builds the End with the same code and had an inert orb stand-in and no `taken`, so the merged swap would have read `undefined`. The End now has a real `ExperienceOrbs` and `taken`, `tickOrbs(n.dim)`, `buildNetherVehicles` uses `n.dim`, and the Overworld's `dismount` hands End riders to the End's vehicles. `src/b63-lead.test.js` covers it.
- **PvP in the statistics.** mppvp emitted `pvpHit` and the death `killer`, which nothing consumed. `server-pvp.js` now adds `damageDealt` as `round(f * 10)` (EntityPlayer.attackTargetEntityWithCurrentItem, recalled) and `server-survival.js` adds `playerKills` to the killer (EntityPlayer.addToPlayerScore, recalled). The test is in `src/pvp-b63.test.js`.

Verification on the merged tree: `npm test` 7487/7487 pass (`../artifacts/b63-lead/npm-test.log`), `npm run build` ok, bridge unittest OK.

Open: see "Still open from batch 63" in `public/research/remaining-gaps.md`.
