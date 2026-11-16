# Batch 76 spsounds76: single-player sound sweep, part 2

## Summary
- New executed probe `tools/probes/SpSounds76Probe.java` + `tools/verify-spsounds76.mjs` -> `public/research/sound-sweep2-reference.json` (62 records): bucket, thrown items and right-click item sounds from the unchanged 1.7.10 classes.
- Fix 1 (`src/buckets-simulation.js`, `src/main.js` `sound`, 1 line): the break sound of a plant a bucket replaces now plays at the replaced cell (native aux 2001 at the placed cell). Before it played at the clicked block below the plant (one block off).
- Fix 2 (`player-throw-simulation.js`, `potion-use.js`, `spawn-egg-use.js`): the snowball, egg, bottle o' enchanting and splash potion throw pitch is the float32 chain `0.4F / (nextFloat() * 0.4F + 0.8F)` (the ender pearl already was). Differences were about 1e-8; exactness only.
- Tests: `src/spsounds76-b76.test.js` (9). Updated for the intentional changes: `buckets-simulation.test.js` (4th hook argument), `player-throw-simulation.test.js`, `player-edit-simulation.test.js` (float32 pitch), `player-throw-replay.test.js` (comparison with the pinned pre-extraction code rounds pitch to 1e-6 and ignores the bucket's new cell argument).

## Evidence
- Executed: `ItemBucket.tryPlaceContainedLiquid` (water, lava; Overworld, Nether via `WorldProvider.isHellWorld`; air, stone, tall grass; remote and non-remote world): no sound except Nether water, `random.fizz` 0.5, 2.6 + (r - r) * 0.8, at the cell centre, plant kept (no aux 2001); in the Overworld and for Nether lava a replaced plant breaks (aux 2001 at the replaced cell, server world only). Buckets have no bucket-specific sound strings (Bytecode-read of `abo`: only `random.fizz`).
- Executed: `onItemRightClick` of snowball, egg, ender pearl, bottle o' enchanting, splash potion: `playSoundAtEntity random.bow 0.5, 0.4 / (rand * 0.4 + 0.8)` on both worlds. Eye of ender with no stronghold in the double: silent, not consumed (the bow sound follows a found stronghold; Bytecode-read `acn.a` offset 150).
- Executed: fire charge `ItemFireball.onItemUse`: `fire.ignite` 1.0 only on the non-remote world (the client returns first), at the placed cell. NOTE: the lead's brief mentioned `mob.ghast.fireball` aux 1009; that is the ghast/dispenser path, not the item (Bytecode-read `acq`: `fire.ignite`).
- Executed: hoe: `step.gravel` 1.0 pitch 0.8 at the tilled block centre, both worlds; nothing on stone or sand. Bone meal: aux 2005 only, no sound. Lily pad item, shears: silent (Bytecode-read `aej`, `adx`: no sound strings; `ItemLilyPad` places via `onItemRightClick`). Flint and steel: `fire.ignite` on both worlds (previous sweep).
- Bytecode-read: eating/drinking (`yz.c`: `random.drink` 0.5, rand*0.1+0.9 every call for drinks; `random.eat` 0.5+0.5*nextInt(2), (r-r)*0.2+1; `ItemFood.onEaten` `random.burp` 0.5, rand*0.1+0.9) already matched the port (b58 MpEatingProbe); bow release `random.bow` 1.0, 1/(rand*0.4+1.2)+power*0.5 matched `bow.js`.
- Bytecode-read: dig hit (`bje.c`, PlayerControllerMP.onPlayerDamageBlock): `if (stepSoundTickCounter % 4 == 0)` step resource path, volume (v+1)/8, pitch f*0.5, at block centre, then the counter increments; counter reset per new block. Port (`player-mining.js` + `hitSound`) matches incl. cadence (hits 0, 4, 8). The break sound was swept in b75.

## Verification
- `node --test src/spsounds76-b76.test.js` plus the related suites (spsounds-b75, buckets-simulation, buckets, player-throw-replay, player-throw-simulation, player-throws-b46, potion-use, player-edit-simulation, player-mining, block-sounds, sounds73-b73): pass. `npm run build` ok. Full `npm test` not run (batch rule); no browser or audio.

## Follow-ups
- A real bow release and `onPlayerStoppedUsing` was not re-executed (matched via bytecode constants only); lily pad `onItemRightClick` needs the ray trace, not run.
- Splash potion impact (EntityPotion) and exp bottle impact sounds are outside this sweep (aux 2002/2002 particles).
