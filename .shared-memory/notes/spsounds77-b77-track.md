# Batch 77 spsounds77: single-player sound sweep, part 3

## Summary
- New executed probe `tools/probes/SpSounds77Probe.java` + `tools/verify-spsounds77.mjs` -> `public/research/sound-sweep3-reference.json` (244 records): block activation, bow release, lily pad, eye of ender, eating/drinking, flint and steel, thrown-entity impacts, sheep shear, arrow hit, and the real `RenderGlobal.playAuxSFX` for every logged aux type (plus 2003, 2004).
- Fix (`src/eye-of-ender-live.js`, 1 hook): an eye launch also plays aux 1002 (`random.bow` 1.0 / 1.2 at the player's truncated block corner) after the 0.5 `random.bow`. The port had only the first sound.
- Tests: `src/spsounds77-b77.test.js` (11). No older test encoded the gap (`eye-of-ender.test.js` already expected the native auxPlayer 1002 record). Dispenser sounds untouched (spdispense77).

## Evidence
- Executed: doors, trapdoors, fence gates = aux 1003 only (wood door upper half at y+1); iron door silent. aux 1003 = random.door_open/close, 1.0, pitch 0.9..1.0, at +0.5.
- Executed: lever click 0.3 / 0.6 (0.5 when powered meta >= 8), button 0.3 / 0.6, comparator 0.3 / 0.55 compare, 0.5 subtract, plates 0.3 / 0.5 at y+0.1. Lever remote is silent; buttons and comparator also sound on the client world. Repeater and cake activation are silent.
- Executed: chest and ender chest lid sounds random.chestopen / chestclosed 0.5 at the lid centre (double neighbour half way), both worlds. Note block: note.<instrument> 3.0, pitch 2^((n-12)/12), server only.
- Executed: bow release: nothing at 1 tick, random.bow 1.0 on both worlds otherwise; lily pad: silent everywhere; eye of ender: random.bow 0.5 + aux 1002 with a stronghold, silent without; remote silent.
- Executed: eat finish random.burp 0.5 (both worlds); drink random.drink 0.5 per use tick; potion and milk finish silent. Flint and steel fire.ignite on both worlds at the cell centre above; TNT prime game.tnt.primed server only.
- Executed: potion and exp bottle impact = aux 2002 (game.potion.smash 1.0, pitch 0.9..1.0) server only; aux 2003 and 2004 make no sound. Sheep shear mob.sheep.shear 1.0 / 1.0 both worlds, silent when sheared or a lamb. Arrow into block random.bowhit 1.0, both worlds.
- Port-read: the remaining port paths (doors-panes.js doorSound, redstone click code, chest.js tickLid, note-blocks.js, bow.js shotPitch) matched the records via the new test.
- Not executed: aux 1005 conversion (records.<name>, volume 4.0, Bytecode-read); snowball, egg and ender pearl impacts, fireball explosion and milking: no sound strings found/expected (Bytecode-read, not run).

## Verification
- `node --test` on spsounds77-b77, spsounds76-b76, spsounds-b75, eye-of-ender, bow, note-jukebox, chest, chests, doors-panes, player-edit-simulation: 137 pass, 0 fail. `npm run build` ok. No full `npm test`, no browser.

## Follow-ups
- Mooshroom shear, ender pearl landing, fireball explosion and jukebox aux 1005 are not executed.
- Multiplayer: the eye's aux 1002 is not forwarded to other clients.
