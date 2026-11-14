# Batch 73 sounds73: sound event audit

## Summary
- `tools/build-sound-events-reference.mjs` (new) and `public/research/sound-events-reference.json` (new): every sound-like string constant in the 1.7.10 client (300 rows, 186 names), with class, SRG method, consuming call, volume/pitch instructions and aux case ids; the `Block.SoundType` names (10 rows); sounds.json events (229) and the ones no class names (56).
- `src/player-edit-simulation.js`: cake slice no longer plays `random.eat`; the two cauldron `liquid.splash` sounds removed.
- `src/player-item-use.js`: single-player `random.burp` gets pitch `rand * 0.1 + 0.9` (was 1). `src/player-item-use.test.js` follows.
- `src/multiplayer/server-dispense.js` `hitPlayer`: the arrow ding `random.successful_hit` (0.18, 0.45) goes to a player shooter whose arrow hurt another player; `src/main.js` `MP_SOUNDS` gets the name (one line).
- `src/sounds73-b73.test.js` (new, 7 tests); `public/research/sound.md` "Batch 73" section.

## Evidence
- bytecode-read: all of the above from `javap -c -p -s` on the unchanged jar (SHA-1 e80d9b3b). `BlockCake` (aju) and `BlockCauldron` (ajw) have no sound constants (only texture names). `ItemFood.onEaten` burp `0.5f, rand*0.1f+0.9f`. `EntityArrow.onUpdate` (zc) offset 1103-1163: shooter != null, hit entity != shooter, hit is EntityPlayer, shooter is EntityPlayerMP: S2B(6, 0). `NetHandlerPlayClient.handleChangeGameState` plays it at (posX, posY + getEyeHeight, posZ), 0.18, 0.45.
- bytecode-read / downloaded: sounds.json (SHA-1 fce0bb3e, fetched from resources.download.minecraft.net and hash-checked; the generator also reads the launcher's assets/objects). Witch: `mob.witch.*` are returned by `EntityWitch` but are not in sounds.json, so natively silent; nothing to add. Slime: `EntitySlime` plays `mob.attack` (volume 1, pitch `(r - r) * 0.2 + 1`, as the port computes), not sounds.json's `mob.slime.attack`; no such event, so silent (the gap line is right, and it is correct that it is silent). Also silent natively: `damage.thorns`, `mob.chickenplop` (horse chest).
- Gap "cake `random.eat` unverified": found wrong in the port; native cake eating is silent.
- Aux 1011 (`mob.zombie.metal`) is only in RenderGlobal's switch; no class sends 1011 (no `sipush 1011` outside it).
- Not executed (no Java probe): the scan reads bytecode text only.
- recalled: nothing.

## Verification
- `node tools/build-sound-events-reference.mjs` (regenerates the JSON).
- `node --test src/sounds73-b73.test.js`: 7 pass. `node --test src/player-item-use.test.js src/cakefog-b72.test.js src/stems-cake.test.js src/mpeating-b58.test.js src/mpclientanim-b64.test.js src/media.test.js src/audio4.test.js`: pass. 13 test files importing `player-edit-simulation` or `server-dispense`: 126 pass.
- `node --check` on touched files. `npm run build`: see the final report. Full npm test not run (batch rule).

## Follow-ups
- The scan only sees constants. Names built at run time (`mob.horse.` + type, `note.` + instrument, `fireworks.` + kind, `step.`/`dig.` + SoundType name, `records.` + name) are listed as prefix rows, not expanded.
- Volume/pitch were compared by hand only for the fixed call sites (burp, ding); a mechanical table of `args` against every port site is not done.
- The ding needs a browser or two clients to hear; only the server hook is tested. `y` uses feet + 1.74 (client posY 1.62 plus `getEyeHeight` 0.12).
- Mob hurt/death/living sounds were not compared again here (`mobsounds-reference.json` covers them).
