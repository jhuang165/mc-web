# Batch 72 spcapes72: single-player cape source

## Summary
- `src/sp-cape.js` (new): `SpCapeStore` (localStorage key `blockworld.cape`, base64 PNG; `get`/`set`/`clear`, a `tag` that changes with each change), `applyLocalCape(renderer, store, load)` (sets or clears `PlayerRenderer.setCape`, keyed through `renderer.capeHash` as `local:<n>`), browser helpers `capeTexture` and `chooseCapeFile` (file picker).
- `src/skin.js`: `capePngError(bytes)`, the single cape check (64x32 PNG, at most 16 KB). `server/accounts.js` `setCape` now calls it, so server and single player validate identically.
- `src/menus.js`: Chat Settings screen gets "Cape File..." and "No Cape" buttons right of Show Cape (only when the context offers `chooseCape`) and a status line. Native widgets keep their layout.
- `src/main.js` (three short hooks, each marked b72 spcapes): module-level `spCapeStore`, menu context `chooseCape`/`clearCape`/`hasCape`, and `if (!multiplayer) applyLocalCape(...)` before `playerRenderer.update`.
- Show Cape still hides it (`hideCape: options.showCape === false`, b71).
- Online the account's cape wins: the offline call is skipped while `multiplayer` is set and b71's `applyCape(self.cape)` replaces the local tag; with no account cape, no cape shows online. Leaving resets the cape and the offline one returns.
- `tools/build-settings-catalogue.mjs` SHOW_CAPE row updated, catalogue regenerated.
- No local skin choice exists in single player, so there was nothing to mirror; the cape store is new.

## Evidence
- Executed: node tests only (validation, store round trip, apply/replace/clear, return after online, hide rule).
- Recalled: 64x32 cape layout and 16 KB limit (b71).

## Verification
- `node --test src/spcapes72-b72.test.js`: 4 pass. With `src/mpcapes-b71.test.js src/accounts.test.js src/chat-options.test.js src/menu-screens.test.js src/cape-b70.test.js src/catalogue-consistency.test.js src/content-catalogue.test.js src/settings-catalogue.test.js`: 52 pass.
- `node --check` on touched files ok. Full npm test not run (batch rule).
- Only a browser would show: the file picker, button placement and status text on the Chat Settings screen, the cloak look in F5, localStorage persistence across reload.

## Follow-ups
- No local skin choice offline yet (same store pattern would fit).
- localStorage keeps the cape per browser profile, not per world.
