# serverchecks3 (batch 34)

## Summary
- C02 in the browser (boats, paintings, item frames, minecart): a click through a wall is refused and an open click lands for all four kinds. No divergence found. Script and output: `artifacts/b34-serverchecks3/entity-c02.mjs` and `entity-c02.json`.
- Dedicated server refusal over a live WebSocket: a refused C08 placement now sends the clicker the two S23 resends (clicked cell and face neighbour), and the `build.tooHigh` chat at y255. Server sends a `blocks {changes}` message to the clicker only. A refused C07 dig is silent natively (bytecode-read `NetHandlerPlayServer`) and is not reachable over this protocol. Repeatable script: `artifacts/b34-serverchecks3/refusal-live.mjs` (server on 127.0.0.1:5375), test `src/multiplayer-refusal.test.js`.
- 64-change chunk resend (bytecode-read `PlayerManager$PlayerInstance.sendChunkUpdate` and `flagChunkForUpdate`): under 64 distinct cells per chunk go as S23/S22, 64 or more as a chunk packet with a section mask. Ported as `splitChanges` in `src/multiplayer/protocol.js` (the track raised PROTOCOL to 3; the lead kept 2, which the gun branch's 3 would collide with, and made chunk packets opt-in with `chunks: true` at join, 12aeb027b), tested at 1, 2, 63, 64 and 65. The client expands `chunks` back to cells.
- `EyeHeightProbe` now builds real constructors (95 of 95, 0 allocated), including `EntityHorse`, `EntityPlayerMP`, client players and particles, on the probe world doubles. Horse needs an empty `en_US.lang` on the class path (the verify script writes it). Record: `public/research/eye-height-reference.json`.
- Weather mood player: the code was wrong, not just the comment. Native `EntityPlayerMP` sets yOffset 0 (bytecode-read constructor), so its posY is the feet, and `World.getClosestPlayer` and the light-check offsets use posX/posY/posZ directly. `main.js` passed feet + 1.62; it now passes the feet. `cave-ambience.js` already documented feet.

## Verification
- Focused: `node --test src/multiplayer-refusal.test.js` 4 of 4, `src/eye-height.test.js` 8 of 8, `src/sound.test.js` and `src/music.test.js` 18 of 18 after the mood fix.
- Live socket run `refusal-live.mjs` exit 0, all checks true. Browser check muted headless Chrome with `?silent`.
- Full `npm test` and `npm run build`: see the final message to the lead.

## Follow-ups (proposed gap lines)
- Protocol stays 2: a client that joins without `chunks: true` gets chunk resends expanded to cells by the server (`expandChunks`).
- S21 resend sends the whole column's runs but applies only the masked sections; no tile entity data on the dedicated protocol.
- Slime and magma cube probe sizes are random draws; the probe now resets the Random per class, so those two records changed (size 2.4, eye is still height*0.85).
- The eye probe still runs on world, server and network doubles, not a real server.
- A refused C07 dig has no live-socket check because it is silent natively.
