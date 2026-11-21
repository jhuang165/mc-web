# mpobjects89 (batch 89): falling-block copies on the multiplayer client, remote boat collision, crystal fixes

## Summary
- **Falling blocks on the multiplayer client.** The dedicated server now puts falling blocks in its thrown-entity tracker lane, and the client keeps falling-block copies.
  - Server: new `src/multiplayer/falling-lane.js`. `fallingTrackList(dispense)` lists the live falling blocks of that ServerDispense instance's own dimension: the Overworld's `sim.falling` (cached while no dimension swap is active), or `dimState(dim).falling` for the Nether / End. Its first call also hooks `FallingBlocks.joined`, so a new falling block gets `ThrownTracks.birth` and its S0E carries the join state.
  - One new line in `server-dispense.js` thrownList adds those rows. Ids come from `dispense.id(e)`. The S0E (type 70, data = native id | meta << 16, posY = box bottom + 0.49) and the 160 / 20 / velocity entry come from the existing `OBJECT_KINDS.falling`. No edit to `object-tracker.js` or `thrown-tracks.js`.
  - Client: `thrown-copy.js` lists() sends kind `falling` to a new `falling` list. Each row has y = box bottom (posY - 0.49), plus block and meta from the S0E data. The copy runs ObjectClient's falling step: gravity -0.04, moveEntity, 0.98 drag. `client-dispense.js` exposes `remoteDispense.falling`, reset for each dispEnts message and by clear().
  - main.js: `tickRemoteDispense` draws the copies with `scene.setFalling`. ItemBoat's client boat check (`clientEntityBoxes({ falling })`) and the multiplayer placement check (`clientPlacementBlocker`, one line in `client-placement-entities.js`) both list them.
- **The multiplayer client player collides with remote boats.**
  - New `clientBoatCopyBoxes(boats)` in `src/boats.js` returns the boxes of RemoteVehicles' boat copies. Those copies are positioned by the tracker rows: S0E / S14-S18, then the setPositionAndRotation2 steps, or the rider's own boat physics.
  - The main.js copies thunk of `clientBoatBoxProvider` (now its own line, `clientBoatCopies`) uses them in multiplayer and the single-player object-tracker boxes otherwise. Mobs and other movers still use the live boxes.
- **Crystals:**
  - **Eye height.** The server's use-entity reach check (`server-mobs.js` attack and interact) now uses `useEye(mob)`: 0 for a crystal (`CRYSTAL_EYE_HEIGHT`), and `livingEyeHeight(type, size height)` for other mobs.
    - The brief said 1.7, but the old code read a height field the server's records don't have. The canEntityBeSeen ray therefore ended at NaN for every mob, so the 3..6 block line-of-sight test always passed.
  - **`/summon EnderCrystal`.** posY = command y + 1. `liftSummonedCrystal` in `ender-crystal.js` is called on new lines in `command-host.js`, after the untagged create and after the tagged restore.
  - **Piston push.** `EntityWorld.pushMove` gets a crystal branch, one new line: `crystalPushMove` moves the posY-centred box [y - 1, y + 1] with stepHeight 0, with no step sound and no landing. Before, it moved the feet box [y, y + 2] with step 0.5. `piston-live.js` and `server-pistons.js` both reach it through pushMove.
  - **Fireball sweep.** `mpperf79-fast.js` sweepBox and sweepBoxReference return `crystalBox` for a crystal (tested with mode on, off and verify). `fireballs.js` needed no edit, because its only crystal box comes from sweepBox.
- **Old test updated:** `boatray88-b88.test.js` pinned the old main.js setEntityBoxes line (the single-player-only copies thunk). It now pins the new `clientBoatCopies` line and the provider call.
- Research notes: dated lines in `public/research/end.md` and `public/research/boats.md`.

## Evidence
- **Bytecode-read** (`javap -c -p` on the 1.7.10 jar; scratch dumps `wz-mpobjects89.txt`, `sa-mpobjects89.txt`, `xj-mpobjects89.txt`):
  - `mn.a(sa)`: `instanceof xj`, then sipush 160 / bipush 20 / iconst_1.
  - `my.c`: type 70, data = `aji.b(xj.f()) | xj.a << 16`.
  - `xj.<init>`: sets preventEntitySpawning (`k`). `xj.R` (canBeCollidedWith) is `!isDead`.
  - `wz`: overrides only `<init>`, `g_` (canTriggerWalking, iconst_0), `c`, `h`, `b(dh)`, `a(dh)`, `Y`, `R`, `a(ro, float)`. There is no `g()F`, so the eye height is `sa.g()F` = fconst_0. `sv.g()F` = height * 0.85F.
  - `sa` never writes stepHeight (`W`): 0 for a non-living entity.
  - `bu.b` (CommandSummon): `sg.a(dh, ahb)` then `sa.b(DDDFF)` (setLocationAndAngles), and `sa.b(DDDFF)` sets posY = y + yOffset (`L`).
- **Executed:** `public/research/summon87-reference.json` (Summon87Probe on the unchanged CommandSummon, command `0.5 64 0.5`). EnderCrystal Pos[1] is 65.5; Pig is 64.5, both untagged and tagged.
- **Port-read:** the port's record y conventions (falling = box bottom, crystal = posY); the tick order; that ThrownTracks / ObjectClient handle any OBJECT_KINDS kind; and that `livingEyeHeight` with an undefined height gives NaN (also run).
- No new probe. BoatRayProbe and BoatEntityProbe weren't needed: the boat-collision rule is the one boatray88 already executed for single player.

## Verification
- `node --test --test-timeout=600000 src/mpobjects89-b89.test.js`: 9 pass, 0 fail.
- Neighbours: 78 files (everything that imports or source-matches the edited modules, plus skins73-b73, the dispEnts / piston / summon / reach tests), run with `--test-concurrency=2`. 872 tests: 871 pass, 1 fail.
  - The failure was sounds73-b73: it flagged a backticked field name in a new server-mobs.js comment. I reworded the comment, and sounds73-b73 then passed (7/7).
- `npm run build`: passes (only the usual chunk-size warning).
- No browser checks (track rules). **Browser-only checks:**
  - falling copies drawn in a real multiplayer session (texture, interpolation, shadow);
  - walking into, and standing on, a remote boat without rubber-banding against the server's correction;
  - the crystal visibly moving with a piston.

## Follow-ups
- **Tick order (port-read):** the dedicated server runs `falling.tick()` after `dispense.flush()`. A falling block's S0E therefore goes out a tick late, and the air change at its source cell reaches the client one tick before the copy. Natively, WorldServer.tickUpdates spawns the entity before the entity walk and tracker pass of the same tick. The fix is in `simulation.js` order, which I did not change.
- Falling blocks made by `/summon FallingSand` (entity-summon.js), or restored from a save, get no birth copy. Their S0E carries the state at their first tracker pass.
- The crystal's piston move passes no block-collision hooks. Native moveEntity's doBlockCollisions (cactus) and fire check (`dealFireDamage` → attackEntityFrom → explosion) are not modelled for a pushed crystal.
- `explosion-simulation.js` (credit89) already used the crystal box and posY eye, so nothing changed there.
- Multiplayer copies cast no shadows. The shadow list in main.js (about line 4890) reads only the single-player boats, orbs and falling blocks, so remote boats and orbs have none either. This is a general multiplayer gap, not new here.
