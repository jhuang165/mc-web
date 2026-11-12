# awaydispense2 (batch 51)

## Summary
- Spawn eggs are dispensed (src/dispense.js `SPAWN_EGG`, item 1950): BehaviorDispenseSpawnEgg spawns at (centre x + facing x, (float) int y + 0.2F, centre z + facing z) -- the dispenser's own level, not the facing cell's y -- with the yaw from the world Random (`nextFloat() * 360`, wrapped), the stack's custom name, sound 1000, and one egg used up even when no mob came out (unregistered damage). Hosts: main.js and away-world.js `spawnEgg` call `spawnEggMob` (spawn-egg-use.js); the away run puts the stack back without an entity run.
- Exp bottle dispense (ku) is now executed, not only bytecode-read: velocity 1.375 (1.1F*1.25F), inaccuracy 3.0 (6F*0.5F), class EntityExpBottle; the existing port matched, no change.
- Away item-frame drop: no code change. The existing away run breaks an unsupported frame on the 101st update and drops the frame item and the held item; the test now ties the timing and drop count to the executed HangingProbe `frame-removed` record.
- Saved cross-kind list order: not changed (follow-up).

## Evidence
- Executed: tools/probes/AwayDispenseProbe.java (tag b51ad, reuses DispenseProbe's World double; DispenseProbe's double gained `B(III)` and `V()` overrides so zombie/skeleton/pigman/horse onSpawnWithEgg can construct) -> tools/verify-away-dispense.mjs -> public/research/away-dispense-reference.json (108 records: 24 egg kinds, 6 unregistered damages, named eggs, 6 facings, 12 exp-bottle dispenses, 18 headings; regeneration is byte-identical). Replayed by src/away-dispense-b51.test.js.
- The client jar has no en_US.lang; the verify script supplies a one-line stub (StringTranslate and the horse need it). playLivingSound lines (mob's own unseeded Entity.rand) and the bottle's unseeded heading are dropped from the dispense rows; headings are replayed from reseeded `heading` rows.
- Bytecode-read (javap): kx (egg behaviour), aee.a (spawnCreature: one loop pass, `instanceof` living, yaw draw, onSpawnWithEgg, playLivingSound).
- Away item frame: hanging-reference.json (executed, batch 22) plus the away run test.

## Verification
- `node --test src/away-dispense-b51.test.js` 5/5 (pass).
- `node --test src/dispense.test.js src/away-order-b50.test.js src/away-mobs.test.js src/spawn-eggs.test.js src/dispenser-piston.test.js` 50/50 with the new file (6 counted in the run above).
- `npm run build` once. No full npm test (batch rule).

## Follow-ups
- A dispensed egg's native `onSpawnWithEgg` may draw from the world Random (sheep colour, horse, etc.) and `playLivingSound` plays; the port draws only the yaw float from the world stream and plays no sound, so `worldNext` is not compared for eggs.
- Eggs for mobs this build lacks (ghast, blaze, magma cube, bat...) spawn nothing; the egg is used up as natively, but their world Random draws are not made.
- Saved cross-kind list order (items vs mobs vs arrows across save/load; Chunk entity lists are per chunk) is still not stored; needs a stamp in each save record plus a load sort in main.js and away-entities.js.
- The away item-frame drop motion still uses the run's own item stream.
