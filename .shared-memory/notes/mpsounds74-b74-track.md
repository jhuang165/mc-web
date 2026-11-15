# Batch 74 mpsounds74: block place sounds on the dedicated server

## Summary
- `src/multiplayer/server-place-sound.js` (new): `placeSoundOut` / `placedResultSound` queue the native place sound in `sim.soundsOut` (cell centre, `(volume + 1) / 2`, `frequency * 0.8`, `except: null`, the placer's dimension) using `block-sounds.js placeSound` / `placesSilently`; `isBlockSound` is the client whitelist.
- `simulation.js`: one import and one line after `placeHeldBlock` succeeds (covers ItemBlock, slabs, snow stacking, reeds, double plants, doors/redstone/sign-like silent ones are skipped by `placesSilently`; cocoa is silent).
- `server-place.js`: the cake item (ItemReed) plays the cake block's sound.
- `server-use.js`: removed the `step.grass` 0.5 sound for seeds and nether wart (ItemSeeds has no sound call).
- `src/main.js`: `onSound` also accepts block family names (`dig.*`, `step.*`, `random.anvil_land`); before, every server place or hoe sound was dropped by the client filter.
- `src/mpsounds-b74.test.js` (14 tests).

## Evidence
- Bytecode-read: `abh` ItemBlock, `abi` ItemReed, `ada` ItemSnow, `aec` ItemSlab each end `onItemUse` with `World.a(DDD String F F)` at x+0.5, y+0.5, z+0.5, factor 0.8f. `adw` ItemSeeds, ItemDye (cocoa), door, bed, sign, skull, redstone have no such call.
- Bytecode-read: `bf` WorldManager `playSound(String,DDD,F,F)` -> `oi.a(x,y,z,range,dim,packet)` (sendToAllNear, range 16 or 16*volume): no player excluded; `playSoundToNearExcept` is the separate excluding variant. So the placer hears the S29.
- Bytecode-read: `bje` PlayerControllerMP calls `tryPlaceItemIntoWorld` on the client, but the earlier b58 probe (see main.js predictPlace comment) found the client's own playSoundEffect silent, so the S29 is the only sound: no double. The multiplayer click path in main.js plays no local place sound.
- Executed (JS): sweep in `mpsounds-b74.test.js` over wool, sand, gravel, grass, torch, anvil, slab, double plant, reeds, cake, snow stacking: placer and a nearby player get exactly one sound, a player 20 blocks away none; door, bed, sign, skull, redstone dust and a refused cake send none. Expected values are the Block.SoundType table (block-sounds-reference.json). No new Java probe; the native claims above are bytecode-read, not executed.
- Break audit: the 2001 path already exists (`server-items.js afterBreak`, S28 to every player but the breaker within 64, client plays it). Flint and steel and fire charge send `fire.ignite` (volume 1, 0.4/0.8 pitch, bytecode `acq`/`acw` agree). Hoe sound existed.
- Bucket: native buckets are silent except the Nether water `random.fizz` (`abo`); the server has no bucket placement or pickup at all (only milk drinking), so there is no sound to send. That is a larger gap, not a sound gap.

## Verification
- `node --test src/mpsounds-b74.test.js`: 14 pass. `src/sounds73-b73.test.js` 7 pass (21 with the new file). `src/mpblocks73-b73.test.js src/mpstats2-b64.test.js src/mpstats3-b65.test.js src/mpitems-b59.test.js src/mpfixes69-b69.test.js src/mpnether-b61.test.js src/mpbooks-b66.test.js`: pass; `src/mpwither-b64.test.js` 7 pass (it failed once in a combined run on the wither effect test, passed on every rerun: flaky, unrelated).
- `node --check` on touched files ok; `isBlockSound` is imported and used in main.js line 907. `npm run build` ok. Full npm test not run (batch rule). No browser check (the doubled-sound question and audible levels were not heard).

## Follow-ups
- Single player still plays `step.grass` 0.5 for seeds and nether wart (`player-edit-simulation.js` lines ~455, 465), which native does not (bytecode-read). Left alone: single player is out of this track's scope.
- Single-player `placeHeldBlock` skips `sound()` for the double plant (ItemBlock plays it natively); the server now sends it.
- Server buckets (fill, empty, Nether fizz) are not implemented.
- Other S29 sources (mob and block sounds outside this list) still depend on `MP_SOUNDS` / `isMobSound` in main.js.
