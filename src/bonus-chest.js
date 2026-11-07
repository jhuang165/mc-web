// WorldGeneratorBonusChest (arg) and WorldServer.createBonusChest (mt.k) from 1.7.10, checked against the unchanged classes in
// public/research/flat-world-reference.json (bonus records). The world is reached through an accessor so the same code runs on
// the live World and on the test column:
//   id(x, y, z)            original block id
//   blocksMovement(x,y,z)  Material.blocksMovement of the block (ahb.i)
//   solidTop(x, y, z)      World.doesBlockHaveSolidTopSurface
//   put(x, y, z, id)       setBlock(x, y, z, block, 0, 2)
//   fill(x, y, z, slot, stack)  one inventory write of the chest at x, y, z
// Randomness: World.rand is `new Random()` in 1.7.10 (no seed), so a native bonus chest differs every time a world is created.
// The game seeds its Random from fresh entropy (unseededBonusRandom); the replay tests inject a fixed JavaRandom into
// createBonusChest instead. Contents, positions and torches are a pure function of that Random, as verified natively.
const AIR = 0, LEAVES = 18, LEAVES2 = 161, CHEST = 54, TORCH = 50;

// WorldServer.U: ChestGenHooks bonusChest contents, [original id, damage, min, max, weight].
export const BONUS_CONTENTS = Object.freeze([
  [280, 0, 1, 3, 10], [5, 0, 1, 3, 10], [17, 0, 1, 3, 10], [275, 0, 1, 1, 3], [271, 0, 1, 1, 5],
  [274, 0, 1, 1, 3], [270, 0, 1, 1, 5], [260, 0, 2, 3, 5], [297, 0, 2, 3, 3], [162, 0, 1, 3, 10],
].map(Object.freeze));
export const BONUS_ROLLS = 10, CHEST_SIZE = 27;

// WeightedRandom.getRandomItem: one nextInt over the total weight.
function pick(random, items) {
  let n = random.nextInt(items.reduce((s, i) => s + i[4], 0));
  for (const item of items) { n -= item[4]; if (n < 0) return item; }
  return items[items.length - 1];
}
// WeightedRandomChestContent.generateChestContents(random, items, chest, 10). Every stack fits its maximum size (<= 3 of
// a 64 stack, or a single tool), so the multi-slot branch never runs.
export function fillBonusChest(random, write) {
  for (let i = 0; i < BONUS_ROLLS; i++) {
    const [id, damage, min, max] = pick(random, BONUS_CONTENTS), count = min + random.nextInt(max - min + 1);
    write(random.nextInt(CHEST_SIZE), { id, count, damage });
  }
}

// ahb.i: the first block from the top whose material blocks movement and is not leaves, plus one; -1 when there is none.
export function topSolid(w, x, z, top = 255) {
  for (let y = top; y > 0; y--) {
    const id = w.id(x, y, z);
    if (w.blocksMovement(x, y, z) && id !== LEAVES && id !== LEAVES2) return y + 1;
  }
  return -1;
}

// arg.a: four tries around (x, y, z), the chest and then torches that all test the solid top below (x - 1, y - 1, z).
export function generateBonusChest(w, random, x, y, z) {
  const soft = (px, py, pz) => { const id = w.id(px, py, pz); return id === AIR || id === LEAVES || id === LEAVES2; };
  while (soft(x, y, z) && y > 1) y--;
  if (y < 1) return false;
  y++;
  for (let i = 0; i < 4; i++) {
    const cx = x + random.nextInt(4) - random.nextInt(4), cy = y + random.nextInt(3) - random.nextInt(3), cz = z + random.nextInt(4) - random.nextInt(4);
    if (w.id(cx, cy, cz) !== AIR || !w.solidTop(cx, cy - 1, cz)) continue;
    w.put(cx, cy, cz, CHEST, 0);
    fillBonusChest(random, (slot, stack) => w.fill(cx, cy, cz, slot, stack));
    // The vanilla bug: every torch asks about (cx - 1, cy - 1, cz), not its own floor.
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      if (w.id(cx + dx, cy, cz + dz) === AIR && w.solidTop(cx - 1, cy - 1, cz)) w.put(cx + dx, cy, cz + dz, TORCH, 0);
    }
    return true;
  }
  return false;
}

// WorldServer.createBonusChest: ten attempts within 6 blocks of the spawn; returns the attempts' coordinates and success.
export function createBonusChest(w, random, spawnX, spawnZ, sink = null) {
  for (let i = 0; i < 10; i++) {
    const x = spawnX + random.nextInt(6) - random.nextInt(6), z = spawnZ + random.nextInt(6) - random.nextInt(6), y = topSolid(w, x, z) + 1;
    sink?.push([x, y, z]);
    if (generateBonusChest(w, random, x, y, z)) return true;
  }
  return false;
}

// A World.rand equivalent: Java's `new Random()` takes a seed from entropy; `entropy()` returns a number in [0, 1) (injectable).
export const unseededBonusRandom = (JavaRandomClass, entropy = Math.random) => new JavaRandomClass(BigInt(Math.floor(entropy() * 2 ** 48)));
