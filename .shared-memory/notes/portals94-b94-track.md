# portals94 (batch 94): single-player held leads, reload of port-only mob state, item / orb / cart / boat portal records

## Summary
Not full parity; open items are at the end.
- **Single-player held lead (fixed).** `dimension-live.js deliver` dropped a player-held lead always. It now drops it only when the player is NOT in the destination (`same`); when he is, the record keeps `{ holder: 'player' }` and the copy's first leashed tick (`horse-gear-live.js leashRestore` = sw.bP) keeps or drops it by the 10-block box. The away run uses the same `deliver`, so it follows.
- **Reload of port-only mob state (fixed).** `TRANSIENT_MOB` moved to the new `src/mob-transient.js` (server-portal-travel imports it); `EntityWorld.restore` (`entities.js`) now runs `withoutTransient` first. Server and single player share this restore, so a world load, `/summon` tag and portal arrival all start these fields over. The caller's record is not mutated. Every field in the list was checked against EntityLivingBase / EntityLiving / EntityCreature NBT (Health, HurtTime, DeathTime, AttackTime, ActiveEffects, Attributes, AbsorptionAmount, Equipment, DropChances, CanPickUpLoot, Leashed/Leash, CustomName, PersistenceRequired, Age, InLove): none is written. Saved fields (hurt, attackTime, fire, fall distance, love, growingAge) are untouched.
- **Items (fixed).** EntityItem writes only Health, Age, Thrower, Owner, Item. The port's portal record carried `delay` (pickup delay, xk.b) and `hover` (xk.c): the copy now starts with delay 0 and a fresh hover (`entity-portal.js entityDeparture`, both single player and server). Age, Health, Thrower, Owner kept (already right).
- **OnGround (fixed).** Entity.writeToNBT / readFromNBT carry OnGround and sa.b(I) never writes it, so the copy keeps the flag; the port forced `onGround: false` for orbs, carts and boats (both paths). Removed.
- **Orbs, carts, boats: audited, otherwise native.** Orb Health (short, read & 255), Age, Value are kept. Boats have no NBT of their own, so damage / hit time / forward direction are correctly not carried. Carts carry contents, fuse, fuel, push, hopper state and CustomName; rolling amplitude, damage and hit direction are not saved natively and are not carried.
- Files: `src/mob-transient.js` (new), `src/entities.js`, `src/entity-portal.js`, `src/dimension-live.js`, `src/multiplayer/server-portal-travel.js`, `src/portals94-b94.test.js` (new).

## Evidence
- **Bytecode-read:** `xk.b(dh)` / `xk.a(dh)` (EntityItem): Health (i2b i2s; read & 255), Age, Thrower, Owner, Item; field `b` (delay) never written to NBT. `sq.b(dh)` (orb): Health, Age, Value as shorts. `sa.b(int)`: no OnGround write. Predecessor evidence for sa.a(sa, boolean), sw.bP (portals93 note).
- **Port-read:** which fields the port's save records hold (`item-entities.js serializeOne`, `boats.js`, `minecarts.js`), and that `serialize()` writes whole records so a reload kept the transients.
- **Not Executed:** no new probe; the field lists come from bytecode only.

## Verification
- `node --test --test-concurrency=2 src/portals94-b94.test.js`: 5 pass. Reverting the four source files (dimension-live, entities, entity-portal; mob-transient stays) leaves 1 pass (the unchanged drop case) and 4 fail.
- Regression run: 105 test files (every test naming dimension-live, entity-portal, server-portal-travel, portals9x, away-entities/world/trip, mobs restore / serialize, entnbt, mobrec, spcopy), `xargs node --test --test-concurrency=2`: 1094 pass, 0 fail. `npm run build` once (a new module was imported): built.

## Found wrong in the batch 93 list
- "ServerMobs.restore keeps the transients": the server has no restore of its own; it uses `EntityWorld.restore`, so the fix is shared with single player.
- "Items, orbs, carts, boats: records are NBT-shaped": mostly, but items carried `delay` / `hover` and orbs, carts, boats were forced `onGround: false`.

## Follow-ups (still open)
- Item `load()` still reads the browser save's `delay` (a reload natively gives 0); only the portal path was changed. `hover` and `delay` are browser-save fields.
- The away run's end state is restored through `restore`, so its mobs also start these transients over when the world is rebuilt (native would keep them while chunks stay loaded).
- Cart NBT per subtype (spawner, command block, hopper) was not re-read field by field.
- Browser-only: seeing a lead hold across an End portal in single player; an item arriving pickable at once.
