Claude handoff, 2026-10-31, version 0.21.0 on main. Pushed with npm run push:github; not published to the Site (the game runs from localhost).

Commits:
- 7590438: sprint, sprint-jump, flight and swim physics (src/player-movement.js, public/research/sprinting.md).
- c774d05: merges work/particles (c2bc00c), the block particles.
- 22f8fd4: merges work/creepers (d423597). Creepers and explosions; TNT is internal 55 (original 46); gunpowder is item 330 (original 289).
- 1a5f3ad: merges work/plants (2569dd5). Adds:
  - cactus, block 53 (original 81);
  - the sugar cane block, 54 (original 83), placed by item 327;
  - paper 328 and sugar 329;
  - falling sand (6) and gravel (25);
  - generation version 8.

Merge fixes:
- The creeper branch's reserved 53/54 placeholders were replaced by the plant blocks.
- The shadow and mining maps include 53:81, 54:83 and 55:46.
- The mining (3,344 cases), shadow and inventory (63/63) references were regenerated.
- Cactus breaks use particles.destroyBlock. The stale effects.burst calls are removed; explosions still have no particles.
- The dev handle window.__mc adds plants, falling, primed, explodeAt and lightTnt.

Tests: 502/502 pass and npm run build succeeds.

Muted browser check, in a new generation-8 world:
- sand and sugar cane generate;
- cane and cactus render;
- a floating sand/gravel column fell and landed stacked;
- the TNT fuse, explosion, crater and drops work;
- the creeper renders;
- no console errors.

Earlier sprint measurements: walk 4.31 b/s, sprint 5.61, flight 10.9; FOV x1.15 sprinting and x1.1 flying.

Remaining:
- explosion particles;
- desert/natural cactus;
- the shared Java generation random for beaches and cane;
- the player's 0.5 step-up and the exact moveEntity sweep;
- ocelots and redstone.

The worktrees worktrees/particles, worktrees/creepers and worktrees/plants can be removed.