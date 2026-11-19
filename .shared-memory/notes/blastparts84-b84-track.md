# Batch 84 blastparts84: the explosion entity list, continued

## Summary
- **Arrows** (`bow.js` `explodeOne`): a blast that reaches an arrow sets `velocityChanged` (native `sa.a` = setBeenAttacked). Single player: the object tracker sends the tail S12. Away run: same `Arrows` code. Server: dispensed arrows have no tracker entry (the client simulates its copy from the snapshot rows), so the flag is set but nothing sends S12; that lane belongs to mpthrown84.
- **Dragon** (`explosion-simulation.js` `mobRows`): natively the list holds the dragon body (xa) and then its parts, consecutively, at the dragon's slot (parts are not chunk-list entries). Parts are listed only when the body box meets the query area and each part's box meets it as well. Now: the parts are collected before the first hurt (box test at list time), and the body takes its push (`xa.a(ro, F)` returns false: no damage, no setBeenAttacked; eye = posY + 0.85 * 8). Each part still forwards through `attackEntityFromPart` (existing). Sorting by the body's slot is therefore native; parts need no stamps of their own.
- **Hanging drops**: single player now spawns a broken hanging entity's drop at its own turn (the plain `Hanging` is drained through `vehicleDrop` right after `explodeOne`), like the server (`ServerHanging`). Natively `ss.a` -> dropItemOrSelf spawns at once; the item is born after the list was taken, so it is in no row.
- **Crystal**: `wz.<init>` sets yOffset = height / 2 = 1, so the port's `y` is posY (consistent with `end-generator.js`, `crystalTick`'s floor(y), and the probe), but `mobRows` used a feet-based box [y, y+2] and a living eye (0.85 * 2). Fixed: box [y-1, y+1], eye = y (wz has no getEyeHeight override).
- **Eyes of ender / hooks in the away run**: not wired. The run keeps eyes only as saved records (no live object to push or velocity-flag) and has no angler for a hook; wiring would mean mutating saved records. Left open.

## Evidence
- Bytecode-read (javap, 1.7.10 jar): `apx.a(sa, azt, List, sj)` (entity added, then `at()` parts added inside the same intersects block), `xa.a(ro, F)` (returns false), `wy.a(ro, F)` (forwards to `wx.a(wy, ro, F)`), `wz.<init>(ahb)` (yOffset = N / 2).
- Port-read: arrow tracker flag path (`entity-tracker.js`), server snapshot (`server-dispense.js`), away `dropVehicle`.
- Not executed: no new probe scenes. The BlastOrderProbe is unchanged; `candidateOrder.flat` in the creeper replay is untouched.

## Verification
- `node --test src/blastparts84-b84.test.js`: 4 pass.
- Neighbours (blast81, blastorder83, bow, dragon, dragon-sweep, explosion-entities, explosion-simulation, hanging, spblast82): 88/88 pass. `npm run build` OK.

## Follow-ups
- Extend BlastOrderProbe with an EntityDragon (xa) scene and a hanging entity scene.
- Server-dispensed arrows need a tracker lane to send S12 (mpthrown84).
- Away run eyes and hooks.
- Browser-only: how the blast pushes look.
