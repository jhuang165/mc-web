# horse96 (batch 96) track note

Branch `batch96-horse96`, cut from main 0e2854338 (release 0.124.0).

## Summary (file by file)
- `src/multiplayer/server-vehicles.js`: `riderInput` no longer dismounts a dead player on a MOB mount (horse, pig) at once. The rider stays linked while `deathTime <= 20`, with zero ride input and no sneak dismount, and is released (`release(p)`, new) the tick after, where it sat: no landing-spot search, no teleport. Cart and boat riders keep the old immediate release (not probed).
- `src/multiplayer/server-survival.js`: `respawn` calls `vehicles.release(p)` so the respawned player is never left linked to the mount.
- `tools/probes/Horse96Probe.java` (lead on a ridden horse) and `tools/probes/Kill96Probe.java` (/kill on a riding real `mw`), run from git-ignored `tools/research/horse96-probe/` and `kill96-probe/`.
- `public/research/horse96-reference.json` (87 KB), `public/research/kill96-reference.json` (38 KB): trimmed probe output.
- `src/horse96-b96.test.js`: 14 tests.
- No `main.js` change. Single-player `die()` (main.js ~3038) still calls `detachPlayerVehicle` at once: open, see Follow-ups.

## Evidence
- Executed (Horse96Probe, real `td.bL`, `sw.a`, `wi`): a lead on a ridden horse pulls it (motion `d*|d|*0.4` per axis above 6 blocks), navigates above 4, breaks above 10 and drops the lead in the same tick with S1B(1, e, null). The rider keeps the seat in every scenario (knot idle at 8 and 11 blocks, walk away, walk towards, player holder, rider as holder). The port (single player `EntityWorld` and the dedicated server) matches tick by tick (leash state, rider kept, z within 0.002). Item 1 was already native; no port change, tests only pin it.
- Executed (Kill96Probe, real `mw.a(ro)` onDeath on a riding EntityPlayerMP, horse and pig mounts): onDeath does no dismount. The rider stays linked through deathTime 1..20 and `ahb.h` unlinks it the tick after (player y unchanged, no teleport). With `ahb.f` (respawn removal) mid-animation it is unlinked in the next `ahb.h`. A killed mount also unlinks the rider, which stays in place.
- Bytecode-read: `mw.a(ro)` and `oi.a(mw,int,boolean)` have no mountEntity(null); `ahb.h` does the unlink; `wi.o(float)` stops eating above 6.
- Port-read: pig in water. `sv.C`'s water branch has no horse test, so the batch 95 `env.underwater && p.mount?.mob` rule covers a pig; the new test pins the port (4 cells released, 1 cell kept). Not executed.

## Verification
- `node --test --test-concurrency=2 src/horse96-b96.test.js`: 14 pass, 0 fail.
- Fails without the fix: with `server-vehicles.js` and `server-survival.js` reverted, 2 of the 13 then-existing tests fail (killed rider stays; respawn unlinks). The leash tests pass either way (no fix needed).
- Neighbours (44 test files naming server-vehicles, server-survival, riderInput, respawn, sweep-use75; list in the run command's grep): 439 pass, 0 fail.
- `npm run build`: not run (no imports changed beyond a new test file).

## Found wrong in the batch 95 list
- "Lead pulling a ridden horse" listed as open: it was already native in both the single-player and dedicated paths.
- The immediate dismount of a dying player rider (server `riderInput`, `p.dead`) was non-native.

## Follow-ups
- Item 2 only partly closed: the batch 95 water-dismount spot and the S08 packets were not re-compared with a probe, and the pig-in-water case is port-read, not executed.
- Single-player `main.js` `die()` still detaches the vehicle immediately (code-read only, not changed); a cart or boat rider's death is unprobed.
- Browser-only: how the killed rider looks seated on the mount during the animation on a remote client.
