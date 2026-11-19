# mphook85 (batch 85) track

Branch `batch85-mphook85`. Task: finish the thrown-entity tracker lane (fishing hooks, join-state baseline, hit targets).

## Summary

1. **Fishing hooks ride the lane.** `ServerFishing.trackList(dim)` lists the live hooks (`kind: 'fishHook'`, 64 / 5 / velocity, S0E type 90, data = the angler's id; the hook's id is its own `entityId`); `ServerDispense.thrownList` appends them. The old `fishHooks` message is no longer sent (the client still reads it from an older server). `ThrownCopies` builds the copy only if `hooks.hasAngler(data)` (native handleSpawnObject finds the angler by id or builds nothing), runs `ObjectClient.stepHook` (position-packet interpolation, 3 ticks, then the flight) and returns `hooks` rows (`x/y/z`, `px/py/pz`, `angler`); `RemoteDispense` hands them to `RemoteFishing.lane(rows)` (main.js `fishHooks`). This build's player ids can be strings, so the hook's S0E data is the raw id (not `| 0`).
2. **`fishFx` stays.** The only server-side particles are the bite's bubble / wake / splash, the server's own `WorldServer.func_147487_a` S2A packets (fishing.js `env.particle`, the `!env.remote` branch). The entity's own water splash (`handleWaterMovement` -> `World.spawnParticle`) is a no-op on a server and `env.fx` is absent in the server host, so nothing duplicated the copy: no removal needed.
3. **Join state.** `ThrownTracks.birth(list)` (called at the top of `ServerDispense.tick`, before the entity pass; the player actions, dispensers and mob shots have already spawned) copies each new entity's state; `update` builds the entry from it and then reads the flush state. So the entry's baseline (scaled position and angles, `my.<init>`) is the join state while the S0E carries the flush state, and an arrow's first position packet is the delta between them (a teleport past 128 units).
4. **Hit targets.** Arrow and hook copies get `hooks.targets()` (main.js `mpCopyTargets`: mob copies, dragon parts, other players' copies `answers: true`, the local player, creative immune). A row carries `sh` ({ p: playerId } | { m: mobWireId }, `ServerDispense.shooterRef`; a hook's is its angler) so the copy skips its shooter for 5 ticks (`clientHitContext`) and a hook ignores its own angler (`tracker.hookAngler`, a one-line change in `object-tracker.js` hookEnv). Balls get no targets: see Evidence.
5. Not done: extra-dimension stand-in lanes still use exact `ents` rows.

## Evidence

- Bytecode-read: `zk.h` (EntityThrowable.onUpdate): `ahb.E` (isRemote) `ifne` skips the entity search, so snowball / egg / pearl / potion / bottle copies never hit entities on a client (their impact on blocks is unchanged). `bll.a(ro, float)` (EntityOtherPlayerMP.attackEntityFrom) is `iconst_1; ireturn`: another player's copy answers true, so an arrow that hits it ends with the hit sound; a living mob copy answers false, so the arrow ricochets (existing `arrows.step` remote branch). `my.<init>` captures `floor(pos * 32)` and the angle bytes at construction (the join); S0E is built later from the live entity.
- Port-read: tick order (actions, dispense / mobs, tracker flush in `simulation.js tick`) for where the join state is taken.
- Executed: `src/mphook85-b85.test.js` (hook copy through ThrownTracks / ThrownCopies, no angler, join baseline, arrow ricochet / end / shooter skip, snowball ignores targets).

## Verification

- `node --test --test-timeout=600000 src/mphook85-b85.test.js`: 5 pass.
- Neighbours (b62-lead, fishing, fishing-simulation, mpdispense-b61, mpend2-b64, mpprojectiles-b62, object-tracker*, mptrackers71, trackertransient-b64, mpstats2-b64, mpthrown84-b84): 147 + 16 pass. `mpstats2-b64.test.js` was updated: the hook is a `trk` row (S0E data = angler id, `sh`), not a `fishHooks` message, and its destroy follows the reel-in.
- `npm run build` ok. No full `npm test`, no browser.

## Follow-ups

- Extra-dimension stand-in lanes keep exact `ents` rows.
- A viewer who joins after the entity's join tick builds its entry from the flush state (native: the shared entry keeps updating its baseline); the S12 / S14 first-packet difference is not modelled for late viewers.
- Browser-only: bobber and line drawn from the copy, arrows bouncing off or stopping in mob / player copies, hook-in-water splash by the copy; the `mpCopyTargets` / `mpCopyRefOf` wiring in main.js.
