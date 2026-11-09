# serverdist2 (batch 32)

## Summary
- C02 use-entity check now covers painting, item frame, minecart, boat, arrow, xp orb, self and mobs: distance (36 seen / 9 unseen), `canEntityBeSeen` (rayTraceBlocks from feet+1.62 to entity posY + g()), and the item/arrow/orb/self attack kick. `serverAcceptsClick` in main.js passes feet position, eye offset and a block-ray sight callback. This also fixes the b31 bug where `aimedEntity.x` was NaN and every mob click was refused.
- Natively `mw.g()` is 1.62 (bytecode-read), so the server's sight ray starts at feet+1.62. `ai.js` PlayerView and `enderman.js` PLAYER_EYE_OFFSET use 0.12 for the server player and look wrong (not edited).
- A real no-sight pick: a cart across a wall corner is picked by the client bounding-box pick (distance 2.72, also in survival reach) while the server has no sight. Replayed in a unit test.
- Dedicated server (`src/multiplayer/simulation.js`, `server/server.js`): edit path applies the C07/C08 gates (`serverClick`), refusals are sent to the player as a chat packet. No server was started.
- Fallen button (77/143) and powered TNT neighbour chains ported in `native-neighbor-world.js` with 262 native cases (`neighbor-chains-reference.json`, probe `NeighborChainProbe.java`), including Random draws.

## Verification
- `npm test`: 4875 tests, 4875 pass, 0 fail. `npm run build`: passed.
- Probes: `MC_RESEARCH=... node tools/verify-server-handlers.mjs` and `tools/verify-neighbor-chains.mjs`.
- Browser (muted headless Chrome, port 5345): a cow attacked at 2 blocks took damage (health 10 to 9), confirming the mob gate. The cart-behind-wall refusal was NOT browser-verified: the harness never produced a cart pick (`aimedCart` null even on open ground); covered by unit tests only.

## Follow-ups (proposed gap lines)
- Mob eye height is approximated as height*0.85 via `brain.eyeHeight`, no per-type overrides.
- Primed TNT from generation callbacks is recorded on `world.primedTnt` only: no chunk persistence, Math.random motion not carried.
- Dedicated server refusal chat packet is untested over a live WebSocket; its test world is 64 high.
- Attacks on item, arrow, orb or self cannot be aimed in play; that kick is replayed only.
- `ai.js`/`enderman.js` use 0.12 as server player eye offset; native is 1.62.
