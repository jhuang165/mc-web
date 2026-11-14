# Batch 67 entityprobes2: item frame throws, away drops, riding server copy, own bobber line

## Summary
- `tools/probes/EntityListProbe.java`: new additive `frame` spec kind (an `EntityItemFrame` at a wall tile, optionally holding a cobblestone) and a frame row ending in the held count. Old records are unchanged.
- `tools/probes/EntityThrowFrameProbe.java` + `tools/verify-entity-throw-frame.mjs` -> `public/research/entity-throw-frame-reference.json` (22 records): snowball, egg, pearl, potion and exp bottle at an empty or loaded frame, thrown by a Survival player, a Creative player, or nobody (dispenser form), plus an egg hatch roll.
- `src/entity-list-replay.js`: replays and views the `frame` kind. `src/entityprobes2-b67.test.js`: 26 tests (22 replays, frame outcomes, the away frame drop).
- `src/main.js`: the connected client's own bobber passes the player's body (`ownFishingAngler`, feet lowered by ySize) to the fishing renderer, so the third-person line leaves from the body's hand position, not the camera eye.

## Evidence
- Gap 1 (vehicles and paintings): already executed in batch 47 (`entity-list-reference.json`: `pthrow-egg/pearl/expbottle-*` on carts, boats and paintings, hatch rolls, a real `EntityPlayerMP` pearl). No change needed there. The real hole was item frames: executed now, all 22 records replay with no port change (port already matched). Executed: a held item is knocked out and the frame stays; an empty frame breaks and drops itself; Creative drops nothing; potions and exp bottles do not touch a frame (their `onImpact` never calls `attackEntityFrom`); a thrower-less ball behaves as a player's.
- Gap 2 (away run): the dispenser firing was executed in batch 51 (`away-dispense-reference.json`) and the list order in batch 50 (`away-order-reference.json`), so the batch 47 "not probed" line is stale. The frame drop: bytecode-read `EntityItem.<init>`: sideways motion is `Math.random()*0.2-0.1` per axis, motionY 0.2, so no seed can be replayed; the away run's drop keeps that range and the delay of 10 (test).
- Gap 3 (riding server copy): bytecode-read `NetHandlerPlayServer.processPlayer` (nh.a(jd)): when `playerEntity.ridingEntity != null` it applies the packet's yaw and pitch, calls `ridingEntity.updateRiderPosition()`, sets the position to the seat, runs `EntityPlayerMP.onUpdateEntity` (`mw.i`: inventory, health and food syncs), sets the position again and calls `updateRiderPosition` again. No movement physics run and the packet position is not used, so the port's seat-driven copy (`p.mount`, `riderInput` for steering, `mounted` stat distance) already gives every visible result. Closed as not needed.
- Gap 4: wiring, not native; the line maths is the batch 65 executed `fishing-line.js`. The hook only supplies the body. Not run in a browser.

## Verification
- `MC_PROBE_LIBS=<netty 4.0.10, guava 17, log4j-api 2.8.1, commons-lang3 3.5> node tools/verify-entity-throw-frame.mjs`: 22 records.
- `node --test src/entityprobes2-b67.test.js src/entity-list.test.js src/away-throws.test.js src/away-order-b50.test.js src/hanging.test.js src/fishing.test.js src/clientreplays-b65.test.js`: 178 pass, 0 fail.
- `node --check src/main.js`; `npm run build` ok. Full npm test not run (batch rule).

## Follow-ups
- Browser only: the connected third-person own-bobber line (also whether the body's yaw settles while standing still), not checked.
- Pearl at an item frame by a real `EntityPlayerMP` thrower, and mob-thrown (witch) potions at frames, are not probed.
