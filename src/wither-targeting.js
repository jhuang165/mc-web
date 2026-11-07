// EntityWither.updateAITasks (xc.bn) head loop, pure: the per-head timers, the random shots, the shot at an existing head target and the
// candidate search. Replayed against public/research/wither-targets-reference.json (tools/probes/WitherRound3Probe.java, the unchanged
// xc.bn on real Chunk lists). wither-boss-mobs.js supplies the engine callbacks (`io`).
//
// Order of entity Random draws per head i (1 and 2), as native: nextInt(10) for the next timer; on Normal/Hard the random shot (counter bu
// above 15) draws three nextDouble (x, y, z) through qh.a(Random, min, max); a held target draws nextInt(20) when it is shot at; a head
// without a target draws nextInt(poolSize) per try (up to 10 tries, each failed candidate is removed from the list).
// The launch head index is i + 1 (2 and 3): native quirk, head 3 sits where head 1 does.
export const range = (rand, min, max) => (min >= max ? min : rand.nextDouble() * (max - min) + min);

// World.getEntitiesWithinAABB(EntityLivingBase, box.expand(20, 8, 20), attackEntitySelector), in the engine list order the caller gives
// (`order` sorts it into the chunk/slice walk). `overlaps(c)` is the box test, `undead(c)` the selector (xd: creature attribute != UNDEAD).
export function witherPool(candidates, { overlaps, undead, order = (l) => l }) {
  return order(candidates.filter((c) => overlaps(c) && !undead(c)));
}

// One xc.bn head pass. `s` = { bt: [n, n], bu: [n, n], heads: [_, a, b] } (heads[i] the held target or null); returns nothing, mutates `s`.
// io: pos {x, y, z}, difficulty, pool() fresh candidate list, alive(c), near(c) (distance squared <= 900), sees(c), isPlayer(c),
// creative(c) (abilities.disableDamage), self(c), launchCoords(head, x, y, z), launchEntity(head, c).
export function headPass(s, rand, ticks, io) {
  for (let i = 1; i < 3; i++) {
    if (ticks < s.bt[i - 1]) continue;
    s.bt[i - 1] = ticks + 10 + rand.nextInt(10);
    if (io.difficulty === 2 || io.difficulty === 3) {
      if (s.bu[i - 1]++ > 15) {
        const x = range(rand, io.pos.x - 10, io.pos.x + 10), y = range(rand, io.pos.y - 5, io.pos.y + 5), z = range(rand, io.pos.z - 10, io.pos.z + 10);
        io.launchCoords(i + 1, x, y, z);
        s.bu[i - 1] = 0;
      }
    }
    const held = s.heads[i];
    if (held) {
      if (io.alive(held) && io.near(held) && io.sees(held)) {
        io.launchEntity(i + 1, held);
        s.bt[i - 1] = ticks + 40 + rand.nextInt(20);
        s.bu[i - 1] = 0;
      } else s.heads[i] = null;
    } else {
      const list = io.pool();
      for (let tries = 0; tries < 10 && list.length; tries++) {
        const c = list[rand.nextInt(list.length)];
        if (!io.self(c) && io.alive(c) && io.sees(c)) {
          if (io.isPlayer(c) && io.creative(c)) break; // disableDamage ends this head's search without a target
          s.heads[i] = c;
          break;
        }
        list.splice(list.indexOf(c), 1);
      }
    }
  }
}
