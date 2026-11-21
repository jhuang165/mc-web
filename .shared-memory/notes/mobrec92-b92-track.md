# Batch 92 mobrec92: ticked slime and magma cube children, snow golem, witch and blaze records (executed)

## Summary
- `public/research/enderman-wolf-b92mr-reference.json` (1.9 MB) holds 15 executed records (the b91mr harness plus row element 12, one row per split child, and `kids` = each child's constructor jump delay). All 15 replay with no divergence.
  - split children (iron golem and player kills): `golem-slime2-9401`, `golem-slime4-9403`, `golem-magma2-9404`, `golem-magma4-9405`, `player-slime2-9411`, `player-slime4-9412`, `player-magma2-9413`, `player-magma4-9414`;
  - snow golem against: `snow-spider-9421`, `snow-silverfish-9422`, `snow-witch-9423`, `snow-slime2-9425`, `snow-magma2-9426`, `snow-cave-9427`; iron golem against a blaze: `golem-blaze-9431`.
- `tools/probes/EndermanWolfProbe.java`: mode `b92mr` (implies `b91mr`; existing sets are unchanged). After the `ents` loop it adopts every `ym` the world spawned (a split child), gives it a logging `Entity.rand`, and ticks it like World.updateEntities does (the list grows, a child updates in the pass that spawned it); row element 12 holds `[x,y,z,health,target,revenge,size,draws,motion...]` per child.
- `tools/probes/EndermanWolfScenarios.java`: `run92()`. `tools/verify-endermanwolf.mjs`: set `b92mr`, count assert (15), method text.
- `src/enderman-wolf-replay.js`: `reference92`; `probeFixedList` is off for `b92mr` only (the older records keep it on); an `entitySeed` hook seeds each child's `Entity.rand` and jump delay from the record; the `b92mr` rows compare element 12; snowballs and potions share one launch-ordered list in row element 9; potions fly in this set; a splash-break sound is the client's.
- `src/entities.js` (port fixes): a split child starts with `renderYawOffset` 0 (was the parent's yaw); in `push` and `push87` the server copy pushes at its own place in the list (`afterPlayerSlot`), not always last.
- `src/projectiles.js`: `mobTargets` uses the slime and magma cube size (`0.6 * size`) for the entity box; before, every size used the size 1 box, so a snowball or arrow passed through a size 2 or 4 slime.
- `src/witch-potions.js`: a witch whose target is a mob (a snow golem) reads that mob's health and effects for the potion choice (before: health 20, no effects, so it threw slowness again).
- `src/combat.js`: a size 1 slime dropped item 341, this build's Water bucket; it now drops the Slimeball (460). `src/slime.js` still reports 341 (the id of `slime-reference.json`).
- `src/mobrec92-b92.test.js`: 22 tests.

## Evidence
- Executed: all 15 records (child body yaw 0 at adoption; list order of child pushes against the player; slimeball drop id in the death events; snowball strike on a size 2 slime at y 1.36; the witch's second throw is 32732 once the first slowed the golem; potions and snowballs in one launch order).
- Bytecode-read: `sa.applyEntityCollision` (formula already matched; order is the list order).
- Port-read: the 341 versus 460 id mapping (the probe record shows the drop; the item table was read in the port).

## Verification
- `node --test --test-concurrency=2 src/mobrec92-b92.test.js`: 22 pass, 0 fail. With the four port files reverted (entities, combat, projectiles, witch-potions) it fails 16 of 22 (checked once).
- Regression: `node --test --test-concurrency=2` over the 130 test files that import or name `entities.js`, `combat.js`, `projectiles.js`, `witch-potions`, `slime`, `mobTargets`, `enderman-wolf-replay`, `mobpush`, `serverplayer`: 4465 tests, 4464 pass, 1 fail on the first run (`src/mpperf87-b87.test.js` mobTargets record identity: my first slime branch built a fresh record per call). Fixed by passing the slime box size through the cached paths (`mobTargetAt`, `mobTargetAt88`); the projectile/mobTargets/replay-related files (1193 tests) then pass, 0 fail. The remaining 123 files were not re-run after that one-function change.
- `npm run build`: succeeded (one run).

## Old test edited
- `src/slime-world.test.js`: the slimeball id check is 460 (was 341). The old value encoded this build's Water bucket id, not the Slimeball.

## Found wrong in the batch 91 list
- "Splitting is port-read only; the probe keeps children static": right, and now closed for sizes 2 and 4 (golem and player fights). The port also differed in three ways the list did not name (child body yaw, drop id, push order).
- Not wrong: the b39 split-draw records still pass.

## Follow-ups
- Not added: zombie villager conversion and chicken jockey already have executed records (b36, b37, b85 to b87 village fights); the zombie pigman and giant snow-golem fights and a second golem-blaze seed were dropped to keep the JSON under 2 MB.
- Mob kinds still without a per-tick native record here (not checked against every reference file): squid, bat, wither skeleton and the wither boss.
- Browser only: how a split child looks and sounds, snowball and potion trails.
