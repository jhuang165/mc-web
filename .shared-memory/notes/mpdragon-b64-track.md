# Batch 64 mpdragon: the Ender Dragon on the dedicated server's End

## Summary
- `src/multiplayer/server-dragon.js` (new): `DRAGON_KINDS` (joined into ServerMobs `SUPPORTED`), `installServerDragon` (the dragon reads every player of its world: `mobs.dragonViews`), `setupEnd` (crystals of the spikes inside the window and the dragon at the End's centre on a new End; fight centre and an exit-portal clamp inside the window), `dragonState` (`'alive'|'dead'`, saved as `dragon` in the End), `dragonReach` (C02 on a dragon is tested against its seven parts).
- `src/dragon.js`: `host.center` (default 0,0) for `setNewTarget`. `src/dragon-mobs.js`: host players, wing sweep, head hit and push use `mobs.dragonViews()` when set (single player unchanged), `portal` clamp hook, `spawnDragonIfAbsent(..., centre)`. `src/dimension-world.js`: `endCrystals/endCrystalSteps(r, within)` chunk window.
- `src/multiplayer/server-end.js`: the b63 stand-in exit portal and `DRAGON_ON_SERVER` are gone; `fillEnd` returns its generator; `setupEnd` after the build; `dragon` saved; `conquer` (theEnd2, `dragonCredits`, the player waits in the End) and `finishCredits`. An End saved by b63 (no `dragon` field) counts as over and keeps its portal.
- `src/multiplayer/server-dimensions.js`: the respawn wrapper answers a conquered player's C16 with the trip to the Overworld.
- `src/multiplayer/server-mobs.js`: imports, `SUPPORTED` additions, `installServerDragon`, the part-based reach in `attack`, `save()` also keeps a dying dragon.
- Client: `remote-mobs.js` (the stand-in uses the copy's dragon state so the renderer and the aim see the seven parts, health from S1C feeds the boss bar, no lying-down death roll, crystal spin), `client.js` (`dragonCredits` message, `onDragonCredits`), `main.js` (`multiplayerCredits`: credits screen, then `client.respawn()`).
- New wire message: `dragonCredits` (server to client, S2B state 4). The answer is the existing `respawn` (C16).
- Tests: `src/mpdragon-b64.test.js` (6); `mpend-b63.test.js` updated (portal built by hand, credits step, End mob kinds).

## Evidence
- Rules reused, executed earlier (dragon-reference.json, b49-b56 notes). New in this batch, tested only by node tests: spawn and crystals in the window, every-player targeting and push, part-based attack, death (orbs, portal and egg), save and restore, credits flow, copy aliasing.
- Recalled (not re-read from bytecode this batch): 1.7.10 shows the credits on every exit-portal trip (EntityPlayerMP.travelToDimension, dimension 1 to 1: theEnd2, S2B state 4, playerConqueredTheEnd, then C16 respawn). The "first trip only" rule is a later version, so every trip shows them, as single player does. The brief's "first trip" is therefore found wrong.
- Boss bar: no new code; `animateDragon` calls `setBossStatus` from the copy's health, the shared path.

## Verification
- `node --test src/mpdragon-b64.test.js`: 6 pass. `node --test src/mpend-b63.test.js src/b63-lead.test.js src/mpwither-b63.test.js`: 18 pass.
- `dragon` + `dragondeath-b56` + `dragon-sweep`: 18 pass; `dragon-world` + `dragon-client-b49` + `mpmobtypes-b61`: 22 pass. `npm run build` ok. Full npm test not run (batch rule). `node --check` ok on touched files.

## Follow-ups
- The End window is 128 x 128 (mpend2 may change it): pillars outside it have no crystal, so the dragon heals from fewer. The dragon flies outside the window (no collision) and dies anywhere; the portal is clamped inside it.
- Crystal explosions do not set fire (the mob explosion path ignores `flaming`). Dragon egg click-teleport is not on the server. No sounds for level event 1018 beyond the existing S29 sound; blocks the dragon breaks send no break particles.
- A conquered player waiting for the credits is not protected from End mobs. Dragon kills do not feed statistics or achievements.
- Only a browser could show: the dragon model and crystal beams on a multiplayer client, the boss bar, the credits screen and the swap back, the wing sweep push.
