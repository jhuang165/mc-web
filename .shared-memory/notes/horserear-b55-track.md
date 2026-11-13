# Horse rear / buck / unsaddled copy, batch 55

## Summary
- The horse client copy now animates from its own counters: `stepHorseAnim` (horse-copy.js) ports EntityHorse.h() (wi.h) animation: head lean bJ/bK (flag 32 eating), rearing amount bL/bM (flag 64), mouth openness bN/bO (flag 128), tail counter bp, counter bq, plus the partial-tick getters p/q/r. `entities.js clientAfterMove` steps `c.horse` from the flags of the live horse (`horseFlagsOf`: watcher 16 bits 2/4/8/16/32/64/128). `copySeat` reads the copy's `c.horse.rearAmount`, not the live horse's `rearAmount`.
- The live horse (horse-live.js) now keeps `e.horseAnim` with the same function instead of the old +-0.1 rear stand-in; `mouthTicks` (wi.bE, started by sound getters, ends above 30) drives flag 128.
- Buck disagreement resolved: the executed run-around buck lands the player on the `dismountEntity` spot (sv.m), like a direct `mountEntity(null)`. The b47h record's "player at mount x/z with seat y" came from the stub `NetHandlerPlayServer.setPlayerLocation` doing nothing. ServerPlayerProbe.Net now applies the location; enderman-wolf-b47h-reference.json was re-recorded. The port's buck uses `horseSeats.dismount(..., true)`.
- Ridden unsaddled copy physics recorded and matched (client chunk provider added to the probe world): the existing remote-copy path (0.98 drag, 0.005 cut, moveEntityWithHeading, hover when the chunk is unloaded) already matched; no change needed.

## Evidence
- Executed (unchanged 1.7.10 classes): tools/probes/HorseRearProbe.java -> tools/verify-horse-rear.mjs -> public/research/horse-rear-reference.json: `anim` (3 flag scripts x 50 ticks of wi.h()), `copy` (unsaddled ridden copy: air, ground, unloaded chunk), `buck` (real EntityPlayerMP, vg.e() until status 6 plus direct mountEntity(null), 7 stone layouts x 2 modes, spots recorded from setPlayerLocation).
- Bytecode-read: the watcher bit meanings of wi.x(I), the tail roll wi.cR, which sound getters call cS() (mouth open).

## Verification
- `node --test src/horse-rear-b55.test.js src/horse-copy-b54.test.js src/enderman-wolf-b4*.test.js src/horse-ride-b47.test.js` (205 pass); `node --test src/horse*.test.js src/tracker-mounts.test.js src/entity-tracker.test.js src/entities.test.js src/mob-riding*.test.js src/pig-saddle*.test.js` (303 tests, run before fixing the b54 seat test that read the live amount; that test now passes). `npm run build` ok. Full `npm test` not run.

## Follow-ups
- Flags reach the copy from the live horse directly; the watcher's send delay (tracker metadata interval) is not modelled (entity-tracker.js is dimtracker's).
- The tail roll (nextInt(200) on the copy's own Random) is not drawn on the copy, to keep its random stream unchanged; the tail counter bp therefore never starts on the copy. No renderer reads the new fields yet: nothing outside horse-copy.js, entities.js and horse-live.js uses rearAmount, so the rearing pose is not drawn from them.
- Rearing/eating flags set by the server for other causes (eating grass, bq counter starters) are not ported.
