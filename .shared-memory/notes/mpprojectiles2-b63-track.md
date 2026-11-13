# Batch 63 mpprojectiles2: client bow draw, arrow fly-in, potion credit, saved TNT/rockets/fireballs, drinking

## Summary
- `src/main.js`: a connected client starts its own bow draw (`eating = { id: BOW, ticks: 0, bow: true }`) when it sends C08 use with a bow and an arrow (or Creative). The existing first-person pose and FOV easing then work from that state. On release the client no longer calls `releaseBowUse` in multiplayer (it would have fired a local arrow); the server shoots. `projCollect` now flies an arrow-item pile to the collector through the new `collect` hook. New small module-level `mpPlayerRows` holds the last player rows so another player's pickup can fly to them. Imports `BOW`, `canDraw` from `bow.js`.
- `src/drop-renderer.js`: `flyIn(item, target)` builds a pile for a stack that was never a drop and flies it (EntityPickupFX path, same as `pickup`).
- `src/multiplayer/client-dispense.js`, `server-dispense.js`: `projCollect.taken` rows now carry `x, y, z` (the arrow's place; its row is already gone from `dispEnts` when the message arrives). The hook is `collect(i, by, at)`; `at` is null for an old message.
- `src/witch-potions.js`: `impact(ball, player, survival, thrower)`. A potion with owner `"player"` (or a given `thrower`) now hits mobs with `player: true` (so `recentlyHit = 100`: loot and kill XP), `playerName`, and a knockback origin at the thrower when known. This also fixes single player (its player potions had no `player` flag). `server-dispense.js` passes the thrower; the kill runs under `credit(owner)` as before, so achievements follow.
- `src/multiplayer/simulation.js`, `server-survival.js`: drinkable potions (ItemPotion, `EnumAction.drink`). `handleUse` starts a 32-tick use for a non-splash potion (Creative too); `tickUse` plays `random.drink` like milk and no burp; `finishDrinking` runs `finishPotion` (effects, glass bottle back, Creative keeps the stack) before the milk path.
- `src/multiplayer/server-dispense.js`: save and load of primed TNT, rockets and fireballs (`lanes[dim].tnt / rockets / fireballs`, per instance, so the Nether instance saves its own; a stand-in lane keeps and re-saves them until `adopt`). Fireballs are restored on the first tick, after the mobs exist.
- Bug found and fixed on the way: `ServerDispense.load` ran inside the `DedicatedSimulation` constructor, where `sim.mobs` is not built, and `potionsOf` read it. A world saved with a potion in flight would have thrown on start. Saved potions of the Overworld lane now wait in `pendingPotions` until the first tick.
- New wire fields only (no new messages): `projCollect.taken[].x/y/z`.

## Evidence
- Bytecode-read (`javap` on the unchanged jar): `xw` (EntityTNTPrimed) writes only `Fuse` as a byte (plus Entity's Pos/Motion/Rotation); `ze` (EntityFireball) writes `xTile`, `yTile`, `zTile` (short), `inTile`, `inGround` (byte) and `direction` (list of the motion); `zg` (EntityLargeFireball) adds `ExplosionPower`; `zf` is EntityFireworkRocket (Life, LifeTime, FireworksItem). No shooter and no placer is written, so a reloaded TNT has no placer and a fireball no owner (the record format used here keeps an owner id for mobs only when it can be found again).
- Executed (node): `src/mpprojectiles2-b63.test.js` (7 tests): a player's potion kill sets `recentlyHit`, the single-player owner token does too, a drink takes 32 ticks, applies the effect, returns the bottle and Creative keeps the potion, a splash potion is thrown and not drunk, `projCollect` carries a place and the hook receives it, TNT/rocket/fireball save and restore, a saved potion loads at construction.
- Recalled, not verified: the pickup fly-in draws an arrow item sprite, where native draws the arrow entity model (RenderArrow); ItemPotion.onEaten adds the glass bottle by `addItemStackToInventory` without dropping when full (this code's `finishPotion` already does that).
- No executed Java probe was added for this track: the changes reuse rules already replayed (potion splash, fireballs, rockets).

## Verification
- `node --check` on every touched source file: clean. Scope check: `BOW`, `canDraw`, `ARROW` imported in `main.js`; `mpPlayerRows`, `scene`, `position`, `multiplayer`, `eating`, `heldId`, `survival` are module-scope there.
- `node --test src/mpprojectiles2-b63.test.js`: 7 pass, 0 fail.
- `node --test` on 49 related files (mpprojectiles, b62-lead, mpdispense, mpnether2, witch, potion, fireworks, dispense, mphealth, mpmobs2, mpsurvival, fireball, blaze, explosion, tnt, vehicle and riding tests): 380 pass, 0 fail.
- `npm run build`: built.
- Full npm test not run (batch rule). No browser check: a browser would show the bow's draw tilt, the FOV narrowing while connected, and the fly-in look.

## Follow-ups
- PvP: arrow and potion damage between players goes through `sim.damagePlayer` with no PvP check. The `mppvp` track should add a single check there (one `if (!pvpAllowed(shooter, victim))` in `hitPlayer` and `splashPlayers` in `server-dispense.js`); not touched here to avoid a conflict.
- A connected client does not animate eating or drinking locally (only the server's sounds and effects); only the bow is predicted.
- The fly-in uses an arrow item sprite, not the arrow model.
- A fireball's owner is lost across a save (as natively); a punched ball's `punchedBy` is not saved.
- Merge risks: `server-dispense.js` (`save`, `load`, `tick`, `adopt`) and `simulation.js` `handleUse` / `tickUse`; `main.js` hooks are one-liners near `makeRemoteDispense`, the player-rows handler and the C08 edit line.
