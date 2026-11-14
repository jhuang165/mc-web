# Batch 67 sieges: VillageSiege, legacy reputation, Nether and End villages

## Summary
- `src/village-siege.js` (new): `VillageSiege`, a port of 1.7.10 `wb`. State machine (-1 start, 0 day, 1 siege, 2 none), the 0.5..0.501 celestial-angle window with the `nextInt(10) == 0` roll, the village pick (nearest village of each player's block with +1 range, >= 10 doors, door added >= 20 ticks ago, >= 20 villagers), 10 ring tries outside other villages, and the 10-try spawn-spot search, with every World.rand draw in the original order.
- It never spawns a zombie, because the original never does (see Evidence). No zombie code was written.
- `src/village-host.js`: `createSiege(ew)`.
- `src/entities.js`: `EntityWorld.siege`, `siegeTime()`, `siegePlayers()`, and one call after `this.villages.tick()` in `tickMobs` (single player and the server's EntityWorld both run it).
- `src/multiplayer/server-villagers.js`: `siegePlayers` (all views' positions), `siegeTime` (server clock), `mapLegacyReputation`, `loadVillages(..., legacyOwner)`. `simulation.js`: passes `legacyOwner` (one line).
- `tools/probes/SiegeProbe.java`, `tools/verify-siege.mjs`, `public/research/siege-reference.json` (45 records), `src/sieges-b67.test.js` (8 tests).

## Evidence
- Executed: the unchanged `wb` ticked on the VillageLiveProbe world double (scripted daytime and celestial angle, a logging Random, allocated players, real `vz`/`vy`/`wc`). 11 condition variants, 30 day/night cycles over seeds, 4 overlap layouts. Zero zombies spawned in all of them; state, timers and every draw hash replay in JS.
- Bytecode-read: `wb.a(III)` ends its loop body with `Vec3.createVectorHelper(...)` followed by `pop` and has no `areturn` except `aconst_null` after the loop, so it always returns null. `wb.b()` then never sets `setUp`, `wb.c()` (the zombie spawn, `onSpawnWithEgg`, `setHomeArea`) and the 20-zombie, 2-tick loop are unreachable. This is the 1.7.10 behaviour (a later version returns the vector). The brief's "port the zombie spawn" is therefore closed as "native never reaches it", not as missing. State -1 (new world or a world opened at night) runs the village search every tick until day, which is reproduced (32 draws per tick per qualifying player).
- Bytecode-read (`ahb`, `mm`, `MinecraftServer`): every world loads the key `villages` from its own MapStorage (no `_nether`/`_end` suffix exists in 1.7.10). `mm` (WorldServerMulti) then replaces its MapStorage `z` with the Overworld's, after its constructor already loaded a private copy of `data/villages.dat`. Only the Overworld's collection is registered in the shared storage, so Nether and End collections are never saved. That copy holds Overworld doors, which are no doors in those dimensions and die on the first village tick.
- Bytecode-read: `Village.playerReputation` (`vz.j`) is a TreeMap keyed by the player name.
- Recalled: WorldProviderHell's celestial angle is 0.5 and the End's 0.0; the port takes the dimension's day flag from the host and was not checked in those dimensions (no villages there).

## Verification
- `node tools/verify-siege.mjs` (one JVM): 45 records.
- `node --test` one at a time: sieges-b67 8/8, mpvillage-b66 9/9, village 5/5, village-live 8/8, mptrade-b66 9/9, village-fight 4/4, village-ai 2/2, village-reputation 2/2, mpmobs-b59 10/10.
- `node --check` on every touched source file. Full npm test not run (batch rule).

## Item 2: legacy "Player" reputation
- Single player keeps one fixed name (`PLAYER_NAME`), so a village saved there holds reputation under "Player". With the server option `legacyOwner` (the same one that names the owner of untagged wolves) the key is renamed to that name at load (summed and clamped to -30..10 if the name already has a score). Without it the key stays and only a player named "Player" would use it. No guess of "first player who joins" was made, because reputation (unlike a wolf's owner) should not go to a stranger.

## Item 3: Nether and End collections
- Gap found wrong: 1.7.10 has no per-dimension file. Nothing to save; the current behaviour (each dimension's EntityWorld has its own empty, unsaved collection) matches the visible native result. No code change.

## Follow-ups
- Browser-only: nothing visible changes (no zombies, no UI).
- A modded or later-version siege (zombies from a returned vector) is deliberately not built.
- The siege check at night uses `ew.worldRandom`, so a night with a horizon roll draws one extra number from it; no test depended on that.
