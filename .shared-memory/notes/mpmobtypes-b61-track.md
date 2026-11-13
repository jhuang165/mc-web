# Batch 61 mpmobtypes: more server mob kinds, one shared tracker entry per mob

## Summary
- `src/multiplayer/server-mobs.js`: `SUPPORTED` (still a plain Set) now also lists enderman, slime, witch, cave_spider, squid, bat, wolf, ocelot, horse, mooshroom. `mobState` carries the per-kind fields the renderer reads: zombie villager, enderman carried block and screaming, slime size, witch held item, wolf owner/angry/sitting/collar/health, ocelot cat type and pose, horse type/variant/armor/saddle/chest, bat hanging. The server now uses `SharedMobTracker` and delivers packets per watcher.
- `src/multiplayer/server-mob-entries.js` (new): `SharedEntry` and `SharedMobTracker`. One entry per mob, so one `ticks` counter (native `EntityTrackerEntry` has one). Each entry has a watcher set. Each packet records its recipients when emitted. A joining watcher gets the spawn through `startPackets()`.
- `src/entity-tracker.js`: the start branch of `tryStart()` moved into `startPackets()`. Single-player behaviour is unchanged.
- `src/multiplayer/remote-mobs.js`: applies the new fields to stand-in mobs, forwards spider-jockey attach, runs the slime squish.
- Tests: `src/mpmobtypes-b61.test.js` (new, 10 tests); `src/mpmobs-b59.test.js` uses `SUPPORTED` instead of a pinned list.
- No new wire messages. No `main.js`, `simulation.js`, `client.js` or `server.js` edits.

## Evidence
- Bytecode-read (jar classes `sv`, `yz`, `yl`, `pc`): killEnemy is awarded by `yz.a` to the source entity of the killing blow for IMob victims. snipeSkeleton comes from `yl.a` when an arrow's shooter is a player at horizontal distance squared >= 2500. `recentlyHit` and `attackingPlayer` only drive loot, xp and score.
- So the listed gap "delayed kills (fire, poison, fall after a hit) credit killEnemy" is wrong for 1.7.10. The existing 100-tick `attacker` design is right. Test pins it: a delayed fire kill awards nothing, a killing blow awards the attacker.
- Executed (node tests): shared entry, shared `ticks`, late-join spawn, per-watcher range, slime split children, jockey attach, new kinds get client copies.
- Recalled: renderer field names were read from `mob-renderer.js`, not re-probed.

## Verification
- See the commands below. Full npm test not run (batch rule). No browser check; only a browser could show the new mobs rendering and sounding right on a client.

## Follow-ups
- Skeleton arrows and witch potions are not real server projectiles. The server `EntityWorld` sets neither `mobs.shoot` nor `mobs.potions`. Skeletons do not shoot and witches do not throw on the server. Needs a server `Arrows`/`WitchPotions` path, a `mob`-prefixed wire message and client rendering.
- snipeSkeleton cannot fire on the server until server arrows exist.
- Spider jockey needs a rider path; attach is forwarded but riding is mpvehicles' area.
- Not added: zombie villager conversion and baby zombie checks beyond the `villager` flag; leash attach is skipped.
- `server-mobs.js` header comment still says "own MobTracker".
- Merge: mpanimals should union its kinds into `SUPPORTED`. `track()` in `server-mobs.js` was rewritten, so expect conflicts there.

## Commands run
- `node --test` on mpmobtypes-b61, mpmobs-b59, mpmobs2-b60, mpcommands2-b60, trackeridle-b59, entity-tracker*, serverbroadcast-b58: 75 pass, 0 fail.
- `node --test` on every `src/mp*.test.js` and `src/multiplayer*.test.js`: 148 pass, 0 fail.
- `npm run build`: built.
- `node --check` on the four touched source files: clean.
