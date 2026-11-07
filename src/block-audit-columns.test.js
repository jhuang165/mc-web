import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World, blockBounds, collisionBounds, normalCube } from "./world.js";
import { fromOriginal } from "./block-registry.js";
import { LiveRedstone } from "./redstone-live.js";
import { blockProperties } from "./redstone.js";
import { installShapedBlocks, trapdoorSupportOriginal } from "./shaped-blocks.js";
import { carpetNeighbourChange } from "./colored-blocks.js";
import { popDrops, stemDrops } from "./stems-cake.js";
import { NetherLive } from "./nether-portal-live.js";
import { wartTick } from "./nether-wart.js";
import { JavaRandom } from "./java-random.js";
import { ORIGINAL_ITEMS } from "./original-items.js";

// Port replays of the box, neighbour and tick columns of public/research/block-audit-reference.json (tools/probes/BlockAuditProbe.java, unchanged
// 1.7.10 classes): the b16 audit recorded them but only replayed facts, drops and placement.
const ref = JSON.parse(readFileSync(new URL("../public/research/block-audit-reference.json", import.meta.url))).records;
const of = (c) => ref.filter((r) => r.case === c);
const near = (a, b) => a && b && a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-4);
const P = [40, 20, 40];
const shared = new World("audit-columns"); // terrain generation is slow, so one World is cleared around P for every case
function cleared() {
  const world = shared;
  for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) for (let dz = -3; dz <= 3; dz++) world.put(P[0] + dx, P[1] + dy, P[2] + dz, 0, 0, false);
  return world;
}

// ---- boxes ----------------------------------------------------------------------------------------------------------
// Metadata the native game never stores: stems and gates above 7 (BlockStem/BlockFenceGate read raw metadata, so 8-15 are meaningless).
const INVALID_META = (id, meta) => ((id === 104 || id === 105 || id === 107) && meta >= 8) || (id === 92 && meta > 6) || (id === 115 && meta > 3);
// Native getCollisionBoundingBoxFromPool rows the port deliberately does not carry as one box (documented in block-behaviour-audit.md):
//   119 end portal: BlockEndPortal.addCollisionBoxesToList is empty, so entities pass; the box row is only the accessor.
//   171 carpet: a zero-height collision plane (maxY = y + 0): standing height equals the cell floor; the port has no collision, same stand height.
//   113 nether fence: BlockFence.getCollisionBoundingBoxFromPool is 1.0 high; the 1.5 high collision comes from addCollisionBoxesToList, which the port uses.
const COLLISION_EXEMPT = new Set([119, 171, 113]);

test("block audit boxes: selection bounds per metadata match the native setBlockBoundsBasedOnState", () => {
  const bad = [];
  const world = cleared();
  for (const r of of("box")) for (const m of r.metas) {
    if (INVALID_META(r.id, m.meta)) continue;
    const o = fromOriginal(r.id, m.meta);
    if (!o?.exact) continue;
    world.put(...P, o.id, o.meta, false);
    const b = blockBounds(world, ...P);
    if (!near(b, m.bounds)) bad.push(`${r.id}/${m.meta} port ${b?.map((v) => +v.toFixed(4))} native ${m.bounds}`);
  }
  assert.deepEqual(bad, []);
});

test("block audit boxes: collision box per metadata matches getCollisionBoundingBoxFromPool (cake is 1/16 below its selection box)", () => {
  const bad = [];
  let compared = 0;
  const world = cleared();
  for (const r of of("box")) for (const m of r.metas) {
    if (INVALID_META(r.id, m.meta) || COLLISION_EXEMPT.has(r.id)) continue;
    const o = fromOriginal(r.id, m.meta);
    if (!o?.exact) continue;
    world.put(...P, o.id, o.meta, false);
    const solid = world.solid(...P), native = m.collision?.length ? m.collision.map((v, i) => (i % 3 === 1 ? v - 1 : v)) : null;
    compared++;
    if (native === null) { if (solid) bad.push(`${r.id}/${m.meta} port collides, native has no box`); continue; }
    const c = solid ? collisionBounds(world, ...P) : null;
    if (!near(c, native)) bad.push(`${r.id}/${m.meta} port ${c?.map((v) => +v.toFixed(4))} native ${native}`);
  }
  assert.ok(compared > 300, `compared ${compared}`);
  assert.deepEqual(bad, []);
});

// ---- neighbour changes ----------------------------------------------------------------------------------------------
const inv = new Map();
for (const [k, v] of Object.entries(ORIGINAL_ITEMS)) { const [i, d = 0] = k.split(":").map(Number); if (!inv.has(v)) inv.set(v, [i, d]); }
const stackKey = (s) => { const o = inv.get(s.id) ?? [s.id, 0]; return `${o[0]}:${s.damage ?? o[1]}x${s.count}`; };
const SIDES = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];

// What the port does when side k of `id/meta` (stone on all six sides) is removed: the redstone engine (repeater, trapdoor), BlockCarpet,
// BlockStem/BlockCake (stems-cake.js popDrops), BlockNetherWart and BlockPortal (nether-portal-live.js). Returns [outcome, drops].
function portNeighbour(id, meta, k) {
  const world = cleared(), drops = [];
  const live = new LiveRedstone(world, { drop: (x, y, z, s) => drops.push(stackKey(s)) });
  installShapedBlocks(live, trapdoorSupportOriginal(blockProperties()));
  for (const d of SIDES) live.store(P[0] + d[0], P[1] + d[1], P[2] + d[2], 1, 0);
  const o = fromOriginal(id, meta);
  live.store(...P, id, meta);
  const at = [P[0] + SIDES[k][0], P[1] + SIDES[k][1], P[2] + SIDES[k][2]];
  live.setBlock(...at, 0, 0, 3);
  const gone = () => world.get(...P) !== o.id;
  if (!gone()) { const d = carpetNeighbourChange(world, ...P); if (d) drops.push(stackKey(d)); }
  if (!gone()) {
    const pop = popDrops(world, ...P);
    if (pop) { world.set(...P, 0); if (id === 104 || id === 105) drops.push(...nativeStemDrops(id, meta)); }
  }
  if (!gone()) {
    const nether = new NetherLive(world, { random: new JavaRandom(3), drop: (stacks) => drops.push(...stacks.map(stackKey)), apply: () => {}, normalCube });
    nether.neighbourChanged(...P);
  }
  return [gone() ? "breaks" : "stays", drops];
}
// BlockStem.dropBlockAsItemWithChance under the probe's Random(3): the port's stemDrops draws through nextInt, and every seed spawned by the
// native Block.dropBlockAsItem_do consumes three nextFloat offsets from the same Random before the next roll.
function nativeStemDrops(id, meta) {
  const rng = new JavaRandom(3);
  let pending = false;
  const nextInt = (n) => {
    if (pending) { rng.nextFloat(); rng.nextFloat(); rng.nextFloat(); pending = false; }
    const v = rng.nextInt(n);
    pending = v <= meta;
    return v;
  };
  return stemDrops(id === 104 ? 159 : 160, meta, nextInt).map(stackKey);
}

test("block audit neighbours: removing a neighbour breaks or keeps the block like the native onNeighborBlockChange", () => {
  const bad = [];
  let compared = 0;
  for (const r of of("neighbour")) {
    if (INVALID_META(r.id, r.meta) || r.removedSide.some((s) => s.startsWith("EXC:"))) continue; // note block / trapped chest need a tile entity in the probe
    if (r.id === 92 && r.meta > 6) continue;
    const o = fromOriginal(r.id, r.meta);
    if (!o?.exact) continue;
    for (let k = 0; k < 6; k++) {
      const [outcome, drops] = portNeighbour(r.id, r.meta, k);
      compared++;
      const native = r.removedSide[k], nativeDrops = r.drops[k];
      if (outcome !== native) bad.push(`${r.id}/${r.meta} side ${k}: port ${outcome} native ${native}`);
      else if (native === "breaks" && JSON.stringify([...drops].sort()) !== JSON.stringify([...nativeDrops].sort())) bad.push(`${r.id}/${r.meta} side ${k}: port drops ${drops} native ${nativeDrops}`);
    }
  }
  assert.ok(compared > 400, `compared ${compared}`);
  assert.deepEqual(bad, []);
});

// ---- random ticks ---------------------------------------------------------------------------------------------------
test("block audit ticks: nether wart growth histogram over 200 seeds matches BlockNetherWart.updateTick", () => {
  for (const r of of("tick").filter((t) => t.id === 115)) {
    const hist = {};
    for (let seed = 0; seed < 200; seed++) {
      const world = cleared();
      world.put(P[0], P[1] - 1, P[2], 151, 0, false);
      world.put(...P, 170, r.meta, false);
      wartTick(world, ...P, new JavaRandom(seed));
      const k = `115:${world.getMeta(...P)} spawn0`;
      hist[k] = (hist[k] || 0) + 1;
    }
    assert.deepEqual(hist, r.outcomes, `wart meta ${r.meta}`);
  }
});
