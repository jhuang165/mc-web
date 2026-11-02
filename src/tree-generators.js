// Minecraft Java 1.7.10 worldgen tree generators: WorldGenTrees (asq), WorldGenBigTree
// (ard), WorldGenForest (are), WorldGenSwamp (aso), WorldGenTaiga1 (asf), WorldGenTaiga2
// (asn), WorldGenHugeTrees (asb) with WorldGenMegaJungle (arz) and WorldGenMegaPineTree
// (asa), WorldGenShrub (arp), WorldGenSavannaTree (ask), WorldGenCanopyTree (asi), plus
// WorldGenBigMushroom (aru) and the BiomeGenBase tree/grass pickers. Original numeric IDs.
// World adapter: getBlock(x,y,z), setBlock(x,y,z,id,meta,flags) and isOpaqueCube(id).
// isAirBlock is a block read of 0. Generators keep native per-instance state:
// WorldGenBigTree reuses its first height limit on every later generate call.
import { mhSin, mhCos } from "./lighting.js";
import { JavaRandom } from "./java-random.js";
import { randomLong } from "./mapgen.js";

export const AIR = 0, GRASS = 2, DIRT = 3, SAPLING = 6, FLOWING_WATER = 8, WATER = 9, LOG = 17, LEAVES = 18,
  TALL_GRASS = 31, FARMLAND = 60, BROWN_MUSHROOM_BLOCK = 99, RED_MUSHROOM_BLOCK = 100, VINE = 106, MYCELIUM = 110,
  COCOA = 127, LEAVES2 = 161, LOG2 = 162;

const f = Math.fround, PI_F = f(Math.PI);
// Direction.offsetX, offsetZ and rotateOpposite (p.a, p.b, p.f).
const OFFSET_X = [0, -1, 0, 1], OFFSET_Z = [1, 0, -1, 0], OPPOSITE = [2, 3, 0, 1];
const airOrLeaves = (id) => id === AIR || id === LEAVES || id === LEAVES2;
const water = (id) => id === FLOWING_WATER || id === WATER;
const div = (a, b) => Math.trunc(a / b);

// WorldGenerator.setBlockAndNotifyAdequately: flag 3 with notify, otherwise 2.
class WorldGenerator {
  constructor(notify) { this.notify = notify; }
  setScale() {}
  set(world, x, y, z, id, meta = 0) { world.setBlock(x, y, z, id, meta, this.notify ? 3 : 2); }
}
// WorldGenAbstractTree: canGrowInto and the empty func_150524_b post-generation hook.
class AbstractTree extends WorldGenerator {
  canGrowInto(id) { return airOrLeaves(id) || id === GRASS || id === DIRT || id === LOG || id === LOG2 || id === SAPLING || id === VINE; }
  postGenerate() {}
}
// The shared clearance scan: rows y..y+1+height, a radius per row, every in-range block passing test.
function clear(world, x, y, z, height, radius, test) {
  for (let j = y; j <= y + 1 + height; j++) {
    const r = radius(j);
    for (let i = x - r; i <= x + r; i++)
      for (let k = z - r; k <= z + r; k++) if (j < 0 || j >= 256 || !test(world.getBlock(i, j, k), j)) return false;
  }
  return true;
}
const smallRadius = (y, height, top) => (j) => (j === y ? 0 : j >= y + 1 + height - 2 ? top : 1);
const soil = (id, farmland) => id === GRASS || id === DIRT || (farmland && id === FARMLAND);
// Vines hanging from a leaf: up to four more below while the block under is air.
function growVines(gen, world, x, y, z, meta) {
  gen.set(world, x, y, z, VINE, meta);
  for (let n = 4; world.getBlock(x, --y, z) === AIR && n > 0; n--) gen.set(world, x, y, z, VINE, meta);
}
// WorldGenTrees/WorldGenSwamp leaf-vine pass over the top four canopy layers.
function leafVines(gen, world, random, x, y, z, height) {
  for (let j = y - 3 + height; j <= y + height; j++) {
    const r = 2 - div(j - (y + height), 2);
    for (let i = x - r; i <= x + r; i++)
      for (let k = z - r; k <= z + r; k++) {
        const id = world.getBlock(i, j, k);
        if (id !== LEAVES && id !== LEAVES2) continue;
        if (random.nextInt(4) === 0 && world.getBlock(i - 1, j, k) === AIR) growVines(gen, world, i - 1, j, k, 8);
        if (random.nextInt(4) === 0 && world.getBlock(i + 1, j, k) === AIR) growVines(gen, world, i + 1, j, k, 2);
        if (random.nextInt(4) === 0 && world.getBlock(i, j, k - 1) === AIR) growVines(gen, world, i, j, k - 1, 1);
        if (random.nextInt(4) === 0 && world.getBlock(i, j, k + 1) === AIR) growVines(gen, world, i, j, k + 1, 4);
      }
  }
}
// The four-layer round canopy of oak, birch and swamp trees. Corners draw nextInt(2)
// and are skipped on 0 or on the top layer; place(id) decides whether a block is replaced.
function roundCanopy(gen, world, random, x, y, z, height, base, meta, place) {
  for (let j = y - 3 + height; j <= y + height; j++) {
    const dy = j - (y + height), r = base - div(dy, 2);
    for (let i = x - r; i <= x + r; i++)
      for (let k = z - r; k <= z + r; k++) {
        if (Math.abs(i - x) === r && Math.abs(k - z) === r && (random.nextInt(2) === 0 || dy === 0)) continue;
        if (place(world.getBlock(i, j, k))) gen.set(world, i, j, k, LEAVES, meta);
      }
  }
}

export class WorldGenTrees extends AbstractTree {
  constructor(notify, minHeight = 4, wood = 0, leaves = 0, vines = false) {
    super(notify); this.minHeight = minHeight; this.wood = wood; this.leaves = leaves; this.vines = vines;
  }
  generate(world, random, x, y, z) {
    const height = random.nextInt(3) + this.minHeight;
    if (y < 1 || y + height + 1 > 256) return false;
    if (!clear(world, x, y, z, height, smallRadius(y, height, 2), (id) => this.canGrowInto(id))) return false;
    if (!soil(world.getBlock(x, y - 1, z), true) || y >= 256 - height - 1) return false;
    this.set(world, x, y - 1, z, DIRT);
    roundCanopy(this, world, random, x, y, z, height, 1, this.leaves, airOrLeaves);
    for (let j = 0; j < height; j++) {
      if (!airOrLeaves(world.getBlock(x, y + j, z))) continue;
      this.set(world, x, y + j, z, LOG, this.wood);
      if (!this.vines || j <= 0) continue;
      if (random.nextInt(3) > 0 && world.getBlock(x - 1, y + j, z) === AIR) this.set(world, x - 1, y + j, z, VINE, 8);
      if (random.nextInt(3) > 0 && world.getBlock(x + 1, y + j, z) === AIR) this.set(world, x + 1, y + j, z, VINE, 2);
      if (random.nextInt(3) > 0 && world.getBlock(x, y + j, z - 1) === AIR) this.set(world, x, y + j, z - 1, VINE, 1);
      if (random.nextInt(3) > 0 && world.getBlock(x, y + j, z + 1) === AIR) this.set(world, x, y + j, z + 1, VINE, 4);
    }
    if (this.vines) {
      leafVines(this, world, random, x, y, z, height);
      if (random.nextInt(5) === 0 && height > 5)
        for (let l = 0; l < 2; l++)
          for (let dir = 0; dir < 4; dir++) {
            if (random.nextInt(4 - l) !== 0) continue;
            const age = random.nextInt(3);
            this.set(world, x + OFFSET_X[OPPOSITE[dir]], y + height - 5 + l, z + OFFSET_Z[OPPOSITE[dir]], COCOA, (age << 2) | dir);
          }
    }
    return true;
  }
}

// WorldGenForest: birch, 5-7 tall, or 5-13 with the tall flag (roofed-forest and mutated birch).
export class WorldGenForest extends AbstractTree {
  constructor(notify, tall = false) { super(notify); this.tall = tall; }
  generate(world, random, x, y, z) {
    let height = random.nextInt(3) + 5;
    if (this.tall) height += random.nextInt(7);
    if (y < 1 || y + height + 1 > 256) return false;
    if (!clear(world, x, y, z, height, smallRadius(y, height, 2), (id) => this.canGrowInto(id))) return false;
    if (!soil(world.getBlock(x, y - 1, z), true) || y >= 256 - height - 1) return false;
    this.set(world, x, y - 1, z, DIRT);
    roundCanopy(this, world, random, x, y, z, height, 1, 2, airOrLeaves);
    for (let j = 0; j < height; j++) if (airOrLeaves(world.getBlock(x, y + j, z))) this.set(world, x, y + j, z, LOG, 2);
    return true;
  }
}

// WorldGenSwamp: sinks through water, wide canopy and hanging vines.
export class WorldGenSwamp extends AbstractTree {
  constructor() { super(false); }
  generate(world, random, x, y, z) {
    const height = random.nextInt(4) + 5;
    while (water(world.getBlock(x, y - 1, z))) y--;
    if (y < 1 || y + height + 1 > 256) return false;
    // Water is allowed only at the origin's own height.
    if (!clear(world, x, y, z, height, smallRadius(y, height, 3), (id, j) => airOrLeaves(id) || (water(id) && j <= y))) return false;
    if (!soil(world.getBlock(x, y - 1, z), false) || y >= 256 - height - 1) return false;
    this.set(world, x, y - 1, z, DIRT);
    roundCanopy(this, world, random, x, y, z, height, 2, 0, (id) => !world.isOpaqueCube(id));
    for (let j = 0; j < height; j++) {
      const id = world.getBlock(x, y + j, z);
      if (airOrLeaves(id) || water(id)) this.set(world, x, y + j, z, LOG);
    }
    leafVines(this, world, random, x, y, z, height);
    return true;
  }
}

// WorldGenTaiga1: spruce with a cone that narrows back at its base.
export class WorldGenTaiga1 extends AbstractTree {
  constructor() { super(false); }
  generate(world, random, x, y, z) {
    const height = random.nextInt(5) + 7, bare = height - random.nextInt(2) - 3, maxRadius = 1 + random.nextInt(height - bare + 1);
    if (y < 1 || y + height + 1 > 256) return false;
    if (!clear(world, x, y, z, height, (j) => (j - y < bare ? 0 : maxRadius), (id) => this.canGrowInto(id))) return false;
    if (!soil(world.getBlock(x, y - 1, z), false) || y >= 256 - height - 1) return false;
    this.set(world, x, y - 1, z, DIRT);
    let r = 0;
    for (let j = y + height; j >= y + bare; j--) {
      for (let i = x - r; i <= x + r; i++)
        for (let k = z - r; k <= z + r; k++) {
          if (Math.abs(i - x) === r && Math.abs(k - z) === r && r > 0) continue;
          if (!world.isOpaqueCube(world.getBlock(i, j, k))) this.set(world, i, j, k, LEAVES, 1);
        }
      if (r >= 1 && j === y + bare + 1) r--;
      else if (r < maxRadius) r++;
    }
    for (let j = 0; j < height - 1; j++) if (airOrLeaves(world.getBlock(x, y + j, z))) this.set(world, x, y + j, z, LOG, 1);
    return true;
  }
}

// WorldGenTaiga2: spruce with alternating leaf rings.
export class WorldGenTaiga2 extends AbstractTree {
  generate(world, random, x, y, z) {
    const height = random.nextInt(4) + 6, bare = 1 + random.nextInt(2), leafy = height - bare, maxRadius = 2 + random.nextInt(2);
    if (y < 1 || y + height + 1 > 256) return false;
    if (!clear(world, x, y, z, height, (j) => (j - y < bare ? 0 : maxRadius), airOrLeaves)) return false;
    if (!soil(world.getBlock(x, y - 1, z), true) || y >= 256 - height - 1) return false;
    this.set(world, x, y - 1, z, DIRT);
    let r = random.nextInt(2), limit = 1, next = 0;
    for (let n = 0; n <= leafy; n++) {
      const j = y + height - n;
      for (let i = x - r; i <= x + r; i++)
        for (let k = z - r; k <= z + r; k++) {
          if (Math.abs(i - x) === r && Math.abs(k - z) === r && r > 0) continue;
          if (!world.isOpaqueCube(world.getBlock(i, j, k))) this.set(world, i, j, k, LEAVES, 1);
        }
      if (r >= limit) {
        r = next; next = 1;
        if (++limit > maxRadius) limit = maxRadius;
      } else r++;
    }
    const shortened = random.nextInt(3);
    for (let j = 0; j < height - shortened; j++) if (airOrLeaves(world.getBlock(x, y + j, z))) this.set(world, x, y + j, z, LOG, 1);
    return true;
  }
}

// WorldGenHugeTrees: 2x2 trunks rooted at (x..x+1, z..z+1).
class HugeTree extends AbstractTree {
  constructor(notify, baseHeight, extraHeight, wood, leaves) {
    super(notify); this.baseHeight = baseHeight; this.extraHeight = extraHeight; this.wood = wood; this.leaves = leaves;
  }
  height(random) {
    let h = random.nextInt(3) + this.baseHeight;
    if (this.extraHeight > 1) h += random.nextInt(this.extraHeight);
    return h;
  }
  // func_150537_a: clearance (radius 1 at the base, 2 above) then the four soil blocks, always flag 2.
  canGrow(world, x, y, z, height) {
    if (y < 1 || y + height + 1 > 256) return false;
    if (!clear(world, x, y, z, height, (j) => (j === y ? 1 : 2), (id) => this.canGrowInto(id))) return false;
    if (!soil(world.getBlock(x, y - 1, z), false) || y < 2) return false;
    for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) world.setBlock(x + dx, y - 1, z + dz, DIRT, 0, 2);
    return true;
  }
  // func_150535_a: a disc centred between four columns.
  wideLayer(world, x, y, z, r) {
    const rr = r * r;
    for (let i = x - r; i <= x + r + 1; i++)
      for (let k = z - r; k <= z + r + 1; k++) {
        const a = i - x, b = k - z, a1 = a - 1, b1 = b - 1;
        if (a * a + b * b > rr && a1 * a1 + b1 * b1 > rr && a * a + b1 * b1 > rr && a1 * a1 + b * b > rr) continue;
        if (airOrLeaves(world.getBlock(i, y, k))) this.set(world, i, y, k, LEAVES, this.leaves);
      }
  }
  // func_150534_b: a disc centred on one column.
  layer(world, x, y, z, r) {
    const rr = r * r;
    for (let i = x - r; i <= x + r; i++)
      for (let k = z - r; k <= z + r; k++) {
        const a = i - x, b = k - z;
        if (a * a + b * b > rr) continue;
        if (airOrLeaves(world.getBlock(i, y, k))) this.set(world, i, y, k, LEAVES, this.leaves);
      }
  }
  // The 2x2 trunk; the top block of three columns is left out. vine(i, dx, dz) runs after each placed log.
  trunk(world, x, y, z, height, vine) {
    for (let j = 0; j < height; j++)
      for (const [dx, dz] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
        if (j >= height - 1 && (dx || dz)) break;
        if (!airOrLeaves(world.getBlock(x + dx, y + j, z + dz))) continue;
        this.set(world, x + dx, y + j, z + dz, LOG, this.wood);
        vine?.(j, dx, dz);
      }
  }
}

export class WorldGenMegaJungle extends HugeTree {
  generate(world, random, x, y, z) {
    const height = this.height(random);
    if (!this.canGrow(world, x, y, z, height)) return false;
    const top = y + height;
    for (let j = top - 2; j <= top; j++) this.wideLayer(world, x, j, z, 2 + 1 - (j - top));
    for (let j = top - 2 - random.nextInt(4); j > y + div(height, 2); j -= 2 + random.nextInt(4)) {
      const angle = f(f(random.nextFloat() * PI_F) * 2), cos = mhCos(angle), sin = mhSin(angle);
      let bx = x + Math.trunc(f(0.5 + f(cos * 4))), bz = z + Math.trunc(f(0.5 + f(sin * 4)));
      for (let n = 0; n < 5; n++) {
        bx = x + Math.trunc(f(1.5 + f(cos * n)));
        bz = z + Math.trunc(f(1.5 + f(sin * n)));
        this.set(world, bx, j - 3 + div(n, 2), bz, LOG, this.wood);
      }
      const depth = 1 + random.nextInt(2);
      for (let k = j - depth; k <= j; k++) this.layer(world, bx, k, bz, 1 - (k - j));
    }
    // Vines on the outward faces of each trunk column: [dx, dz, meta] pairs per column.
    const faces = { "0,0": [[-1, 0, 8], [0, -1, 1]], "1,0": [[2, 0, 2], [1, -1, 1]], "1,1": [[2, 1, 2], [1, 2, 4]], "0,1": [[-1, 1, 8], [0, 2, 4]] };
    this.trunk(world, x, y, z, height, (j, dx, dz) => {
      if (j <= 0) return;
      for (const [vx, vz, meta] of faces[`${dx},${dz}`])
        if (random.nextInt(3) > 0 && world.getBlock(x + vx, y + j, z + vz) === AIR) this.set(world, x + vx, y + j, z + vz, VINE, meta);
    });
    return true;
  }
}

// WorldGenMegaPineTree: mega spruce (pine=false) or mega pine, then podzol on success.
export class WorldGenMegaPineTree extends HugeTree {
  constructor(notify, pine) { super(notify, 13, 15, 1, 1); this.pine = pine; }
  generate(world, random, x, y, z) {
    const height = this.height(random);
    if (!this.canGrow(world, x, y, z, height)) return false;
    const top = y + height, crown = random.nextInt(5) + (this.pine ? this.baseHeight : 3);
    let last = 0;
    for (let j = top - crown; j <= top; j++) {
      const d = top - j, r = Math.floor(f(f(d / crown) * 3.5));
      this.wideLayer(world, x, j, z, r + (d > 0 && r === last && (j & 1) === 0 ? 1 : 0));
      last = r;
    }
    this.trunk(world, x, y, z, height);
    return true;
  }
  postGenerate(world, random, x, y, z) {
    this.podzolDisc(world, x - 1, y, z - 1);
    this.podzolDisc(world, x + 2, y, z - 1);
    this.podzolDisc(world, x - 1, y, z + 2);
    this.podzolDisc(world, x + 2, y, z + 2);
    for (let n = 0; n < 5; n++) {
      const v = random.nextInt(64), a = v % 8, b = div(v, 8);
      if (a === 0 || a === 7 || b === 0 || b === 7) this.podzolDisc(world, x - 3 + a, y, z - 3 + b);
    }
  }
  podzolDisc(world, x, y, z) {
    for (let i = -2; i <= 2; i++)
      for (let k = -2; k <= 2; k++) if (Math.abs(i) !== 2 || Math.abs(k) !== 2) this.podzol(world, x + i, y, z + k);
  }
  // The first grass or dirt from y+2 down to y-3 becomes podzol (dirt meta 2); stops at a non-air block below y.
  podzol(world, x, y, z) {
    for (let j = y + 2; j >= y - 3; j--) {
      const id = world.getBlock(x, j, z);
      if (id === GRASS || id === DIRT) { this.set(world, x, j, z, DIRT, 2); break; }
      if (id !== AIR && j < y) break;
    }
  }
}

// WorldGenShrub: a single log with a three-layer leaf mound; always reports success.
export class WorldGenShrub extends WorldGenTrees {
  constructor(wood, leaves) { super(false); this.shrubWood = wood; this.shrubLeaves = leaves; }
  generate(world, random, x, y, z) {
    let id;
    while (airOrLeaves(id = world.getBlock(x, y, z)) && y > 0) y--;
    id = world.getBlock(x, y, z);
    if (id === DIRT || id === GRASS) {
      this.set(world, x, ++y, z, LOG, this.shrubWood);
      for (let j = y; j <= y + 2; j++) {
        const r = 2 - (j - y);
        for (let i = x - r; i <= x + r; i++)
          for (let k = z - r; k <= z + r; k++) {
            if (Math.abs(i - x) === r && Math.abs(k - z) === r && random.nextInt(2) === 0) continue;
            if (!world.isOpaqueCube(world.getBlock(i, j, k))) this.set(world, i, j, k, LEAVES, this.shrubLeaves);
          }
      }
    }
    return true;
  }
}

// WorldGenSavannaTree: acacia with a bent trunk and an optional second branch.
export class WorldGenSavannaTree extends AbstractTree {
  generate(world, random, x, y, z) {
    const height = random.nextInt(3) + random.nextInt(3) + 5;
    if (y < 1 || y + height + 1 > 256) return false;
    if (!clear(world, x, y, z, height, smallRadius(y, height, 2), (id) => this.canGrowInto(id))) return false;
    if (!soil(world.getBlock(x, y - 1, z), false) || y >= 256 - height - 1) return false;
    this.set(world, x, y - 1, z, DIRT);
    const dir = random.nextInt(4), bend = height - random.nextInt(4) - 1;
    let steps = 3 - random.nextInt(3), cx = x, cz = z, top = 0;
    for (let n = 0; n < height; n++) {
      const j = y + n;
      if (n >= bend && steps > 0) { cx += OFFSET_X[dir]; cz += OFFSET_Z[dir]; steps--; }
      if (!airOrLeaves(world.getBlock(cx, j, cz))) continue;
      this.set(world, cx, j, cz, LOG2, 0);
      top = j;
    }
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) this.leaf(world, cx + a, top + 1, cz + b);
    this.leaf(world, cx + 2, top + 1, cz);
    this.leaf(world, cx - 2, top + 1, cz);
    this.leaf(world, cx, top + 1, cz + 2);
    this.leaf(world, cx, top + 1, cz - 2);
    for (let a = -3; a <= 3; a++)
      for (let b = -3; b <= 3; b++) if (Math.abs(a) !== 3 || Math.abs(b) !== 3) this.leaf(world, cx + a, top, cz + b);
    cx = x; cz = z;
    const branch = random.nextInt(4);
    if (branch !== dir) {
      const start = bend - random.nextInt(2) - 1;
      let length = 1 + random.nextInt(3);
      top = 0;
      for (let n = start; n < height && length > 0; n++, length--) {
        if (n < 1) continue;
        cx += OFFSET_X[branch]; cz += OFFSET_Z[branch];
        const j = y + n;
        if (!airOrLeaves(world.getBlock(cx, j, cz))) continue;
        this.set(world, cx, j, cz, LOG2, 0);
        top = j;
      }
      if (top > 0) {
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) this.leaf(world, cx + a, top + 1, cz + b);
        for (let a = -2; a <= 2; a++)
          for (let b = -2; b <= 2; b++) if (Math.abs(a) !== 2 || Math.abs(b) !== 2) this.leaf(world, cx + a, top, cz + b);
      }
    }
    return true;
  }
  leaf(world, x, y, z) { if (airOrLeaves(world.getBlock(x, y, z))) this.set(world, x, y, z, LEAVES2, 0); }
}

// WorldGenCanopyTree: dark oak, a 2x2 trunk with root-like side logs.
export class WorldGenCanopyTree extends AbstractTree {
  generate(world, random, x, y, z) {
    const height = random.nextInt(3) + random.nextInt(2) + 6;
    if (y < 1 || y + height + 1 > 256) return false;
    if (!clear(world, x, y, z, height, smallRadius(y, height, 2), (id) => this.canGrowInto(id))) return false;
    if (!soil(world.getBlock(x, y - 1, z), false) || y >= 256 - height - 1) return false;
    for (const [dx, dz] of [[0, 0], [1, 0], [1, 1], [0, 1]]) this.set(world, x + dx, y - 1, z + dz, DIRT);
    const dir = random.nextInt(4), bend = height - random.nextInt(4);
    let steps = 2 - random.nextInt(3), cx = x, cz = z, top = 0;
    for (let n = 0; n < height; n++) {
      const j = y + n;
      if (n >= bend && steps > 0) { cx += OFFSET_X[dir]; cz += OFFSET_Z[dir]; steps--; }
      if (!airOrLeaves(world.getBlock(cx, j, cz))) continue;
      for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) this.set(world, cx + dx, j, cz + dz, LOG2, 1);
      top = j;
    }
    for (let a = -2; a <= 0; a++)
      for (let b = -2; b <= 0; b++) {
        this.mirrored(world, cx, top - 1, cz, a, b);
        if ((a <= -2 && b <= -1) || (a === -1 && b === -2)) continue;
        this.mirrored(world, cx, top + 1, cz, a, b);
      }
    if (random.nextBoolean()) for (const [dx, dz] of [[0, 0], [1, 0], [1, 1], [0, 1]]) this.leaf(world, cx + dx, top + 2, cz + dz);
    for (let a = -3; a <= 4; a++)
      for (let b = -3; b <= 4; b++) {
        if ((a === -3 && b === -3) || (a === -3 && b === 4) || (a === 4 && b === -3) || (a === 4 && b === 4) || (Math.abs(a) >= 3 && Math.abs(b) >= 3)) continue;
        this.leaf(world, cx + a, top, cz + b);
      }
    for (let a = -1; a <= 2; a++)
      for (let b = -1; b <= 2; b++) {
        if ((a >= 0 && a <= 1 && b >= 0 && b <= 1) || random.nextInt(3) > 0) continue;
        const length = random.nextInt(3) + 2;
        // Side logs hang from the original column, not the bent top.
        for (let n = 0; n < length; n++) this.set(world, x + a, top - n - 1, z + b, LOG2, 1);
        for (let i = -1; i <= 1; i++) for (let k = -1; k <= 1; k++) this.leaf(world, cx + a + i, top, cz + b + k);
        for (let i = -2; i <= 2; i++)
          for (let k = -2; k <= 2; k++) if (Math.abs(i) !== 2 || Math.abs(k) !== 2) this.leaf(world, cx + a + i, top - 1, cz + b + k);
      }
    return true;
  }
  mirrored(world, cx, y, cz, a, b) {
    this.leaf(world, cx + a, y, cz + b);
    this.leaf(world, 1 + cx - a, y, cz + b);
    this.leaf(world, cx + a, y, 1 + cz - b);
    this.leaf(world, 1 + cx - a, y, 1 + cz - b);
  }
  // Canopy leaves replace air only.
  leaf(world, x, y, z) { if (world.getBlock(x, y, z) === AIR) this.set(world, x, y, z, LEAVES2, 1); }
}

// WorldGenBigTree (ard). The height limit is set on the first generate and kept afterwards.
const AXES = [2, 0, 0, 1, 2, 1];
export class WorldGenBigTree extends AbstractTree {
  constructor(notify) {
    super(notify);
    this.rand = new JavaRandom(0n); this.world = null; this.base = [0, 0, 0]; this.heightLimit = 0; this.height = 0;
    this.heightAttenuation = 0.618; this.branchSlope = 0.381; this.scaleWidth = 1; this.leafDensity = 1;
    this.heightLimitLimit = 12; this.leafDistanceLimit = 4; this.leafNodes = [];
  }
  setScale(height, width, leaves) {
    this.heightLimitLimit = Math.trunc(height * 12);
    if (height > 0.5) this.leafDistanceLimit = 5;
    this.scaleWidth = width; this.leafDensity = leaves;
  }
  generate(world, random, x, y, z) {
    this.world = world;
    this.rand.setSeed(randomLong(random));
    this.base = [x, y, z];
    if (this.heightLimit === 0) this.heightLimit = 5 + this.rand.nextInt(this.heightLimitLimit);
    if (!this.validLocation()) return false;
    this.leafNodeList();
    for (const [nx, ny, nz] of this.leafNodes) this.leafNode(nx, ny, nz);
    this.line(this.base, [x, y + this.height, z], LOG);
    for (const node of this.leafNodes)
      if (!(node[3] - this.base[1] < this.heightLimit * 0.2)) this.line([x, node[3], z], [node[0], node[1], node[2]], LOG);
    return true;
  }
  leafNodeList() {
    const [bx, by, bz] = this.base, e = this.heightLimit, leafDist = this.leafDistanceLimit;
    this.height = Math.trunc(e * this.heightAttenuation);
    if (this.height >= e) this.height = e - 1;
    let perLayer = Math.trunc(1.382 + ((this.leafDensity * e) / 13) ** 2);
    if (perLayer < 1) perLayer = 1;
    let layerY = by + e - leafDist;
    const trunkTop = by + this.height, nodes = [[bx, layerY, bz, trunkTop]];
    layerY--;
    for (let n = layerY + 1 - by; n >= 0; layerY--, n--) {
      const size = this.layerSize(n);
      if (size < 0) continue;
      for (let i = 0; i < perLayer; i++) {
        const dist = this.scaleWidth * (size * (this.rand.nextFloat() + 0.328)), angle = this.rand.nextFloat() * 2 * 3.14159;
        const nx = Math.floor(dist * Math.sin(angle) + bx + 0.5), nz = Math.floor(dist * Math.cos(angle) + bz + 0.5);
        const node = [nx, layerY, nz];
        if (this.check(node, [nx, layerY + leafDist, nz]) !== -1) continue;
        const reach = Math.sqrt((bx - nx) ** 2 + (bz - nz) ** 2) * this.branchSlope;
        const branchBase = [bx, layerY - reach > trunkTop ? trunkTop : Math.trunc(layerY - reach), bz];
        if (this.check(branchBase, node) !== -1) continue;
        nodes.push([nx, layerY, nz, branchBase[1]]);
      }
    }
    this.leafNodes = nodes;
  }
  layerSize(n) {
    const e = this.heightLimit;
    if (n < e * 0.3) return f(-1.618);
    const half = f(e / 2), off = f(f(e / 2) - n);
    const size = off === 0 ? half : Math.abs(off) >= half ? 0 : f(Math.sqrt(half * half - off * off));
    return f(size * 0.5);
  }
  leafSize(n) { return n < 0 || n >= this.leafDistanceLimit ? -1 : n === 0 || n === this.leafDistanceLimit - 1 ? 2 : 3; }
  leafNode(x, y, z) { for (let j = y; j < y + this.leafDistanceLimit; j++) this.crossSection(x, j, z, f(this.leafSize(j - y)), 1, LEAVES); }
  crossSection(x, y, z, size, axis, id) {
    const r = Math.trunc(size + 0.618), a1 = AXES[axis], a2 = AXES[axis + 3], center = [x, y, z], p = [0, 0, 0];
    p[axis] = center[axis];
    for (let i = -r; i <= r; i++) {
      p[a1] = center[a1] + i;
      for (let k = -r; k <= r; k++) {
        if ((Math.abs(i) + 0.5) ** 2 + (Math.abs(k) + 0.5) ** 2 > f(size * size)) continue;
        p[a2] = center[a2] + k;
        if (airOrLeaves(this.world.getBlock(p[0], p[1], p[2]))) this.set(this.world, p[0], p[1], p[2], id, 0);
      }
    }
  }
  // The longest axis of b - a, and the ratios of the other two to it.
  axis(a, b) {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    let main = 0;
    for (let i = 0; i < 3; i++) if (Math.abs(d[i]) > Math.abs(d[main])) main = i;
    return { d, main, a1: AXES[main], a2: AXES[main + 3] };
  }
  // placeBlockLine: log meta 4 or 8 when the line runs mostly along x or z.
  line(a, b, id) {
    const { d, main, a1, a2 } = this.axis(a, b);
    if (d[main] === 0) return;
    const step = d[main] > 0 ? 1 : -1, r1 = d[a1] / d[main], r2 = d[a2] / d[main], p = [0, 0, 0], end = d[main] + step;
    for (let i = 0; i !== end; i += step) {
      p[main] = Math.floor(a[main] + i + 0.5);
      p[a1] = Math.floor(a[a1] + i * r1 + 0.5);
      p[a2] = Math.floor(a[a2] + i * r2 + 0.5);
      const dx = Math.abs(p[0] - a[0]), dz = Math.abs(p[2] - a[2]), m = Math.max(dx, dz);
      this.set(this.world, p[0], p[1], p[2], id, m > 0 ? (dx === m ? 4 : dz === m ? 8 : 0) : 0);
    }
  }
  // checkBlockLine: -1 when clear, otherwise the distance to the first blocking block.
  check(a, b) {
    const { d, main, a1, a2 } = this.axis(a, b);
    if (d[main] === 0) return -1;
    const step = d[main] > 0 ? 1 : -1, r1 = d[a1] / d[main], r2 = d[a2] / d[main], p = [0, 0, 0], end = d[main] + step;
    let i = 0;
    for (; i !== end; i += step) {
      p[main] = a[main] + i;
      p[a1] = Math.floor(a[a1] + i * r1);
      p[a2] = Math.floor(a[a2] + i * r2);
      if (!this.canGrowInto(this.world.getBlock(p[0], p[1], p[2]))) break;
    }
    return i === end ? -1 : Math.abs(i);
  }
  validLocation() {
    const [x, y, z] = this.base;
    if (!soil(this.world.getBlock(x, y - 1, z), true)) return false;
    const n = this.check(this.base, [x, y + this.heightLimit - 1, z]);
    if (n === -1) return true;
    if (n < 6) return false;
    this.heightLimit = n;
    return true;
  }
}

// WorldGenBigMushroom: type 0 brown, 1 red, -1 draws a random type (the decorator's).
export class WorldGenBigMushroom extends WorldGenerator {
  constructor(type = -1) { super(type >= 0); this.type = type; }
  generate(world, random, x, y, z) {
    let type = random.nextInt(2);
    if (this.type >= 0) type = this.type;
    const height = random.nextInt(3) + 4, top = y + height, block = BROWN_MUSHROOM_BLOCK + type;
    if (y < 1 || y + height + 1 >= 256) return false;
    if (!clear(world, x, y, z, height, (j) => (j <= y + 3 ? 0 : 3), airOrLeaves)) return false;
    const below = world.getBlock(x, y - 1, z);
    if (below !== DIRT && below !== GRASS && below !== MYCELIUM) return false;
    for (let j = type === 1 ? top - 3 : top; j <= top; j++) {
      const r = type === 0 ? 3 : j < top ? 2 : 1;
      for (let i = x - r; i <= x + r; i++)
        for (let k = z - r; k <= z + r; k++) {
          let meta = 5;
          if (i === x - r) meta--;
          if (i === x + r) meta++;
          if (k === z - r) meta -= 3;
          if (k === z + r) meta += 3;
          if (type === 0 || j < top) {
            if ((i === x - r || i === x + r) && (k === z - r || k === z + r)) continue;
            if ((i === x - (r - 1) && k === z - r) || (i === x - r && k === z - (r - 1))) meta = 1;
            if ((i === x + (r - 1) && k === z - r) || (i === x + r && k === z - (r - 1))) meta = 3;
            if ((i === x - (r - 1) && k === z + r) || (i === x - r && k === z + (r - 1))) meta = 7;
            if ((i === x + (r - 1) && k === z + r) || (i === x + r && k === z + (r - 1))) meta = 9;
          }
          if (meta === 5 && j < top) meta = 0;
          // Native compares y < y + height - 1, always true, so meta-0 inner blocks are never placed.
          if (meta === 0 || world.isOpaqueCube(world.getBlock(i, j, k))) continue;
          this.set(world, i, j, k, block, meta);
        }
    }
    for (let j = 0; j < height; j++) if (!world.isOpaqueCube(world.getBlock(x, y + j, z))) this.set(world, x, y + j, z, block, 10);
    return true;
  }
}

// Biome tree pickers (func_150567_a) by registry slot: [kind, parameter]. Parameters are the
// forest type, the taiga type, the jungle-edge flag and, for mutated biomes, the base slot.
const PLAIN = ["plain", -1];
export const BIOME_TREE_PICKERS = new Map([
  [0, PLAIN], [1, PLAIN], [2, PLAIN], [3, ["extremeHills", -1]], [4, ["forest", 0]], [5, ["taiga", 0]], [6, ["swamp", -1]], [7, PLAIN],
  [8, PLAIN], [9, PLAIN], [10, PLAIN], [11, PLAIN], [12, ["ice", -1]], [13, ["ice", -1]], [14, PLAIN], [15, PLAIN], [16, PLAIN], [17, PLAIN],
  [18, ["forest", 0]], [19, ["taiga", 0]], [20, ["extremeHills", -1]], [21, ["jungle", 0]], [22, ["jungle", 0]], [23, ["jungle", 1]],
  [24, PLAIN], [25, PLAIN], [26, PLAIN], [27, ["forest", 2]], [28, ["forest", 2]], [29, ["forest", 3]], [30, ["taiga", 0]], [31, ["taiga", 0]],
  [32, ["taiga", 1]], [33, ["taiga", 1]], [34, ["extremeHills", -1]], [35, ["savanna", -1]], [36, ["savanna", -1]],
  [37, ["mesa", -1]], [38, ["mesa", -1]], [39, ["mesa", -1]], [129, PLAIN], [130, ["mutated", 2]], [131, ["extremeHills", -1]],
  [132, ["forest", 1]], [133, ["mutated", 5]], [134, ["mutated", 6]], [140, ["ice", -1]], [149, ["mutated", 21]], [151, ["mutated", 23]],
  [155, ["birchM", 27]], [156, ["birchM", 28]], [157, ["mutated", 29]], [158, ["mutated", 30]], [160, ["taiga", 2]], [161, ["taiga", 2]],
  [162, ["extremeHills", -1]], [163, ["mutated", 35]], [164, ["mutated", 36]], [165, ["mesa", -1]], [166, ["mesa", -1]], [167, ["mesa", -1]],
]);

// The generator objects biomes share for one world: per-slot oak, big oak, swamp and
// extreme-hills spruce fields, and class-static birch, roofed, acacia and taiga trees.
export class BiomeTrees {
  constructor() { this.shared = new Map(); }
  get(key, make) {
    let gen = this.shared.get(key);
    if (!gen) { gen = make(); gen.key = key; this.shared.set(key, gen); }
    return gen;
  }
  oak(slot) { return this.get(`${slot}:trees`, () => new WorldGenTrees(false)); }
  bigTree(slot) { return this.get(`${slot}:bigTree`, () => new WorldGenBigTree(false)); }
}
const STATIC = {
  "forest:tallBirch": () => new WorldGenForest(false, true), "forest:birch": () => new WorldGenForest(false, false),
  "forest:roofed": () => new WorldGenCanopyTree(false), "savanna:acacia": () => new WorldGenSavannaTree(false),
  "taiga:taiga1": () => new WorldGenTaiga1(), "taiga:taiga2": () => new WorldGenTaiga2(false),
  "taiga:megaSpruce": () => new WorldGenMegaPineTree(false, false), "taiga:megaPine": () => new WorldGenMegaPineTree(false, true),
};
const shared = (trees, key) => trees.get(key, STATIC[key]);
const plainTree = (slot, random, trees) => (random.nextInt(10) === 0 ? trees.bigTree(slot) : trees.oak(slot));

// BiomeGenBase.func_150567_a for a registry slot. Newly constructed generators have no key.
export function pickTree(slot, random, trees) {
  const [kind, param] = BIOME_TREE_PICKERS.get(slot);
  switch (kind) {
    case "plain": return plainTree(slot, random, trees);
    case "extremeHills": return random.nextInt(3) > 0 ? trees.get(`${slot}:taiga2`, () => new WorldGenTaiga2(false)) : plainTree(slot, random, trees);
    case "forest":
      if (param === 3 && random.nextInt(3) > 0) return shared(trees, "forest:roofed");
      return param === 2 || random.nextInt(5) === 0 ? shared(trees, "forest:birch") : trees.oak(slot);
    case "birchM": return shared(trees, random.nextBoolean() ? "forest:tallBirch" : "forest:birch");
    case "ice": return new WorldGenTaiga2(false);
    case "jungle":
      if (random.nextInt(10) === 0) return trees.bigTree(slot);
      if (random.nextInt(2) === 0) return new WorldGenShrub(3, 0);
      if (param === 0 && random.nextInt(3) === 0) return new WorldGenMegaJungle(false, 10, 20, 3, 3);
      return new WorldGenTrees(false, 4 + random.nextInt(7), 3, 3, true);
    case "mesa": return trees.oak(slot);
    case "mutated": return pickTree(param, random, trees);
    case "savanna": return random.nextInt(5) > 0 ? shared(trees, "savanna:acacia") : trees.oak(slot);
    case "swamp": return trees.get(`${slot}:swamp`, () => new WorldGenSwamp());
    case "taiga":
      if ((param === 1 || param === 2) && random.nextInt(3) === 0)
        return shared(trees, param === 2 || random.nextInt(13) === 0 ? "taiga:megaPine" : "taiga:megaSpruce");
      return shared(trees, random.nextInt(3) === 0 ? "taiga:taiga1" : "taiga:taiga2");
  }
  throw new RangeError(`no tree picker for biome slot ${slot}`);
}

// BiomeGenBase.getRandomWorldGenForGrass (func_150569_a): the tall grass metadata
// (1 grass, 2 fern) for WorldGenTallGrass. Only jungle and taiga classes draw.
export function pickGrassMeta(slot, random) {
  const [kind] = BIOME_TREE_PICKERS.get(slot);
  if (kind === "jungle") return random.nextInt(4) === 0 ? 2 : 1;
  if (kind === "taiga") return random.nextInt(5) > 0 ? 2 : 1;
  return 1;
}
