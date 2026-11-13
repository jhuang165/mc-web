# dragondeath (batch 56)

## Summary
- Death spin: it was already an executed `death` record (2 variants, 205 ticks: deathTicks, position, yaw, orbs, world event 1018, particles, portal writes). b56 added `orbAt` to those records (tick, value, orb x/y/z and motion): each orb spawns at the dragon's place before that tick's 0.1 rise. `dragon.test.js` and `dragon-world.test.js` now check the 44 orb ticks and positions, and the death sound cell.
- "The egg's living sound": the dragon egg has none in 1.7.10 (`akp` bytecode: the only String constant is `portal`; no sound call). The nearest real thing is the dragon's growl: ported since b51ft, and a dying dragon plays none (`EntityLiving.onEntityUpdate` rolls only when `isEntityAlive`). The gap line was wrong; corrected in `remaining-gaps.md`.
- Crystal copy fire: `wz.h` has no isRemote branch, so the client copy sets fire at its feet in a WorldProviderEnd client world. Added `clientCrystalFire` (ender-crystal-mobs.js) and an optional `ClientEntity.crystalFire` hook (one line in `entity-tracker.js`, in the crystal step). No client block layer exists to attach it to, so nothing calls it in the browser yet.

## Evidence
- Executed: `DragonProbe` death records, regenerated with `node tools/verify-dragon.mjs` (MC_RESEARCH set); `dragon-reference.json` changed only by the new `orbAt` field.
- Bytecode-read: `akp` strings, `wz.h` (no isRemote guard), `EntityLiving` alive check for the growl. The client fire rule is not executed on a client world.

## Verification
- `node --test src/dragon*.test.js src/end.test.js src/entity-tracker*.test.js src/tracker-mounts*.test.js`: 95/95. `npm run build` ok. No full `npm test`.

## Follow-ups
- Wire `crystalFire` to a client block layer (prediction layer, owned by prediction2) and decide how a client fire block interacts with the server's block-change packets (BlockFire client onBlockAdded not read).
- The probe has no sound log for the dying dragon beyond the world event; bytecode says there are none.
