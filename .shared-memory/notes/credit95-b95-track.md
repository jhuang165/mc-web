# Batch 95 credit95: PvP victim's held Thorns, mob-on-mob Thorns

## Summary
- **PvP (server-pvp.js, survival.js).** `Survival.thorns` takes `byPlayer` and adds the held item (`inventory.held`, native `be()`) after the armour. `ServerPvp.attack` passes `byPlayer: true`. A player's `ak()` is armour only, so for a player victim the held item is visited once (not twice as for a mob, whose slot 0 is already in `ak()`); before, a held Thorns item on a PvP victim never rolled.
- **Mob-on-mob (entities.js `hitMob`).** After the knockback and Fire Aspect and before the Bane roll, a landed hit on a mob with equipment runs `thornsOfVictim(target)` on the attacker (one visit, the attacker is not a player); the thorns damage goes through `attackEntityFrom(attacker, n, {name: "thorns", attacker: target})` and `damage.thorns` plays at the attacker. Wolf, slime, magma cube, iron golem, ocelot and snow golem (`NO_THORNS_ATTACKER`: their attackEntityAsMob does not call yg.n) skip it; `hitMob` is also what the ocelot AI calls. `hitMob` is shared by single player and the server.
- Tests: `src/credit95-b95.test.js` (3).

## Evidence
- **Bytecode-read:** afv.a(sv, sa) (`aload_1 instanceof yz` then `victim.be()`), yg.n order: knockback, setFire, `instanceof sv` -> afv.a(target, this), afv.b(this, target).
- No probe: the real classes need a live world and EntityPlayerMP; not executed.

## Verification
- `node --test --test-concurrency=2 src/credit95-b95.test.js`: 3/3 pass; with the three source files reverted 1 pass / 2 fail (the ocelot guard test passes either way).
- Neighbour run (23 files naming thorns, hitMob, ServerPvp or attackMob): 23 files, `--test-concurrency=2`: 171 tests, 171 pass.
- No browser, no full `npm test`, no build (no import changes).

## Found wrong in the batch 94 list
- "Second Thorns visit" for a PvP victim: natively the held item is the player's only visit via `be()`; the port ran none.

## Follow-ups
- **Stashed thrower after a reload: left open.** A stash record and a disk save share `serialize()` and the shelf write path (`world-storage.js writeWorldShelf` with split runtime snapshots); stripping `ownerBody` for disk only would touch that pipeline and `main.js` (not importable in node), so it is not narrow. Natively an in-session stash keeps the body; only a disk reload looks the thrower up by name.
- Browser-only: nothing checked.
