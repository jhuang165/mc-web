# portals93 (batch 93): leads and non-NBT mob state across the dedicated server's portals

## Summary
Not full parity; open items are at the end.
- **Knot-held lead (batch 92 follow-up): found already native, not a gap.** The arrival record keeps `leash: { knot: {x, y, z} }` (only a player holder was cleared), and the copy's first leashed tick (`horse-gear-live.js leashRestore`, = sw.bP) makes the knot in the destination at the SAME saved X/Y/Z (no scaling), then the distance rule applies. So a knot within 10 blocks of the arrival keeps the lead; any other drops it on that tick, with the knot still made. The batch 92 line "a lead held by a knot does not re-attach" is wrong. New test locks both outcomes (it passes without a code change).
- **Player holder (fixed).** Natively the copy looks its holder up by UUID among living entities in the 10-block box around the copy (sw.bP), so a holder who stands in the destination within reach keeps the lead; the port always dropped it. `server-portal-travel.js` now keeps the lead when the holder player is in the destination dimension within that box (`holderThere`), puts the server `holderId` back on the restored record (`gearFieldsFrom` keeps only `{holder: 'player'}`), and drops it as before otherwise.
- **Non-NBT mob state (fixed).** Native `copyDataFrom` moves NBT only. `ServerMobs.restore` spreads the record, so port-only transients crossed the portal. `TRANSIENT_MOB` (age, idle, revenge, burn, mateTicks, collidedH, inLava, moveForward, jumping, jumpTicks, livingSoundTime, home, homeRadius, leashHome, lastDamage, attack, flee, wolf shake / wet, enderman stare / chase, climbing, slime wasOnGround, ocelot sneaking / sprinting, limb and body animation fields, stepDistance) is dropped from the record in `arrive`, so `restore` supplies the created defaults. Saved state stays (HurtTime, AttackTime, InLove, Age, Fire, FallDistance, Rotation, the cooldown, equipment, effects, UUID). AI brain, navigator target and tracker `known` were already fresh (new object).
- Files: `src/multiplayer/server-portal-travel.js` (edit), `src/portals93-b93.test.js` (new).

## Evidence
- **Bytecode-read:** `sa.a(sa, boolean)` (copyDataFrom): `old.e(nbt); this.f(nbt); this.am = old.am; this.aq = old.aq` (cooldown and teleport direction only); no override in sw, td or sv. `sw.bP`: UUIDMost/Least -> any `sv` of that UUID in the box `C.expand(10, 10, 10)`; else X/Y/Z -> `su.b(world, x, y, z)` or `su.a(...)` (a knot is made with no fence check); a tag with neither drops via `a(true, true)`.
- **Executed (batch 29, `public/research/leads3-reference.json` leadDimension, Leads3Probe: copyDataFrom then the clone's first sw.bL):** knot holder, absent: leashed, `knots: 1`, `knotAt [3,0,0]`; player or mob holder: kept at 3 blocks, dropped when absent, at 10.5 or 12 away.
- **Port-read / port-run:** the new test drives `ServerDimensions` with a real Nether (flat floor, frames both sides).
- **Not Executed:** no three-world MinecraftServer harness was built (travelToDimension itself, the Teleporter against a live world). The parts used here are already executed: copyDataFrom field set (leads3, entnbt89), bP knot / holder lookup (leads3), Teleporter placement (entity-portal-probe). What remains port-read: that the server's walk order lets a holder who travels in the same tick be in the destination when the copy first ticks.

## Verification
- `node --test --test-concurrency=2 src/portals93-b93.test.js`: 4 pass. Without the source change 2 fail (player holder in reach, transient state); the two knot tests pass either way, which is the finding.
- `node --test --test-concurrency=2 src/portals92-b92.test.js src/portals93-b93.test.js src/leads3.test.js src/leads2.test.js`: 32 pass.
- `src/entnbt91-b91 entnbt92-b92 mpcadence72-b72 mpnether-b61 sptrack87-b87 tiles87-b87 track88-b88 tiles89-b89 tiles88-b88` (those naming server-dimensions / netherMessage): 71 pass. No build run (no import changed).

## Found wrong in the batch 92 list
- "A lead held by a knot does not re-attach / is not modelled": wrong, see above (the record kept the knot; leashRestore re-makes it; the drop on a far knot is native).

## Follow-ups (still open)
- `ServerMobs.restore` keeps the same port-only transients on a world reload (a chunk load natively also starts them over); out of this track's scope (mob records), only the portal copy is cleaned.
- Single-player `dimension-live.js deliver` has the same player-holder-in-destination case (not changed here).
- Items, orbs, carts, boats: not audited field by field (their records are NBT-shaped).
- Browser-only: seeing a lead hold or drop on a live server.
