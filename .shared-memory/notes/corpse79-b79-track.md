# Batch 79 corpse79: right clicks on dying mobs, multiplayer client pick, knot box

## Summary
- Every dying mob is now picked by the view ray (single player `entities.js pick`, multiplayer client copies `remote-mobs.js pick`), not only a leashed one. The ender dragon keeps the old rule (its own 200-tick death), left open.
- Interactions on a corpse follow native: a lead ties an unleashed corpse (b78 already freed/re-tied leashed ones), a name tag names it (`horse-gear-live.js nameTagUse`), a saddle goes on a pig (`pig-saddle-live.js saddleUse`), shears, dye, wheat feeding, spawn egg, bucket on a cow, flint on a creeper run. Single player (`player-edit-simulation.js`, `buckets-simulation.js`, `entities.js`), server (`ServerMobs.interact` no longer short-circuits corpses; `animal-use.js`, `server-use-entity.js`) and the client prediction (`predictAnimalUse`, `predictEntityExtras`) all agree.
- Still refused on a corpse, as native: villager trade (`villagerInteract` has `health > 0`, native `EntityVillager.interact` tests `isEntityAlive`). Attack on a corpse is a swing that does nothing (`EntityWorld.attack` returns false), and it still blocks digging because the corpse is the aimed entity.
- Knot box: the host-less box (`liveKnotBox`, used by the server) now is the client copy's: a summoned knot is aimed at on its floored tile + 0.5 (the rule object-tracker.js already applies to the copy), a placed knot at its block centre (already the same).
- Tests: `src/corpse79-b79.test.js` (5). Updated old-gap tests: `buckets-simulation` and `spuseorder76-b76` (dying cow is milked), `mpclicks76-b76` (dying creeper takes flint), `knot-splash-b50` (summoned knot box now at tile + 0.5, two ray heights).

## Evidence
- Bytecode-read (javap -c -p, whole jar): `yz.q` = `sa.c(yz)` then `add.a(yz, sv)`; `sw.c` (EntityLiving.interactFirst) no health test. Mob `a(yz)` overrides: `rx` (egg), `wf` (feeding), `wh` (cow bucket), `wm`, `wo` (pig mount), `wp` (sheep shears), `xz` (creeper flint), `wn`, `wv`, `wi` read no isEntityAlive; only `yv` (villager) calls `Z()` = `!isDead && health > 0`. Item `acj` (dye), `adm` (name tag), `adt` (saddle): no health test. `sv.a(ro, F)` sets `aU = 0` then returns false for `aS() <= 0`.
- Bytecode-read: `su(ahb, x, y, z)` = `ss(world)` (setSize 0.5, 0.5), field tile set, `setPosition(x + 0.5, y + 0.5, z + 0.5)`; `su.a(int)` (setDirection) is empty; no override of setPosition in `ss`, so the box is the 0.5 cube from the position up.
- Port-read: the tile of a summoned knot's client copy (`object-tracker.js` line 575 `Math.floor`, `spawnHanging` truncation); not re-executed. A negative command position may differ by truncation toward zero (Java `(int)`) versus floor; unprobed.

## Verification
- `node --test src/corpse79-b79.test.js`: 5 pass; the same tests fail against the unpatched sources.
- Targeted: 42 files that call pick, interact, nameTagUse, saddleUse, shear, dye, feed, spawnEggBaby, milkCow, predictAnimalUse or RemoteMobs (451 tests) plus mpadventure78, mpknots77, knot-splash-b50, leads2/3, leash, horse-gear, mpclicks, mpusesweep, spuseorder76: all pass after the updates above. No full npm test, no browser.

## Follow-ups
- Left gated on a corpse (own live tests, native does not gate them): wolf and ocelot interact (a heal could revive; native `heal` ignores health <= 0), horse interact, mooshroom shears (the cow would inherit health 0), pig mount, zombie cure. Dragon corpse pick.
- `main.js` keeps a live-position fallback box for a knot the tracker does not follow yet (lambda at `mobs.knotBoxOf`); not changed.
- The server pick for an entity the server ray tests is still the live box of a mob; only the knot has a copy-based box there.
