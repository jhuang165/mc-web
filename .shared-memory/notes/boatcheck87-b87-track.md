# boatcheck87 (batch 87): ItemBoat.onItemRightClick entity checks

## Summary
- New `src/boat-place-entities.js` builds the boat-check rows `{ bb, collide, border, listed }` for every entity kind. It covers players, mobs (dying ones until death tick 20), ender crystals ([posY-1, posY+1]), the dragon body (not collidable) and its parts (collidable), leash knots, items, orbs, arrows, thrown balls / potions / golem snowballs, fireballs (large: collidable, border 1) and wither skulls, falling blocks, primed TNT, rockets, eyes, hooks, boats / carts and hanging entities. Dead and frozen entries are skipped.
- `Boats.place` (`src/boats.js`) now honours `collide: false`, which skips a row in the sight test only. It also honours `border` (default 0.1) and `listed(area)`, which gates the dragon body and parts on the body being listed. `listed` is checked against the look box for the sight test and against the shrunk box grown by 0.25 for the box test. Old `{ bb }` rows and raw boxes work as before.
- Server (`src/multiplayer/server-vehicles.js` `useHeld` / `boatEntities`): the sight and box lists now hold every kind from this dimension's host lists, the same lists `server-mobs.js` explode reads. Before, they held only living mobs with health > 0, vehicles and players. A lying player uses the 0.2 box (`boatPlayerBox`). `playerBox` itself is unchanged.
- Single player (`src/main.js` placeBoat): uses `boatPlaceEntities` over the same lists as the explosion state. Before, it used only living mobs and vehicles.
- Client (`src/client-item-use.js`):
  - `clientBoatFits` now runs the sight test through `Boats.place`, so it tests the mutated trace start, not the eye. predict86's own loop used `ray.eye`.
  - `clientEntityBoxes` gains `hooks` (0.25 from posY, not collidable) and `falling` (0.98 from the box bottom, collidable).
  - It also gains dragon parts from `mob.dragon.parts` (collidable) with the body not collidable, both gated by `dragonListed`, and the crystal box [y-1, y+1] (was the feet-based mob box).
  - main.js passes `hooks: remoteFishing?.rows`.
- Old test updated: `src/predict86-b86.test.js` "boat sight check". Its "round" box sat near the eye (14.6), which encoded the eye-start gap. It now asserts that box no longer refuses, and its round/far boxes sit below the real start (y 12). The clientEntityBoxes row-order test there is unchanged and passes.

## Evidence
- **Executed:** `tools/probes/BoatEntityProbe.java` drives `tools/verify-boat-entities.mjs`, which writes `public/research/boat-entity-reference.json` (60 records, unchanged native classes on the BoatProbe map world).
  - Each kind is built with its native client constructor: xk, sq, zc, zj, zd, xe, zg, zi, zp, xj, xw, wz, xi, xm and su.
  - Each record gives R(), af(), yOffset, size, posY and box, then the ItemBoat count and boat. Four positions are tried per kind: at the trace start, inside the shrunk boat box, a 1.0 border away, and clear. Two more records cover the player's own box and no entity.
- **Executed results:**
  - Items, orbs, arrows, snowballs, eyes, hooks, small fireballs and skulls refuse only by the box test.
  - Large fireballs refuse with border 1.
  - Falling blocks, TNT, crystals, boats, carts and knots refuse by sight too.
  - The player's own box refuses.
  - Crystal yOffset is 1. Falling block and TNT yOffset is 0.49, orb 0.25, item 0.125, cart 0.35, boat 0.3.
- **Bytecode-read:**
  - `ahb.a(azw,azw,Z,Z,Z)` mutates the start vector.
  - `abj.a`: sight via ahb.b(player, box.addCoord(look*5).expand(1)), R(), af(), then azt.a(azw). Box test via ahb.a(boat, box.expand(-0.1)).
  - `ahb.a(sa,azt)` adds J() and xi.h(sa) = other.C.
  - `apx.a`: parts are listed only with the body.
  - R() and af() per class as listed in the module header. Dragon wy parts: true. xa: false.
- **Port-read:** the y convention of each port list (item / orb / falling / TNT rows hold the box bottom; arrows, balls, eyes and hooks hold posY; crystal mobs hold posY; the remote hook rows hold posY).

## Verification
- `node --test --test-timeout=600000 src/boatcheck87-b87.test.js`: 126 pass, 0 fail.
- `node --test --test-timeout=600000 --test-concurrency=2 src/predict86-b86.test.js src/mppredict85-b85.test.js src/boats.test.js src/vehicles4-b58.test.js src/boat-ride-b56.test.js src/boat-copy-b54.test.js src/ride-copy-b51.test.js src/player-edit-simulation.test.js src/skins73-b73.test.js`: 219 pass, 0 fail.
- `node --test --test-timeout=600000 --test-concurrency=2 src/movement-stat.test.js src/mpreach71-b71.test.js src/rain83-b83.test.js src/tracker83-b83.test.js src/mppaintings-b68.test.js`: 57 pass, 0 fail.
- `npm run build`: ok.
- The full `npm test` was not run, per the track rules.

## Follow-ups
- The server's boat ray still uses `Math.sin` / `Math.cos` of the port rotation and eye `pos.y + PHYSICS.eye`. ItemBoat uses MathHelper sin/cos of the float rotation. The client uses `boatRay`.
- Dead players: native sets isDead at death tick 20. The server lists every other player of the dimension with no death test.
- The multiplayer client has no falling block copies (the server sends no falling rows), so `clientEntityBoxes({ falling })` has no caller yet.
- Other port code may still use a feet-based crystal box, for example `placement-entities.js` / `dragon-mobs.js` boxOf ([y, y+2]). Not checked here.
- Chunk-section gating (`apx.a` ±2 sections) applies only to the dragon. Small entities that meet the query are always within range.
- Browser-only: a multiplayer boat refused by a floating item, a hook or a dragon part, and the client's stack staying put until the server's S2F.
