# Batch 64 mpwither2: the server wither, loose ends

## Summary
- `src/multiplayer/server-wither.js`: `hooks()` no longer forces difficulty 0 for a Nether player. Inside `dimensions.within` the `sim.tileEntities`, `sim.world` and `sim.mobs` are the player's dimension's, so the T builds through that dimension's own skull store and mob list and only its players track the wither (any dimension, End included, same code). `installServerWither` gives the mob world `witherPlayers` and `sweepPlayers` (every view of the dimension) and runs a skull impact as the player the sweep hit.
- `src/wither-boss-mobs.js`: the side heads' pool takes every player from `m.witherPlayers()` (single player: the one `ai.player`, unchanged). `levelEvent` 1012 / 1014 now also carry `aux { local: true }`.
- `src/fireballs.js`: `sweep` tests every player of `mobs.sweepPlayers()` when that hook exists (server only) and names the view hit.
- `src/multiplayer/server-mobs.js`: `useHit` (the hit player becomes the AI's player for the impact; ghast balls use it too), `nearAux` (S28 to this dimension's players within 64 blocks, 3D), `sound` routes `aux.local` there.
- `src/multiplayer/client-containers.js`: `dispenserAux` plays 1012 (`mob.zombie.woodbreak`) and 1014 (`mob.wither.shoot`) at the block centre, volume 2, pitch (r - r) * 0.2 + 1.
- `src/multiplayer/server-dispense.js`: the saved fireball list also holds the wither skulls (`kind witherSkull`, as the browser save), restored with `skulls.load`.
- Test: `src/mpwither-b64.test.js`. No new wire message names (S28 `aux`, S1D / S1E exist).

## Evidence
- Bytecode-read (javap, jar): `zp` (EntityWitherSkull) has no NBT methods; `ze` (EntityFireball) writes `xTile yTile zTile inTile inGround direction` only. So natively neither the blue flag nor the shooter is saved; the port keeps `blue` as its own extra field (like the single-player save).
- Bytecode-read: `mp` (WorldManager).a(yz,IIIII) = `sendToAllNearExcept(player, x, y, z, 64.0, dimension, S28(id, x, y, z, data, false))`; `a(IIIII)` is the broadcast one (flag true, `sendPacketToAllPlayers`). `xc` (EntityWither): 1013 through `ahb.b(IIIII)` (broadcast, as b63), 1012 and 1014 through `ahb.a(null, id, (int) x, (int) y, (int) z, 0)` (the 64-block, same-dimension one). `bma` (RenderGlobal.playAuxSFX): 1012 and 1014 play at cell + 0.5, volume 2.0, pitch (r1 - r2) * 0.2 + 1.
- Wrong gap (2): the wither effect icon was already sent. Skulls and wither skeletons add the effect to the AI's survival, which is the player's own `Effects`; `ServerSurvival.outgoing` diffs those every tick into S1D / S1E (batch 60). The test now proves it (executed).
- Executed (node tests): Nether T builds in the Nether mob list only, Overworld player not sent it; Peaceful hook value; S1D / S1E after a skull hit; skull saved and restored; heads take both players; S28 range; no S29 for 1014.
- Recalled, not checked: World.getEntitiesWithinAABB lists every player; the head's `getEntitiesWithinAABB` uses the attack selector (non-undead living).

## Verification
- `node --test src/mpwither-b64.test.js`: 7 pass (the Nether test takes about 2 minutes: it generates the Nether).
- `node --test src/mpwither-b63.test.js src/wither-boss.test.js src/wither-targets.test.js src/fireballs-b42.test.js src/blaze-ghast-world.test.js src/mpprojectiles2-b63.test.js src/mpprojectiles-b62.test.js src/projectile-nbt.test.js src/mpmobs2-b60.test.js`: 138 pass after one b63 assertion was updated (the Nether hook no longer forces difficulty 0), 0 fail.
- `node --check` on each touched JS file: clean. `npm run build`: succeeded (chunk size warning only).
- Full npm test not run (batch rule).
- Caveat: the skull-sweep half of the head test passes, but a and b's distances to the skull cross over, so it would not necessarily fail without the `sweepPlayers` change; the head-candidate half is the real evidence.

## Follow-ups
- The End's projectile lane is not saved or loaded (`ServerDispense.save` covers the Overworld and the Nether), so skulls and fireballs in the End are lost on restart.
- The 1012 / 1014 cell uses `Math.floor` (natively d2i, truncation): differs only for negative coordinates.
- Only a browser could show: the sounds at the client, the heads turning to a second player.
