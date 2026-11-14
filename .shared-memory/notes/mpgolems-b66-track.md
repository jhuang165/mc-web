# Batch 66 mpgolems: player-built golems and silverfish on the dedicated server

## Summary
- `src/multiplayer/server-golems.js` (new): `GOLEM_KINDS` (iron_golem, snow_golem, silverfish) join `SUPPORTED`; `ServerGolems.afterPlace` calls single player's `EntityWorld.tryBuildGolem` for a placed pumpkin or jack-o'-lantern (snow first, then the iron T, player-created flag set); `release` is the monster egg's silverfish; `installServerGolems(sm, limit)` wraps `spawnSilverfishAt` (cap is MOB_LIMIT, not 40; sends a `spawnerPuff` dispFx), `silverfishThink` (puff where a fish hides in stone) and `golemTailTick` (S19 status 4 / 11 when the AI set the iron golem's counters).
- `src/multiplayer/client-golems.js` (new) + two lines in `remote-mobs.js`: status 4 sets `attackTimer = 10` and plays `mob.irongolem.throw`; status 11 sets `holdRose = 400`; both count down each client tick (the renderer reads them).
- Hooks: `simulation.js` (construct `this.golems`; keep placeHeldBlock's result and call `afterPlace`; `releaseSilverfish` passed to both breakPlayerBlock calls), `server-mobs.js` (import, SUPPORTED, install, the tick cap keeps golems like the wither), `server-dispense.js` (the snow golem's balls in `snapshot` and `any`).
- Test: `src/mpgolems-b66.test.js` (13 tests). No new wire messages (existing `mobStatus`, `dispEnts`, `dispFx` `spawnerPuff`).
- Everything else (snow trail, melting, rain damage, snowballs, iron golem attack 7 + rand(15), the 0.4 lift, poppy offer, drops, village reputation, silverfish AI, call friends, hide in stone) already ran in `EntityWorld`; the server now only keeps these kinds and sends the clients what they draw.

## Evidence
- Bytecode-read (javap, 1.7.10 jar): BlockPumpkin.onBlockAdded (amw.b) clears cells with setBlock flag 2 (no block-break effect), spawns inside `!isRemote`, then 120 `snowshovel` (snow) or `snowballpoof` (iron) `spawnParticle` calls; `WorldManager.spawnParticle` (mp.a, 6 doubles) is a bare `return`. So a dedicated server sends no particles and no aux 2001 for the removed blocks. The brief's expectation (snowshovel / aux 2001) is wrong; nothing is sent, and single player does not draw them either.
- Bytecode-read: EntityIronGolem (wt) `a(byte)`: 4 -> attackTimer 10 + throw sound, 11 -> holdRoseTick 400; `a(boolean)` sets 400 or 0 and always sends state 11 (a copy raises its arm even when the server ended the offer; the port sends 11 on any server-side set, so it matches).
- Bytecode-read: BlockSilverfish (amb) `b` (destroyed by player) and `a(..float,int)` (dropBlockAsItemWithChance) each spawn a silverfish at (x+0.5, y, z+0.5) then call `yk.s()` (status 20 puff). Sent as `spawnerPuff` (the same client path as spawner puffs).
- Recalled / not rechecked: explosions drop a monster egg via dropBlockAsItemWithChance and so release a silverfish (the server's `explodeBlocks` does not call it; see follow-ups).
- Executed: none new (no new Java probe); existing single-player references (village-live, mooshroom-golem, silverfish) cover the rules.

## Verification
- `node --check` on every touched file.
- `node --test src/mpgolems-b66.test.js`: 13 pass. `iron-golem.test.js` 12, `silverfish.test.js` 75, `mooshroom-golem.test.js` 9, `mpwither-b63.test.js` 12, `mpwither-b64.test.js` 7, `mpdispense-b61.test.js` 15, `mpmobs2-b60.test.js` 7: all pass.
- Full npm test not run (batch rule). No browser checks (batch rule): the golem arm swing, the snowball model and the silverfish puff were not looked at.

## Follow-ups
- A snowball hitting a player (knockback, no damage) is not done; the server's thrown balls do not hit players either.
- Monster eggs blown up by TNT / creeper release no silverfish on the server (and single player likewise).
- Strongholds' monster eggs: only if the server terrain uses stronghold-generator.js; not checked.
- Village golem spawns and the golem's village reputation hit (`source.playerName`) belong to mpvillage.
- The iron golem's walking dust (golemTail blockParticle) is not drawn on copies.
