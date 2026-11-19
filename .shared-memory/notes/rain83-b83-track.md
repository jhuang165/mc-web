# rain83 (batch 83): rain as part of Entity.isWet, and the minecart fire counter

## Summary
- **`src/entity-wet.js` (new).** It imports nothing, so modules that weather.js cannot reach without a cycle can use it.
  - `rainedOn(strike, x, posY, z, height)` is the rain half of sa.L. `strike` is the world's canLightningStrikeAt, or null where nothing rains.
  - `entityWet(inWater, strike, ...)` is the whole test.
  - `wetFizz(next)` is moveEntity's wet-and-burning fizz: random.fizz 0.7, 1.6 + (r - r) * 0.4, two draws.
  - `weather.js` `isWet` stays as it is. Mobs, the player, orbs and arrows already used it.
- **Firework rockets.** `tickRocket(..., { rain })`: wet = inWater or rain after the move (yOffset 0, height 0.25). This is the branch fireext82 left out.
  - In a fire or lava cell, a wet rocket takes no ++fire.
  - A wet rocket still burning (a server rocket after lava) sets `out.fizz` from the rockets' `rand` and rests at -1.
  - `FireworkRockets.tickOne` plays `out.fizz` through `hooks.sound`, before the launch sound. It reads `hooks.rain`.
  - A client rocket zeroes its counter first, so it never fizzes.
- **Primed TNT.** `tickTnt(..., { rain, fizz, random })` gives moveEntity a `wet` getter: floor(posY) and floor(posY + 0.98), where posY = box bottom + 0.49. A wet TNT takes no ++fire in fire. A burning TNT fizzes and rests at -1, so the flames go out.
  - The fizz is played at the feet (playSoundAtEntity uses posY - yOffset, bytecode-read `ahb.a(sa, String, F, F)`). Its two draws come from `random`, or Math.random when there is none; port TNT has no Entity.rand.
  - `entity-simulation.js` `tickOneTnt`/`tickPrimedTnt` take `rain`/`fizz`, and the walker reads `hooks.tntRain`/`hooks.tntFizz`.
  - The client TNT copy (`object-tracker.js`) gets `tracker.hooks.rained`, so its flames go out in the rain. It makes no sound, because RenderGlobal.playSound is empty (bytecode-read `bma`).
- **Dropped items.** `ItemEntities.rain`: moveEntity's `wet` is a getter, `entityWet(inWater, rain, x, y + 0.125, z, 0.25)` after the move. This covers piston pushes too. A burning item fizzes out in the rain.
- **Minecarts (server and integrated side).** The counter already existed: `Minecarts.move` runs blockCollisions, so a fire or lava cell does ++fire with 160 at 0, and it rests at -1 otherwise.
  - xl.h never calls onEntityUpdate, so nothing counts it down, water never clears it, and flag 0 is never set. No client draws flames, so no overlay rows were added.
  - New: `wet` reads `host.rain` (rain only; inWater stays false since xl.h never runs handleWaterMovement). A burning cart in the rain fizzes from `cart.random` through `host.sound(name, cart, volume, pitch)` and rests at -1.
  - The server's cartHost sends the sound as S29 with its volume and pitch. Its `rain` is false for the Nether/End instances, whose host inherits the Overworld's weather.
- **Endermen.** `enderman-live.js` tested `isRaining && canSeeSky` at the feet and head cells. It now uses `mobs.wet(e, ENDERMAN_HEIGHT)`, which is canLightningStrikeAt.
  - The old test was wrong under glass or leaves, which let the sky through for canSeeSky but sit above the precipitation height. It was also wrong in deserts and snowy biomes.
- **Wolves.** wv.h tests isWet, not inWater. A live wolf in the rain (`entities.js` wolfUpdate) and a wolf copy (`copy-status.js` `copyWolfShake(..., rained)` with `clientRained`) stay wet, and their shake stops.
- **Ghasts and squid.** Their moveEntity hooks were `wet: false, fizz() {}`. They now use the shared `m.moveHooks(e, t)` (isWet with rain, the fizz).
- **Wiring.**
  - main.js: hoisted `rainAt` (canLightningStrikeAt of the current world and weather) for `items.rain`, `tntRain`/`tntFizz`, `rocketHooks.rain`, `cartHost.rain` and `objectTracker.hooks.rained` (none in the Nether/End). cartHost.sound takes volume and pitch.
  - The away run: `items.rain`, `xp.wet` (orbs had no rain test there), `cartHost.rain`, `tntRain` and `rocketHooks: () => ({ rain })`. It makes no sounds.
  - The dedicated server:
    - `simulation.js`: `items.rain` for the Overworld's items
    - `server-items.js`: `xp.wet`
    - `server-dispense.js`: `rainAt` (Overworld lane only), `arrows.wet`, TNT `rain`/`fizz` (dispFx sound) and rocket `rain`
    - `server-vehicles.js`: cart `rain` and the fizz volume and pitch

## Evidence
- Bytecode-read (javap -c -p on the 1.7.10 jar):
  - `sa.L`: inWater || ahb.y(floor posX, floor posY, floor posZ) || ahb.y(floor posX, floor(posY + height), floor posZ).
  - The callers of `L()Z` in the whole jar are sa.d (moveEntity's fire tail), sv.C (alive && isWet -> extinguish), wr.e (snow golem), wv.h (wolf), xx.e (blaze), ya.e (enderman, twice) and zc.h (arrow). Thrown balls, eyes of ender and fireballs never reach it.
  - The callers of moveEntity are xk (item), sq (orb), xw (TNT), zf (rocket), xl (cart), xi (boat), xj (falling block), xe (fish hook) and the living classes.
  - sa.d's tail: `if (wet && fire > 0) { playSound("random.fizz", 0.7F, 1.6F + (rand.nextFloat() - rand.nextFloat()) * 0.4F); fire = -fireResistance; }`
  - xl.h calls neither sa.C nor setFlag. Its moveEntity calls are in a(IIIDDLaji;I) and b(D).
  - `ahb.a(sa, String, F, F)` plays at posY - yOffset.
  - `bma.a(String, DDDFF)` (RenderGlobal.playSound) is an empty method.
- Port-read: posY/yOffset of each port entity: items y + 0.125, TNT y + 0.49, carts `posY`, rockets and arrows at y.
- No new executed probe.

## Verification
- `node --test src/rain83-b83.test.js`: 7/7 pass.
- Neighbour run, the 133 test files that import a changed module or source-match it (`node --test --test-timeout=600000 --test-concurrency=3 ...`): 1644/1644 pass.
- 13 multiplayer files on dispense, items, vehicles, explosions, copies and the b81/b82 server tracks (`--test-concurrency=2`): 123/123 pass.
- No old test encoded the gaps, so none needed changing. The full `npm test` was not run.
- `npm run build`: passes; the only warning is the usual chunk-size one.

## Follow-ups
- Browser-only checks:
  - a burning primed TNT or rocket going out with the fizz when rain starts (single player and a multiplayer client)
  - an enderman under a glass roof in the rain no longer teleporting
  - a wolf in the rain not shaking until the rain ends
- Not modelled:
  - rain for boats (xi: `wet` is the boat's inWater, and there is no fizz)
  - rain for the fish hook and falling blocks
- Found, not changed: the item and orb fizz and lava sounds are pushed at posY (y + 0.125, `o.posY`). Natively playSoundAtEntity plays them at posY - yOffset, the feet.
- An executed probe of TNT or a cart burning in rain would turn the counter parts into executed facts.
