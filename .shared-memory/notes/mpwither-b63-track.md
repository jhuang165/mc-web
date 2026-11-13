# Batch 63 mpwither: the wither boss on the dedicated server

## Summary
Single player's wither (wither-boss-mobs.js) already runs inside the `EntityWorld` the server uses for its mobs, so most of the port is wiring.
- `src/multiplayer/server-wither.js` (new): `ServerWither` (placement hooks and spawn for the server skull click, `spawnWither` award), `installServerWither` (skulls aim their sweep at the player nearest to them; `killWither` on a wither's death), `playersAround` (strict box test), `boundedSkullResistance` (blue skull block resistance).
- `src/multiplayer/server-mobs.js`: `SUPPORTED` has `wither`; `mobState` carries the side heads' angles (`hy`, `hpi`); the mob drain now also sends the client burst (`dispFx explode`) for every mob explosion (creeper blasts had none), passes `blue` to the block resistance, handles `blockEdit` as aux 2001 break particles, and sends an event's `aux` as a broadcast S28 to every player (the wither spawn 1013). The `MOB_LIMIT` trim never cuts a wither.
- `src/multiplayer/simulation.js`: `this.wither`, and the skull placement passes soul sand and the world difficulty (Overworld players only; a Nether player still gets difficulty 0).
- `src/multiplayer/server-dispense.js`, `client-dispense.js`: wither skulls ride `dispEnts` (kind `witherSkull`, `blue`, `vx vy vz`); the client row keeps them so projectile-renderer draws the right skin and turns the cube to the flight.
- `src/multiplayer/remote-mobs.js`: a wither copy takes Invul and health from its client entity (S0F/S1C meta already sent by copy-meta.js), its body yaw, and the side heads' angles. The boss bar needs no hook: `animateWither` calls `setBossStatus` from the copy's health when it draws it.
- `src/multiplayer/client-containers.js` + one option in `src/main.js` onAux: level event 1013 plays `mob.wither.spawn` two blocks from the listener towards the origin.
- `src/wither-boss-mobs.js`: the 1013 event also carries `aux`, the block break event carries `meta` (single player ignores both).
- Test: `src/mpwither-b63.test.js` (12 tests). No new wire message names: S28 `aux` id 1013, `dispFx explode`, `dispEnts`, S0F/S1C meta and `state` fields are existing ones.
- Boss bar: stays generic (`src/boss-bar.js`, `setBossStatus(entity, name)`); the dragon copy can feed it the same way (health from S1C meta onto the stand-in).

## Evidence
- Bytecode-read (javap, jar classes `anl` BlockSkull, `xc` EntityWither): the T builds with `getEntitiesWithinAABB(EntityPlayer, wither box expanded (50, 50, 50))` and gives each player achievement `pc.I`; `xc.b(boolean, int)` (dropFewItems) drops one nether star and gives `pc.J` to every player in the box expanded (50, 100, 50), not only the killer. The port follows this (in single player `achievements-live` still needs a player kill; there is only one player).
- Recalled, not verified: `pc.I` is spawnWither and `pc.J` killWither; level event 1013 goes to every player of the server (sendPacketToAllPlayers); wither tracker range 80 is already in `ring-events.js`.
- Executed (node tests, `mpwither-b63.test.js`): the built T on a server player's click, Peaceful and Nether refusal, achievement ranges, S0F/S1C copy values, the spawn blast (blocks, damage, broadcast aux, burst), skull flight and hit on a server player, the wither firing at a player, death (nether star, killWither), dimension filter of the snapshot, the MOB_LIMIT trim.

## Verification
- `node --test src/mpwither-b63.test.js`: 12 pass.
- `node --test src/mpmobtypes-b61.test.js src/mpmobs-b59.test.js src/mpmobs2-b60.test.js src/mpprojectiles-b62.test.js src/mpnether2-b62.test.js`: 44 pass, 0 fail.
- `node --test src/mpdispense-b61.test.js src/b62-lead.test.js src/wither-boss.test.js src/wither-targets.test.js src/mpcommands2-b60.test.js src/mpsmall2-b62.test.js`: 71 pass, 0 fail.
- `node --check` on every touched JS file: clean. `npm run build`: succeeded (chunk size warning only).
- Full npm test not run (batch rule).
- Only a browser could show: the wither model and boss bar on a client, the blue skull skin and its turning, the 1013 sound, the explosion look, side heads following their targets.

## Follow-ups
- Heads and targets: the server wither's AI sees only the player nearest to it (`ai.player`), so the three heads pick targets among that player and the mobs, not all players.
- Side head angles are sent as `state` fields rounded to half degrees (natively watchers 17 to 19 carry target ids), so heads move in 0.5 degree steps and each change is a state packet.
- A Nether wither: the T is refused for Nether players (skull store is not the dimension's); the Nether instances do aim skulls, but nothing builds one there.
- Wither effect and its icon on the player (S1D) are not sent; the effect is applied to the player's server Survival only. Wither skulls are not saved across a restart (like fireballs).
- The 1012 (block break sound) and 1014 (shoot) level events travel as S29 sounds, not S28 (range 32 instead of 64).
- `explodeInline` (walked entities) does not send the burst; the server never walks skulls, so it is unused.
