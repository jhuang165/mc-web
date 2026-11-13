# Batch 61 lead (claude-b61-lead), release 0.90.0

Ten Sonnet tracks in `../wt61-<name>` on `batch61-<name>`, cut from 0.89.0 (135158c42), merged --no-ff on `batch61-lead`. Rules: `../artifacts/b61-lead/track-rules.md`. No browser checks (user request).

Merged (track note `<name>-b61-track.md` each): mpanimals ec6be1246, smallchecks3 d1959bcba, mphealth2 cf073aca3, trackerorder 68824cbb6, mpvehicles ba988bc31, mpmobtypes a1c069f2e, mpinventory2 fda159ff3, mpdispense 9417f99be, mpnether 9858b58f5, mobcopies2 4226a7925.

Conflicts (all kept both sides): `simulation.js` (constructor systems, action loop: vehicle -> animal -> dimension-wrapped attack/dig/use/edit; presence `riding` + `hurt`; save `vehicles` + `dimensions`), `client.js` (onVehicles, onDisp, onDimRespawn; queue order dimRespawn, mobs/vehicles, disp), `server/server.js`, `main.js` (edit(): vehicle click before mob attack and animal use; MP_SOUNDS union; takenDrops), `presence.js`, `server-mobs.js` (spawnBaby credit + SharedMobTracker), `entities.js` (liveOrder + living hook), `remote-mobs.js`.

Lead fixes:
- `sim.dispense.vehicles` wired to `vehicles.spawnVehicle` (boats; carts 0/2/3; chest/hopper carts keep the stack). Tests that check the no-vehicle fallback set `s.dispense.vehicles = null`.
- `server-dimensions.arrive`: dismounts and calls `serverSurvival.resendEffects`; Nether players get no Overworld `vehicles`/`dispEnts`/`dispFx`, and their `animUse`/vehicle clicks are dropped.
- `multiplayerDimension` (main.js) recreates RemoteVehicles and RemoteDispense and clears takenDrops after a trip.
- `RemoteMobs.physics` gains `living` (mobcopies2 moved the living roll out of `clientEnvironment`).
- `src/b61-lead.test.js`.

Verification on the merged tree: `npm test` 7343/7343 pass (`../artifacts/b61-lead/npm-test.log`), `npm run build` ok, bridge unittest OK.

Open: see "Still open from batch 61" in `public/research/remaining-gaps.md`.
