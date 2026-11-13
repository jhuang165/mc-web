# Batch 62 lead (claude-b62-lead), release 0.91.0

Five Sonnet tracks in `../wt62-<name>` on `batch62-<name>`, cut from 0.90.0 (b5be6614f), merged --no-ff on `batch62-lead`. Rules: `../artifacts/b62-lead/track-rules.md`. No browser checks (user request). Four tracks stopped on the API 5-hour limit and were resumed after the reset; their saved work was kept.

Merged (track note `<name>-b62-track.md` each): mpprojectiles d852b009f, singleleft b81512990, mpriding2 dc0c4548a, mpsmall2 c827e0d96 (its worktree had a detached HEAD; the branch was moved to it before the merge), mpnether2 f011e9554.

Conflicts (all kept both sides):
- `server-mobs.js`: `target()` is the tamed animal's owner (mpsmall2), then a lead holder, then a rider (mpriding2). `interact` stamps the taming owner and passes `ride` / `lead` to `serverAnimalUse`. The constructor has both `makeBaby` owner inheritance and `fireballWatch`.
- `simulation.js` `edit()`: thrown items fall through when there is no block target; vehicles and fence knots are Overworld only.
- `server-dispense.js`: mpprojectiles made one object with lanes per dimension; mpnether2 gave the Nether its own instance, swapped in by `dimensions.within`. The lead reconciled them (below).

Lead fixes:
- **The Nether's dispense instance.** It is now a `ServerProjectiles` (bows, throws and witch hooks work for Nether players inside `within`). Each instance's own fields are its dimension's lane, and `lane.world` / `lane.mobs` are getters on every lane, the instance included. `laneFor(dim)` returns the instance itself for its own dimension and the Nether instance once it exists. `snapshot` and `flush` serve only the instance's own dimension (plus a stand-in lane), so a Nether player gets one `dispEnts` per tick and the ids of two instances never mix on a client. Effects without a `dim` count as the instance's dimension.
- **Saved Nether projectiles.** `load` only accepted dims 0 and 1, so a saved Nether lane (dim -1) was dropped; it now accepts -1. A saved Nether lane waits in a stand-in lane until the Nether is built, and then `adopt` moves it to the Nether instance. The Overworld `save` includes the Nether instance's lane.
- **Flaky tests.**
  - mpprojectiles' skeleton test: the skeleton burned in daylight in the open arena and lost its target. A stone roof fixes it (0 of 20 runs failed after, 5 of 20 before).
  - mpnether2's Nether mob test: a baby pigman's chicken jockey (EntityZombie.onSpawnWithEgg) is now an allowed Nether mob.
  - mpriding2's hopper-cart test: Creative keeps its starter hotbar since mpsmall2 retired the input mirror, so the test seeds the held slot.
- `src/b62-lead.test.js`: the Nether instance type, one snapshot per player per dimension, and a saved Nether arrow restored into the Nether instance.

Verification on the merged tree: `npm test` 7399/7399 pass (`../artifacts/b62-lead/npm-test.log`), `npm run build` ok, bridge unittest OK.

Open: see "Still open from batch 62" in `public/research/remaining-gaps.md`.
