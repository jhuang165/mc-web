# rain84 (batch 84): rain for boats, falling blocks and the fishing hook; sounds at the feet; an executed TNT and minecart probe

## Summary
- **Boats (`boats.js`).** `move(..., hooks)` gives moveEntity's tail a `wet` getter: `entityWet(boat.inWater, hooks.rain ?? this.rain, x, posY, z, 0.6)`. A burning boat in the rain fizzes from `boat.random` through `hooks.fizz(boat, volume, pitch)` (or `this.fizz`) at the feet (`boat.y`) and rests at -1; a wet boat takes no ++fire in a fire cell.
  - Wired: main.js `boatHooks` (`rain: rainAt`, `fizz`) and the away run (`boats: { drop, rain }`, no sound).
  - **Not wired: the dedicated server** (`src/multiplayer/server-vehicles.js` `this.boats.tick(world, { entities })`). mpboat84 owns that file. The two lines are `this.boats.rain = (x, y, z) => !this.dim && !!host.weather && canLightningStrikeAt(host.weather, host.world, x, y, z)` and `this.boats.fizz = (b, volume, pitch) => host.soundsOut.push({ name: 'random.fizz', x: b.x, y: b.y, z: b.z, volume, pitch, except: null })` next to the `new Boats` there (`Boats` reads `this.rain`/`this.fizz` when the hooks lack them). Until then a server boat is dry for moveEntity.
- **Falling blocks (`falling.js`).** `FallingBlocks` takes `rain` and `fizz` options; `tickEntity` passes moveEntity a tail (`hurt` no-op, `wet` = rain at posY and posY + 0.98, `fizz` from `e.rand` at `e.y`). A falling block that crosses a fire or lava cell now gets ++fire (setFire(8) at 0) and keeps the counter, since nothing counts it down; rain puts it out with the fizz. Wired: main.js (sound + rain), the away run (rain), the Overworld server (`multiplayer/simulation.js`, rain and `soundsOut`). The Nether server instance has none (nothing rains there).
- **Fishing hook (`fishing.js`).** `fire` counter: water zeroes it, a client copy zeroes it, otherwise it counts down and a lava hit sets 300 (the order of sa.C). moveEntity's tail: `wet` = inWater or rain (`env.canLightningStrike` at y and y + 0.25), fire and lava cells do ++fire, a burning wet hook fizzes (`env.sound`, from the hook's Rand) and rests at -1. A hook is almost never "in lava" natively (see below), so the visible case is a hook flying through a fire cell.
- **Item and orb sounds at the feet.** `item-entities.js` pushed the wet fizz and the lava fizz at `e.y + 0.125`; they are now at `e.y`. `experience.js`: the lava fizz at `o.posY - 0.25` (before the move), the wet fizz at `o.bb[1]` (after it). One change covers the single-player, server and away callers, which pass the coordinates through.

## Evidence
- **Bytecode-read** (javap -c -p, 1.7.10 jar):
  - EntityBoat (xi): never reads `inWater` (field ac) or calls `L()`; no `ac` getfield, no `L:()Z` call in xi, xe or xj. xi.h calls `sa.h` (-> onEntityUpdate: handleWaterMovement sets ac, then the fire count-down, then lava) and moveEntity at offset 1385. So a boat's isWet is only the moveEntity tail's `sa.L`, i.e. inWater || rain; it has no other fire or rain behaviour. Boats are also hurt by `fire` through attackEntityFrom (the port already does this).
  - EntityFishHook (xe): xe.h calls `sa.h` and moveEntity (875); no direct isWet reads.
  - EntityFallingBlock (xj): xj.h never calls `sa.h`/`sa.C` (its only invokespecial is `sa.a(k)` in a crash-report method), so no handleWaterMovement (inWater never set), no fire count-down, no flag 0; it calls moveEntity at offset 77, so the tail runs.
  - sa.C order: N() (handleWaterMovement), then `remote ? fire = 0 : count-down`, then lava (`P()` -> `E()`). sa.L: inWater || y(feet) || y(feet + height).
  - `ahb.a(sa, String, F, F)` at posY - yOffset (rain83's read).
  - hook lava: `handleLavaMovement` boxes expand(-0.1, -0.4, -0.1); the hook box is 0.25 high, so the scan range is empty (the water test has the same quirk, fishing.js header); the port's `inLava` keeps that.
- **Executed** (new): `tools/probes/RainFireProbe.java` + `tools/verify-rain-fire.mjs` -> `public/research/rain-fire-reference.json`, 8 records. The unchanged `xw` (primed TNT) and `xs`/`xl` (minecart) `h()` on the FireworkCollideProbe world double (jar SHA-1 checked), with `ahb.y` replaced by "rain is on and no non-air, non-fire cell above" and `playSoundAtEntity` logged at `t - L` (bytecode-read formula). Per tick: fire counter, posY, box bottom, onGround, fizz [name, volume, pitch, x, feet, z]. Scenarios per kind: fire then rain, rain then fire, roofed column, dry fire.
  - Executed facts: a settled entity (-1) in a fire cell goes -1 -> 0 -> setFire(8) = 160 (TNT: then 161, 162 while it stays in the fire); neither a TNT nor a cart counts the counter down (160 stays for 12+ ticks); the first rain tick plays one `random.fizz` 0.7 at the feet (cart: posY 63.35, fizz y 63.0; TNT: posY 63.49, fizz y 63.0) and the counter is -1 from then on; rain before the fire: no ++fire, no fizz; a roofed column keeps burning in the rain; a cart left in fire breaks on the fifth tick (inFire damage +10 a tick), so the cart scenarios hold it in the fire for one tick.
  - The double's floor is at 63.0 (entities settle with the box bottom there); fire sits in cell (10, 63, 10). The pitch of the fizz is the jar's unseeded Entity.rand, so the replay checks the range 1.2..2.0.
- **Port-read**: yOffsets (boat 0.3, falling block 0.49, hook 0, orb 0.25, item 0.125).
- The weather condition in the probe is a double, not the jar's canLightningStrikeAt (no chunks); biome/snow handling stays rain83's bytecode-read.

## Verification
- `node --test src/rain84-b84.test.js`: 14/14 pass (8 executed replays of the TNT and cart records through `tickTnt` and `Minecarts.tickOne`, matching the fire counter, onGround and fizz per tick; boat, falling block, hook, sounds at the feet, wiring).
- Neighbour run (47 files importing or source-matching a changed module, `--test-concurrency=2`): 460/460 pass. No old test needed changing.
- `npm run build`: passes (only the usual chunk-size warning). The full `npm test` was not run.

## Follow-ups
- Wire the dedicated server's boats (two lines above, mpboat84's file).
- Browser-only: hearing the fizz of a burning boat or falling block in the rain; boat fizz position.
- Not modelled: a boat's flame overlay going out is unchanged (renderEntityOnFire reads fire > 0, now correct in rain); the hook has no flame draw.
