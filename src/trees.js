// Oak saplings, tree growth, leaf decay and leaf drops, ported from the 1.7.10 JAR
// (public/research/trees.md; replayed against public/research/trees-reference.json by
// trees.test.js): BlockSapling (anj) with BlockBush (ajr), WorldGenTrees (asq, the oak
// generator, minimum height 4, no vines) over WorldGenAbstractTree (arc) / WorldGenerator (arn),
// BlockLeaves (alt) / BlockOldLeaf (aml) and BlockLog.breakBlock (alx).
//
// This module reads blocks through a `world` ({get, getMeta, put, set}) and Random numbers from
// a JavaRandom, so the same code runs in the game, in generation (generationVersion 7) and in
// the tests. Block ids are this port's (4 log, 5 leaves, 1 grass, 2 dirt, 29/30 farmland, 48
// sapling); the original ids (17, 18, 2, 3, 60, 6) appear in comments and in the reference.
import { JavaRandom } from "./lighting.js";
import { SIZE, HEIGHT, SAPLING, ticksRandomly } from "./world.js";
import { Weather } from "./weather.js";

const GRASS = 1, DIRT = 2, LOG = 4, LEAVES = 5, APPLE = 200;
export const LEAF_NO_DECAY = 4, LEAF_CHECK = 8, SAPLING_MARKED = 8;

// WorldGenAbstractTree.func_150523_a (arc.a): the blocks a tree may grow into: Material.air,
// Material.leaves, grass, dirt, log, log2, sapling and vine. This port has no log2 or vine.
export const canGrowInto = (b) => b === 0 || b === LEAVES || b === GRASS || b === DIRT || b === LOG || b === SAPLING;
// BlockBush.func_149854_a (ajr.a): grass, dirt or farmland (both of this port's farmland ids).
export const canPlaceOn = (b) => b === GRASS || b === DIRT || b === 29 || b === 30;
// BlockBush.func_149718_j (ajr.j) = canBlockStay: only the block below counts, there is no light
// rule (BlockBush's has none in this build; the light is a growth condition of the sapling).
export const saplingCanStay = (world, x, y, z) => canPlaceOn(world.get(x, y - 1, z));

// WorldGenTrees.generate (asq.a(World, Random, x, y, z)) for the oak: `access` is {get(x, y, z),
// set(x, y, z, block, meta, flags)} with the port's block ids; flags are 3 (notify) or 2 as in
// WorldGenerator.func_150516_a. `maxY` is the world height the 256 of the original stands for
// (this world is 64 high; the reference replays with 256). Returns whether the tree grew; the
// space check runs before anything is written, so a false return changed nothing.
export function generateTree(access, random, x, y, z, { minHeight = 4, notify = false, maxY = 256 } = {}) {
  const flags = notify ? 3 : 2, height = random.nextInt(3) + minHeight;
  let ok = true;
  if (y < 1 || y + height + 1 > maxY) return false;
  for (let yy = y; yy <= y + 1 + height; yy++) {
    let r = 1;
    if (yy === y) r = 0;
    if (yy >= y + 1 + height - 2) r = 2;
    for (let xx = x - r; xx <= x + r && ok; xx++)
      for (let zz = z - r; zz <= z + r && ok; zz++) {
        if (yy >= 0 && yy < maxY) {
          if (!canGrowInto(access.get(xx, yy, zz))) ok = false;
        } else ok = false;
      }
  }
  if (!ok) return false;
  const below = access.get(x, y - 1, z);
  if (!canPlaceOn(below) || y >= maxY - height - 1) return false;
  access.set(x, y - 1, z, DIRT, 0, flags);
  // Leaf layers: four from y + height - 3 up to the top log, half-width 2, 2, 1, 1. The corners
  // of a layer are left out on a coin flip (always at the top layer, dy 0) and the Random is
  // asked even when the layer would keep its corners anyway.
  for (let yy = y - 3 + height; yy <= y + height; yy++) {
    const dy = yy - (y + height), half = 1 - Math.trunc(dy / 2);
    for (let xx = x - half; xx <= x + half; xx++)
      for (let zz = z - half; zz <= z + half; zz++) {
        const dx = xx - x, dz = zz - z;
        if (Math.abs(dx) !== half || Math.abs(dz) !== half || (random.nextInt(2) !== 0 && dy !== 0)) {
          const b = access.get(xx, yy, zz);
          if (b === 0 || b === LEAVES) access.set(xx, yy, zz, LEAVES, 0, flags);
        }
      }
  }
  for (let k = 0; k < height; k++) {
    const b = access.get(x, y + k, z);
    if (b === 0 || b === LEAVES) access.set(x, y + k, z, LOG, 0, flags);
  }
  return true;
}

// Generation version 7 (ChunkProviderGenerate/BiomeDecorator's oak): the tree at the position the
// older versions used, its Random seeded from two hashes of the column. Writes untracked.
export function generateTreeAt(world, x, y, z, hashA, hashB) {
  const seed = (BigInt(Math.floor(hashA * 4294967296)) << 16n) ^ BigInt(Math.floor(hashB * 4294967296));
  return generateTree(
    { get: (a, b, c) => world.get(a, b, c), set: (a, b, c, block, meta) => world.set(a, b, c, block, false, meta) },
    new JavaRandom(seed), x, y, z, { maxY: world.height ?? HEIGHT },
  );
}

// BlockLeaves.func_149749_a (breakBlock, range 1) and BlockLog.func_149749_a (range 4): every
// leaf block within `range` that is not already marked gets bit 8 (decay check), written with
// flag 4 (no notification). Returns the number marked.
export function markLeaves(world, x, y, z, range) {
  let n = 0;
  for (let dx = -range; dx <= range; dx++)
    for (let dy = -range; dy <= range; dy++)
      for (let dz = -range; dz <= range; dz++) {
        const a = x + dx, b = y + dy, c = z + dz;
        if (world.get(a, b, c) !== LEAVES) continue;
        const meta = world.getMeta(a, b, c);
        if (!(meta & LEAF_CHECK) && world.put(a, b, c, LEAVES, meta | LEAF_CHECK, true)) n++;
      }
  return n;
}

// BlockLeaves.updateTick's search (alt.a(World, x, y, z, Random)): the 9 x 9 x 9 box around the
// leaf gets log 0, leaf -2, anything else -1; four passes then give each leaf the number of the
// pass that reached it from a log through face-adjacent leaves. The leaf stays if its own value
// is >= 0, i.e. a log is at most 4 steps away through leaves. (The original uses a 32^3 array
// that keeps stale values outside the box; only the one-cell shell around the box is written
// there, and nothing reads it as a source, so a 9^3 array gives the same answer.)
const BOX = 9, REACH = 4, dist = new Int8Array(BOX * BOX * BOX);
export function leafConnected(world, x, y, z) {
  for (let dx = -REACH; dx <= REACH; dx++)
    for (let dy = -REACH; dy <= REACH; dy++)
      for (let dz = -REACH; dz <= REACH; dz++) {
        const b = world.get(x + dx, y + dy, z + dz);
        dist[((dx + REACH) * BOX + dy + REACH) * BOX + dz + REACH] = b === LOG ? 0 : b === LEAVES ? -2 : -1;
      }
  for (let pass = 1; pass <= REACH; pass++)
    for (let dx = -REACH; dx <= REACH; dx++)
      for (let dy = -REACH; dy <= REACH; dy++)
        for (let dz = -REACH; dz <= REACH; dz++) {
          if (dist[((dx + REACH) * BOX + dy + REACH) * BOX + dz + REACH] !== pass - 1) continue;
          for (const [ox, oy, oz] of FACES) {
            const a = dx + ox, b = dy + oy, c = dz + oz;
            if (a < -REACH || a > REACH || b < -REACH || b > REACH || c < -REACH || c > REACH) continue;
            const i = ((a + REACH) * BOX + b + REACH) * BOX + c + REACH;
            if (dist[i] === -2) dist[i] = pass;
          }
        }
  return dist[((REACH) * BOX + REACH) * BOX + REACH] >= 0;
}
const FACES = [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]];

// BlockLeaves.updateTick: a leaf with bit 8 (check) and without bit 4 (placed by a player) either
// loses the check bit or, when no log is within reach, is removed (func_150126_e: dropBlockAsItem
// with fortune 0, then setBlockToAir). Returns null when nothing happens, {meta} to rewrite the
// leaf, or {decay: true, meta} to drop and remove it.
export function leafTick(world, x, y, z) {
  const meta = world.getMeta(x, y, z);
  if (!(meta & LEAF_CHECK) || meta & LEAF_NO_DECAY) return null;
  return leafConnected(world, x, y, z) ? { meta: meta & ~LEAF_CHECK } : { decay: true, meta };
}

// Items spawned by Block.dropBlockAsItem_do take their position from three nextFloat calls.
const spawn = (random) => { random.nextFloat(); random.nextFloat(); random.nextFloat(); };
// BlockLeaves.func_149690_a (dropBlockAsItemWithChance, alt.a(World, x, y, z, meta, chance,
// fortune)) with BlockOldLeaf's chances, for fortune 0: a sapling (damage meta & 3) one time in 20
// (40 for jungle), then, for oak (meta & 3 == 0) only, an apple one time in 200. Each dropped
// stack takes the three position floats from the same Random. Returns [{id, damage}].
export function leafDrops(random, meta) {
  const out = [], type = meta & 3;
  if (random.nextInt(type === 3 ? 40 : 20) === 0) {
    out.push({ id: SAPLING, damage: type });
    spawn(random);
  }
  if (type === 0 && random.nextInt(200) === 0) {
    out.push({ id: APPLE, damage: 0 });
    spawn(random);
  }
  return out;
}
// BlockLeaves.func_149636_a (harvestBlock) with shears: the leaves block itself, damage meta & 3.
export const shearedLeaves = (meta) => ({ id: LEAVES, damage: meta & 3 });
// ItemLeaves.func_77647_a (getMetadata, adg.a): the placed block's metadata is damage | 4.
export const placedLeavesMeta = (damage = 0) => damage | LEAF_NO_DECAY;

// BlockSapling.func_149879_c (markOrGrowMarked) and func_149853_b (bone meal growth) are the same
// call; ItemDye.applyBonemeal asks func_149852_a first: world.rand.nextFloat() < 0.45.
export const boneMealWorks = (random) => random.nextFloat() < 0.45;

// What a Trees instance needs from the game, all optional:
//   random   JavaRandom, WorldServer.rand
//   lcg      WorldServer.updateLCG seed (an int)
//   light    (x, y, z) => World.getBlockLightValue (sky light less the subtraction, or block light)
//   apply    (changes) after a batch of edits, changes being [x, y, z, oldBlock, newBlock]
//   drop     (stacks, x, y, z) for items the blocks drop ({id, count, damage})
export class Trees {
  constructor(world, options = {}) {
    this.world = world;
    this.random = options.random || new JavaRandom(BigInt(Date.now()) ^ 0x2545f4914f6cdd1dn);
    this.lcg = options.lcg ?? (Math.floor(Math.random() * 4294967296) | 0);
    this.light = options.light || (() => 15);
    this.apply = options.apply || null;
    this.drop = options.drop || null;
    this.maxY = options.maxY ?? world.height ?? HEIGHT;
    this.changes = [];
  }
  // World.setBlock with the original flag: notify (flag 3) goes through world.set so onChange
  // reaches the neighbours; flag 4 writes silently. Both are saved edits.
  edit(x, y, z, block, meta = 0, notify = true) {
    const old = this.world.get(x, y, z),
      ok = notify ? this.world.set(x, y, z, block, true, meta) : this.world.put(x, y, z, block, meta, true);
    if (ok && old !== block) {
      this.changes.push([x, y, z, old, block]);
      // Chunk.func_150807_a runs the old block's breakBlock for every flag, so a silent write marks too.
      if (!notify) {
        if (old === LOG) markLeaves(this.world, x, y, z, 4);
        else if (old === LEAVES) markLeaves(this.world, x, y, z, 1);
      }
    }
    return ok;
  }
  flush() {
    if (!this.changes.length) return;
    const changes = this.changes;
    this.changes = [];
    this.apply?.(changes);
  }
  // World.setBlock's neighbour notification for the blocks watched here: a block whose support
  // went drops (BlockBush.onNeighborBlockChange -> checkAndDropBlock), and a log or leaf that
  // changed into something else marks the leaves around it (breakBlock). Install over
  // world.onChange (main.js wraps the existing handler).
  onChange(x, y, z, old, now) {
    if (old !== now) {
      if (old === LOG) markLeaves(this.world, x, y, z, 4);
      else if (old === LEAVES) markLeaves(this.world, x, y, z, 1);
    }
    for (const [dx, dy, dz] of [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) {
      const a = x + dx, b = y + dy, c = z + dz;
      if (this.world.get(a, b, c) === SAPLING && !saplingCanStay(this.world, a, b, c)) this.dropSapling(a, b, c);
    }
    this.flush();
  }
  watch() {
    const next = this.world.onChange;
    this.world.onChange = (x, y, z, old, now) => {
      next?.(x, y, z, old, now);
      this.onChange(x, y, z, old, now);
    };
    return this;
  }
  // BlockBush.checkAndDropBlock: drop the sapling item (damage meta & 7) and set air with flag 2.
  dropSapling(x, y, z) {
    const meta = this.world.getMeta(x, y, z) & 7;
    if (!this.world.set(x, y, z, 0)) return false;
    this.changes.push([x, y, z, SAPLING, 0]);
    // Block.dropBlockAsItemWithChance (chance 1.0F) rolls nextFloat() > chance, then dropBlockAsItem_do
    // takes its three position floats: four draws from the world's Random.
    for (let i = 0; i < 4; i++) this.random.nextFloat();
    this.drop?.([{ id: SAPLING, count: 1, damage: meta }], x, y, z);
    return true;
  }
  // BlockSapling.updateTick (anj.a(World, x, y, z, Random)): checkAndDropBlock, then with block
  // light >= 9 above, a one-in-seven roll that marks the sapling or grows the tree. (The original
  // goes on to roll after a support-loss drop and marks the air it left; nothing is visible.)
  tickSapling(x, y, z) {
    if (this.world.get(x, y, z) !== SAPLING) return false;
    const dropped = !saplingCanStay(this.world, x, y, z) && this.dropSapling(x, y, z);
    // The original rolls on after a drop too (the roll then lands on the air it left, which only
    // gets a metadata bit nobody reads), so the Random stream is consumed either way.
    if (this.light(x, y + 1, z) >= 9 && this.random.nextInt(7) === 0 && !dropped) return this.markOrGrow(x, y, z);
    return dropped;
  }
  // BlockSapling.func_149879_c (anj.c): the first success sets bit 8 (flag 4), the next grows.
  markOrGrow(x, y, z) {
    const meta = this.world.getMeta(x, y, z);
    if (!(meta & SAPLING_MARKED)) {
      this.world.put(x, y, z, SAPLING, meta | SAPLING_MARKED, true);
      return "marked";
    }
    return this.growTree(x, y, z);
  }
  // BlockSapling.func_149878_d (anj.d) for an oak (metadata 0): one time in ten the original uses
  // WorldGenBigTree (ard), which is not ported (see trees.md); that tick draws the same number and
  // tries the ordinary tree instead and reports "big" (a stand-in; the reference run stops there).
  // The sapling cell is cleared with flag 4 first and put back
  // with its stage bit cleared (meta & 7) when the tree does not fit.
  growTree(x, y, z, { notify = true } = {}) {
    const meta = this.world.getMeta(x, y, z) & 7, big = this.random.nextInt(10) === 0;
    this.world.put(x, y, z, 0, 0, true);
    const world = this.world;
    const ok = generateTree(
      { get: (a, b, c) => world.get(a, b, c), set: (a, b, c, block, m) => this.edit(a, b, c, block, m, notify) },
      this.random, x, y, z, { notify, maxY: this.maxY },
    );
    if (!ok) {
      this.world.put(x, y, z, SAPLING, meta, true);
      this.flush();
      return big ? "big" : "failed";
    }
    this.flush(); // the trunk's write over the cleared sapling cell is the net change there
    return big ? "big" : "grew";
  }
  // ItemDye.applyBonemeal on a sapling: IGrowable.func_149851_a is true, so the stack is always
  // used; with probability 0.45 the sapling then advances like a random tick that rolled 1/7.
  boneMeal(x, y, z) {
    if (this.world.get(x, y, z) !== SAPLING) return null;
    return boneMealWorks(this.random) ? this.markOrGrow(x, y, z) : "none";
  }
  // BlockLeaves.updateTick.
  tickLeaves(x, y, z) {
    if (this.world.get(x, y, z) !== LEAVES) return false;
    const r = leafTick(this.world, x, y, z);
    if (!r) return false;
    if (!r.decay) {
      this.world.put(x, y, z, LEAVES, r.meta, true);
      return true;
    }
    this.decayLeaf(x, y, z, r.meta);
    return true;
  }
  // BlockLeaves.func_150126_e (removeLeaves): dropBlockAsItem(fortune 0), then setBlockToAir.
  decayLeaf(x, y, z, meta = this.world.getMeta(x, y, z)) {
    const stacks = leafDrops(this.random, meta).map((d) => ({ ...d, count: 1 }));
    this.world.set(x, y, z, 0);
    this.changes.push([x, y, z, LEAVES, 0]);
    if (stacks.length) this.drop?.(stacks, x, y, z);
    this.flush();
  }
  // WorldServer.func_147456_g, the block part, for one chunk: three random block ticks (updateLCG
  // picks x, z, y) in each 16-high section that has a randomly ticking block. The game uses
  // Weather.tickChunk's single stream through randomTick; this standalone one is for tests.
  tickChunk(cx, cz) {
    const bx = cx * 16, bz = cz * 16;
    for (let s = 0; s < (this.world.height ?? HEIGHT) / 16; s++) {
      if (this.world.sectionTickCount && this.world.sectionTickCount(cx, cz, s) <= 0) continue;
      for (let n = 0; n < 3; n++) {
        this.lcg = (Math.imul(this.lcg, 3) + 1013904223) | 0;
        const j = this.lcg >> 2, x = bx + (j & 15), z = bz + ((j >> 8) & 15), y = s * 16 + ((j >> 16) & 15), b = this.world.get(x, y, z);
        if (!ticksRandomly(b)) continue;
        if (b === SAPLING) this.tickSapling(x, y, z);
        else if (b === LEAVES) this.tickLeaves(x, y, z);
      }
    }
  }
  // One random block tick from the game's shared loop (Weather.tickChunk). True when handled.
  randomTick(x, y, z, b) {
    if (b === SAPLING) this.tickSapling(x, y, z);
    else if (b === LEAVES) this.tickLeaves(x, y, z);
    else return false;
    return true;
  }
  tick(player = null) {
    for (const [cx, cz] of Weather.activeChunks(player?.x ?? SIZE / 2, player?.z ?? SIZE / 2)) this.tickChunk(cx, cz);
  }
}
