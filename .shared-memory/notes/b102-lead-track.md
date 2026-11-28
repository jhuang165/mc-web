# b102 lead track (batch 102, 2026-11-28)

Lead branch `batch102-lead` in `../wt102-lead`, cut from 5b89c24c3. Released as 0.131.0. Does not claim full parity.

## Merges
abilities102, mpperf102, spcopy102, mpobjects102, credit102, horse102, console102 (conflict with horse102 resolved: a same-dimension respawn's S08 is counted once, in console102's `abilities` respawn records; horse102's `posLook` carries `inRespawn` and counts nothing), tiles102, mobrec102, entnbt102. Four tracks (tiles102, entnbt102, mobrec102, and earlier console102/credit102 on sleep) were resumed after a usage limit or Mac sleep.

## Verification
One full `npm test` on the merged tree: 11132/11137. Failures and fix bf8d5c024:
- `mpnether3-b63`, `mpwither-b64`, `multiplayer.test.js`: harnesses never sent the C06 for an S08, so horse102's gate dropped their movement input; tests now ack.
- `offline87-b87`: the new `posLook` kind maps to S08PacketPlayerPosLook.
- `serverbroadcast-b58`: /tp's look is now a `posLook` message, and the game mode line is printed by the client (abilities102).
- Gate loosened: the held slot (C09) and steer (C0C) still apply while an S08 waits.
Then those files plus 167 neighbour tests rerun ok. `npm run build` ok, bridge tests 5 ok. Logs in `../artifacts/b102-lead/`. No browser checks.

## Review notes
- horse102's gate drops controls and look for up to 40 ticks if a client's C06 is lost; the browser client acks welcome, `dimRespawn`, `posLook` and each `dismount` S08.
- mobrec102 sets `survival.deferCounters` in `main.js` (code-read only); spcopy102 and abilities102 `main.js` tokens are code-read only.
- abilities102 edited `cmdblock83-b83`; horse102 edited `abilities100-b100`, `console88-b88`, `console89-b89`; console102 edited one line of `console101-b101`.
- entnbt102 adds a 513 KB reference (`entnbt102-reference.json`).

## Open
"Still open from batch 102" in `public/research/remaining-gaps.md`.
