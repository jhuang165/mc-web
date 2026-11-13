# Batch 62 mpprojectiles: one server projectile system

## Summary
- `src/multiplayer/server-dispense.js`: batch 61's dispenser projectile code is now a lane system. The Overworld lane is the class itself; the Nether lane comes from `laneFor(1)` and ticks inside `dimensions.swap`. Arrows, balls and potions hit mobs and players (Creative players are immune). Hits go through `sim.damagePlayer`, with knockback, Punch, flame, a stuck-arrow count and the shooter named in the death message. Each kill runs under `achievements.attacker`, so `killEnemy` and `snipeSkeleton` work. Pearls teleport the thrower and deal 5 fall damage. Players pick up arrows (pickup 1). In-flight arrows and balls are saved and loaded. Every send is filtered by `p.dimension`.
- `src/multiplayer/server-projectiles.js` (new): `ServerProjectiles` adds the shooters. Skeletons use `Arrows.skeletonShoot`. Witches use `WitchPotions.throwAt`, flying in the lane. Players: `shootBow` (C07 release, `releaseBow`) and `throwHeld` (snowball, egg, ender pearl, splash potion, XP bottle).
- `src/multiplayer/simulation.js`: short hooks. It builds `ServerProjectiles`, calls `shootBow` on release, calls `throwHeld` from `edit` when no block was used, and saves `projectiles`.
- `src/multiplayer/client.js`, `client-dispense.js`: new wire message `projCollect` (arrows or balls taken, with who took them). `random.pop` is allowed. The pearl poof uses a seeded random.
- `src/bow.js`: three small edits. The owner is skipped as thrower, `ctx.hitPlayer` is tried first, and knockback comes from the owner.
- `src/mpdispense-b61.test.js`: the default test player now stands at x 70.5, out of the dispenser's line of fire.
- `src/main.js` and `server/server.js`: not edited. The server already forwards every `dispOut` message.

## Evidence
- Executed: `src/mpprojectiles-b62.test.js` covers dispenser arrow on survival and Creative players, snipeSkeleton at 60 blocks (and none at 10), skeleton shot, witch potion, bow draw and release, snowball and pearl throw (teleport, 5 damage), splash potion and XP bottle, arrow pickup with `projCollect` and the pop sound, save and load, and the dimension filter.
- Bytecode-read: the snipeSkeleton rule (50 blocks, arrow kill), from the batch 61 mpmobtypes note.
- Recalled, not verified: a 0-damage snowball does nothing to a player; a C08 click on an unused block falls through to `onItemRightClick`; the bow sound plays on both sides natively (here the server sends it to everyone near).

## Verification
- `node --test src/mpprojectiles-b62.test.js`: 10 pass, 0 fail.
- `node --test` on 32 related files (multiplayer, mp*, bow, projectiles, dispense, witch-potions, away-dispense-b51): 381 pass, 0 fail.
- `node --check` on every touched source file: clean.
- `npm run build`: built.
- Full npm test not run (batch rule). No browser check; a browser would show the arrow flight, bow draw look and pickup feel.

## Follow-ups
- No client bow-draw animation or FOV change (the client never sets `eating.bow` in multiplayer).
- `main.js` has no `collect` hook, so no S0D flight animation for `projCollect`.
- A player's potion kill has no `source.player`, so no kill credit.
- Primed TNT, rockets and fireballs are not saved. Fireballs (`mobs.fireballs`, mpnether2) still ride `snapshot`.
- Drinkable potions on the server were not checked. No PvP config or player melee.
- Nether dispensers are not supported.
- Merge risks: `simulation.js` and `client.js` hooks; `server-dispense.js` was heavily rewritten, so mpnether2's fireball edits in `snapshot` may conflict.
