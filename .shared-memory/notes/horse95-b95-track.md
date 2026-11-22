# horse95 b95 track

## Summary
- Item 4 (killed-saddled-horse drift): not a port bug, no code change; pinned by test.
- Item 1 (rider in water) FIXED: a player whose eyes are in water steps off a horse or pig at once (`sv.C` 278-310: `!isRemote && isRiding() && ridingEntity instanceof EntityLivingBase` -> `mountEntity(null)`, no health or damage test; boats and carts are not living, so they keep the rider). Mob riders already did this (`entities.js breathe`); player riders did not, on the server or in single player.
  - `src/multiplayer/server-survival.js`: `tick` takes `underwater` from `tickPlayerEnvironment` and calls `vehicles.dismount(p)` for a mob mount.
  - `src/main.js` (one line, single player): `tickPlayerEnvironment`'s `underwater` calls `mobs.riderSneakOff(rider.vehicle.entity)` (the sneak's let-go: dismountEntity spot, S08, copy). `src/horse-live.js`: `riderSneakOff` returns when there is no rider.
  - `tools/probes/Horse95Probe.java` (copy of Horse94Probe, run from `tools/research/horse95-probe/`, git-ignored), record `public/research/horse95-reference.json` (dryControl, walkIn, startInside, deep).
- Items 2 (lead pulls a ridden horse) and 3 (/kill on a real EntityPlayerMP rider) left open (below).

## Evidence
- Executed (item 1): real `wi`, `mw` rider, `ahb.a(azt,awt,sa)` with block 9. Dry: never unlinked, 30 ticks. 2-deep pool (eyes above the surface): horse in water from tick 7, rider stays linked. Start in a 2-deep pool: unlinked in tick 0. 4-deep pool: horse in water tick 7, rider unlinked tick 10 (first C05 with the seat's eyes under the surface). The probe's `PM.a(sa)` only clears links, so the dismount spot is Bytecode-read (`yz.a(sa)` -> `sv.m`), not recorded; the port uses its existing `dismountSpot`.
- Bytecode-read: `sv.C` 278-310 (the instanceof `sv` test, `am()` riding, `ahb.E` remote flag); no riding test in `sa.N` (handleWaterMovement), so the mount's own water movement is unchanged.
- Bytecode-read: `wi.bh()` is `l != null && cu()` (rider and saddle) `|| cm() || cn()` (rearing, eating). No health test. So a dying horse with no rider runs its AI (wander) for 20 death ticks; with a saddled rider it never does.
- Executed on the port (scratch loop, 400 seeds per case, kill after 3 ticks, then 1 and 4 ticks): unridden saddled horse drifted in 6/400 (1.5%, wander roll on the kill tick: seeds 37, 70, 99, 268, 285); zombie rider 0/400; player rider (horseSeats.mount) 0/400. The old "3%" was the unridden case, a saddle alone does not block the AI.
- Port-read: `entities.js` `dying()` runs `this.ai.think` for a horse unless saddled-with-rider, rearing or eating; matches `wi.bh`.

## Verification
- `node --test --test-concurrency=2 src/horse95-b95.test.js`: 5 pass, 0 fail. Without the `server-survival.js` change the "let go in the first tick" test fails (4 pass, 1 fail; checked by copying the file aside and `git checkout`). Item 4 tests need no fix.
- Neighbours (every test naming riderSneakOff, ServerSurvival, server-survival, horse-live, horseSeats or p.mount; 34 files, concurrency 2): 342 pass, 0 fail.
- Single player: the main.js line is code-read only (main.js is not importable in node).

## Found wrong in the batch 94 list
- "a killed saddled horse drifted ... not root-caused" was read as a rider case. It is native AI wander of an unridden corpse.

## Follow-ups
- Open: lead pulls a ridden horse (needs `sv` leash code plus a lead holder in the probe), /kill on a real `mw` rider (needs server stubs for EntityPlayerMP.onDeath, packets).
- Item 1 not covered: the exact S08/S1B packets of the water dismount on the dedicated server (it uses `ServerVehicles.dismount`, like a killed mount), the dismount spot against a probe, a player on a pig in water (same `sv.C` test, same code path, not run).
- Browser-only: the SP dismount drawing.
- Browser-only: none checked.
