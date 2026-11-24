# portals99 (batch 99): rider packets on portal travel, away riding split, lead audit

## Summary
Not full parity; open items at the end.
- `src/multiplayer/server-portal-travel.js`: `unmount` (ridden mob travels) and `unseat` (ridden cart/boat travels) now call `p.vehicles.dismount(pl, true)`, so the player rider gets the native `dismount` message (S08, S1B, S08, from batch 98 horse98). Natively `World.removeEntity` (ahb.e) calls `riddenBy.mountEntity(null)` on the EntityPlayerMP.
- `src/away-entities.js`: `portalTravel` uses `mobLinks` (riding held back, ridden runs the countdown without colliding), like the live tick and the server.
- `src/portals99-b99.test.js`: 2 tests.

## Evidence
- Bytecode-read: `ahb.e(sa)`: `if (sa.l != null) sa.l.a(null); if (sa.m != null) sa.m.a(null)` (rider's mountEntity(null) first, then the entity's own). The packets of `mw.a(null)` for a player: Executed in batch 97 (Kill97Probe dismount97): S08, S1B, S08.
- Away split: Port-read. An away run has no player and starts every `portalCounter` at 0; a ridden or riding mob never collides, so no `inPortal` is set and no mount-after-touch can occur (jockeys exist from spawn). The old and new expressions give the same result in every reachable state; the change is consistency only.
- Leads through portals (item 3): already native, nothing changed. Executed (batch 29 Leads3Probe, batch 97 portals97): the Leash tag crosses the copy; the copy's first leashed tick (sw.bP) keeps a player/mob holder within the 10-block box in the destination and drops the lead otherwise; a knot is found or made at the same saved X/Y/Z. Port-read: server `arrive` + `holderThere`, single player `deliver` (lead item drop when the holder is elsewhere, b94), away deliver passes `leashed`. No divergence found.

## Verification
- `node --test --test-concurrency=2 src/portals99-b99.test.js src/portals98-b98.test.js src/horse98-b98.test.js`: 17 pass.
- With `server-portal-travel.js` reverted: portals99 1 pass, 1 fail.
- 29 test files naming away-entities, server-portal-travel or entity-portal (xargs): 264 pass, 0 fail. No build run (one import added to an existing module).

## Follow-ups
- The client ignores the `dismount` message (b98 open item stands).
- The away `ridden` mob path has no rider drop (unreachable as above).
- Browser-only: nothing seen in a browser.
