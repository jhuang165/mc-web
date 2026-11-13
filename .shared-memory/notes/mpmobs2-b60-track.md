# Batch 60 mpmobs2: mob sounds, status effects, xp, knockback and one spawn pass in multiplayer

## Summary
- `src/multiplayer/server-mobs.js`:
  - Sounds: the mob events with a sound (living, hurt, death, step, fuse, blast) go to `host.soundsOut`, so `deliverSounds` sends S29 to players in range (16, or 16 * volume above 1), the hit player included.
  - Status: the clients' status sounds (`clientSounds`) are taken out before `drainMobEvents` and become wire packets `mobStatus` { i, status } (2 hurt, 3 death) for the players tracking the mob. `EntityWorld.mobStatus(e, 18)` (feeding) sends status 18 the same way.
  - XP: `spawnLoot` and `drainMobEvents` spawn the orbs of a kill into `serverItems.xp` (batch 59 orbs: tickFields, collect, S11 equivalents).
  - Knockback: `knock(p)` drains the server Survival's `knockQueue` into `p.velocity` before the next `movePlayer`.
  - Trackers: all per-player trackers start from the same `velocityChanged` / `airBorne` flags, cleared after the last. Destroy packets leave one tick after the rest (S13 is flushed by the player's next update).
  - Spawning: `spawnPass` runs `findChunksForSpawning` once per tick over `unionChunkOrder` (the HashMap order of all players' windows, table size kept), cap `max * size / 256`, "player within 24" from any player (eye height). The per-player spawner states are gone. `doMobSpawning` is honoured.
- `src/multiplayer/remote-mobs.js`: `RemoteMobs(world, fx)`; `mobStatus` packets play the hurt/death sound at the copy (pitch (r - r) * 0.2 + 1, getSoundVolume) and draw 7 heart/smoke particles on the copy's Random; the copy's death poof (death-fx.js `client.fx`) is passed to `fx.particle`. `isMobSound` filters the S29 names.
- `src/entities.js`: `hurtOf` and `deathOf` exported; one hook line `this.mobStatus?.(e, 18)` in `feed`.
- `src/multiplayer/simulation.js`: one line `this.mobs.knock(p)` before `movePlayer`. `src/main.js`: `isMobSound` in `onSound`, the `fx` object given to `RemoteMobs`.
- Wire: new packet type `mobStatus` inside the `mobs` message. No new top-level message; PROTOCOL not bumped (old clients ignore the unknown packet type: `RemoteMobs.apply` sends it to `ClientEntity.apply`; check at merge).
- `src/mpmobs2-b60.test.js`: 7 tests.

## Evidence
- Bytecode-read (javap aho = SpawnerAnimals, 1.7.10 jar): `a(mt, hostile, peaceful, animals)` clears one HashMap, fills it for every player in `mt.h` (inner chunk put false, edge chunk put true only if absent), then loops creature types ONCE with `count <= max * map.size() / 256`, iterating the key set in HashMap order (no shuffle), and `mt.a(x,y,z,24.0)` (getClosestPlayer) for "player nearby". So the gap was right: one pass for the union, cap by union size.
- Bytecode-read (earlier notes, batch 52): destroy packets are flushed by the player's next update, one tick after the other tracker packets. Used for the destroy delay; without it the client copy was removed at deathTime 19 and never drew its poof.
- Recalled (not re-read here): World.playSoundAtEntity (S29 to players within 16 / 16 * volume, at posX, posY - yOffset, posZ); handleHealthUpdate 2 / 3 / 6 / 7 / 18; EntityTrackerEntry sends S12 and clears `velocityChanged` once per entry for all watchers; EntityAnimal.func_146082_f sends status 18.
- Found different from the brief: the server player's movement is server-authoritative in this port (the client only displays the position stream), so there is no S12 to send to the hit player. The hit player's "client move" is the server position changing, which is what `knock` does. The knockback was previously never applied at all: `Survival.damage` queued it in `knockQueue` and nothing on the server drained it.
- Found: the heart burst of EntityAIMate.spawnBaby is `spawnParticle` on a WorldServer, a no-op natively; only the feeding status 18 reaches clients. No executed probe was added (no Java run); the union order helper is checked against `eligibleChunkOrder` (executed reference of batch 34) for one player.
- Assumption: Java 8 HashMap order inside a bucket (insertion order); the table doubles at 0.75 load. A Java 7 resize reverses bucket chains, which could reorder rare ties.

## Verification
- `node --test src/mpmobs2-b60.test.js`: 7 pass.
- `node --test` on mp*, multiplayer*, dedicated-beacon, serverbroadcast-b58, entities, deathfx-b59, entity-tracker, spawner*, mob-spawner*: 346 pass, 0 fail.
- `npm run build`: ok. Full npm test not run (batch rule). No browser checks.

## Follow-ups
- Nothing on the server lets a player feed or use an animal (no C02 interact), so status 6 / 7 (taming) and 18 are only reachable through the hook; a `mobUse` message would open feeding, breeding and shearing.
- Browser only: sound loudness and pitch of the S29 mob sounds against the copies' status sounds (a hit is heard twice, as natively), the poof position, the knockback feel on the hit player's screen.
- Not done: mob sounds of unsupported mob types, riding, leads, crits and sprint knockback on attacks, the mob entry sharing one `ticks` counter across watchers (each tracker has its own phase).
- Mob step sounds come from the events the port makes; any name outside `isMobSound` is dropped client side.
- The player-within test uses the eye height (native posY); the single-player path still uses the feet position.
