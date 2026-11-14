# Batch 71 mpcapes71: cape upload, wire and Show Cape

## Summary
- `server/accounts.js`: optional account cape (`cape`, `capeHash`, `capes` map, `setCape`/`clearCape`), validated like skins: 64x32 PNG, at most 16 KB. `public()` returns `cape` (hash).
- `server/server.js`: `PUT/DELETE /api/cape`, `GET/HEAD /api/capes/<hash>.png`; `refresh` and `addPlayer` pass the cape hash; message `capeSettings {show}` calls `setCapeShow`.
- `src/multiplayer/cape-wire.js` (new): `capeFields` (presence row `cape`, `hideCape` only while true) and `setCapeShow`.
- `src/multiplayer/simulation.js`: `addPlayer(..., {cape})`, presence rows spread `capeFields`.
- `src/multiplayer/presence.js`: `cape(hash)` loader, `applyCape(renderer, hash)` -> `PlayerRenderer.setCape`; `hideCape` read from the row.
- `src/multiplayer/client.js`: `capeSettings(show)`. `src/main.js`: capeUrl for `RemotePlayers`, `capeSettings` at join and in `saveOptions`, local body cape from `self.cape` (F5), local `hideCape` from `options.showCape`, cape reset on leaving.
- `src/multiplayer/account-api.js`, `screen.js`: `uploadCape`/`clearCape`/`capeUrl`; profile screen got Choose PNG Cape / Save Cape / No Cape. `src/skin.js`: cape constants and `capeCanvas`.
- Show Cape button enabled (`menus.js`); settings catalogue regenerated; `cape-ears.md`, `chat-options.md` updated.
- New wire names: `capeSettings` (client to server), row fields `cape`, `hideCape`.

## Evidence
- Bytecode-read (from the b70 note): C15 showCape -> EntityPlayerMP hide-cape flag (watcher 16 bit 1) -> `getHideCape` skips the cape for every viewer. Not re-read this batch.
- Executed: node tests only (account validation, wire round trip, flag).
- Recalled: native cape texture is a 64x32 image; the 16 KB limit is reused from skins.

## Verification
- `node --test src/mpcapes-b71.test.js`: 5 pass. With `src/accounts.test.js src/catalogue-consistency.test.js src/content-catalogue.test.js src/chat-options.test.js src/menu-screens.test.js src/cape-b70.test.js src/player-renderer.test.js src/player-throw-replay.test.js`: 64 pass total.
- `npm run build` ok. Full npm test not run (batch rule). No browser check; only a browser would show the cloak drawing, the profile screen layout and the file pickers.

## Follow-ups
- Single player has no accounts, so no cape is chosen there; the Show Cape option does hide the local cape, but no texture source exists offline.
- The server broadcasts `capeSettings` only as a hide flag; a native client also sends it with other C15 fields (language, view distance), not ported here.
