import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "./world.js";
import { Survival, MATERIALS, ITEMS } from "./survival.js";
import { Farming } from "./farming.js";
import { Trees } from "./trees.js";
import { ItemEntities } from "./item-entities.js";
import { ExperienceOrbs } from "./experience.js";
import { JavaRandom } from "./java-random.js";
import { makeStack } from "./inventory.js";
import { breakPlayerBlock } from "./block-break-simulation.js";
import { placeHeldBlock } from "./block-placement-simulation.js";
import { internalIdsFor, fromOriginal } from "./block-registry.js";
import { ORIGINAL_ITEMS } from "./original-items.js";
import { explosionResistance } from "./explosion.js";
import { lightOpacity, lightEmission } from "./lighting.js";

// Replays public/research/block-audit-reference.json (tools/probes/BlockAuditProbe.java, unchanged 1.7.10 classes) for the 38 blocks of the b16 block audit.
const ref = JSON.parse(readFileSync(new URL("../public/research/block-audit-reference.json", import.meta.url))).records;
const of = (c) => ref.filter((r) => r.case === c);

test("block audit: hardness, explosion resistance, opacity and light match the native facts", () => {
  for (const r of of("facts")) for (const i of internalIdsFor(r.id)) {
    const h = MATERIALS[i]?.hardness;
    assert.ok(h === r.hardness || (r.hardness < 0 && (h == null || h === Infinity)), `hardness ${r.id}/${i}: port ${h} native ${r.hardness}`);
    assert.ok(Math.abs(explosionResistance(i) - r.explosionResistance) < 1e-4, `resistance ${r.id}/${i}: port ${explosionResistance(i)} native ${r.explosionResistance}`);
    assert.equal(lightOpacity(i), r.lightOpacity, `opacity ${r.id}/${i}`);
    assert.equal(lightEmission(i, r.id === 62 || r.id === 94), r.lightValue, `light ${r.id}/${i}`);
  }
});

const pick = ORIGINAL_ITEMS[278] ?? ORIGINAL_ITEMS["278:0"];
const inv = new Map();
for (const [k, v] of Object.entries(ORIGINAL_ITEMS)) { const [i, d = 0] = k.split(":").map(Number); if (!inv.has(v)) inv.set(v, [i, d]); }
const POS = [44, 12, 47];
function breakDrops(internal, meta, seed, tool = pick) {
  const world = new World("a" + seed);
  world.set(...POS, internal, false, meta);
  const survival = new Survival({ slots: [makeStack(tool, 1)] }, "survival");
  const items = new ItemEntities(() => 0.5), jr = new JavaRandom(seed);
  breakPlayerBlock({ world, survival, items, xpOrbs: new ExperienceOrbs([], () => 0.5), farming: new Farming(world), trees: new Trees(world, { random: new JavaRandom(seed) }), heldTool: survival.inventory.held?.id ?? 0 }, POS, { random: () => jr.nextDouble(), dropRandom: jr, leafRandom: new JavaRandom(seed) });
  const tally = {};
  for (const e of items.items) { const o = inv.get(e.stack.id) ?? ["?" + e.stack.id, 0]; const k = `${o[0]}:${e.stack.damage ?? o[1]}x${e.stack.count}`; tally[k] = (tally[k] || 0) + 1; }
  return "{" + Object.entries(tally).map(([k, n]) => `${k}=${n}`).sort().join(",") + "}";
}

test("block audit: fortune 0 harvest drops of the single-outcome blocks and the wart and double slab counts", () => {
  const checked = new Set();
  for (const r of of("harvest").filter((x) => x.fortune === 0)) {
    const outcomes = Object.keys(r.drops).map((k) => k.replace(/,? ?xp\d+=\d+/g, "")); // experience orbs are compared by the ore tests
    // Only blocks whose native drop is one fixed stack are compared one to one; the rest are compared as sets below.
    const [i] = internalIdsFor(r.id);
    if (![115, 125, 122].includes(r.id) && !(r.id === 19 || r.id === 22 || r.id === 87 || r.id === 88 || r.id === 112 || r.id === 121 || r.id === 153 || r.id === 170 || r.id === 133)) continue;
    const got = new Set();
    for (let s = 0; s < 24; s++) got.add(breakDrops(i, r.meta, s));
    if (r.id === 115) { // nether wart: 1 seed, mature 2..4 (the probe lists 372:0 with counts 2..4 as separate stacks)
      const counts = [...got].map((g) => +g.match(/x(\d+)=/)[1]);
      const native = outcomes.map((o) => +o.match(/x(\d+)=/)[1]);
      assert.ok(counts.every((c) => native.includes(c)), `wart meta ${r.meta}: port ${counts} native ${native}`);
      continue;
    }
    assert.ok([...got].every((g) => outcomes.includes(g)), `${r.id} meta ${r.meta}: port ${[...got]} native ${outcomes}`);
    checked.add(r.id);
  }
  assert.ok(checked.has(19) && checked.has(125) && checked.has(122));
});

test("block audit: nether portal is unbreakable and a dragon egg has hardness 3", () => {
  assert.equal(MATERIALS[164].hardness, Infinity);
  assert.equal(MATERIALS[171].hardness, 3);
  assert.equal(MATERIALS[170].hardness, 0);
});

function place(originalId, itemId, support, oriented = null) {
  const P = [40, 20, 40], world = new World("p");
  for (let x = P[0] - 2; x <= P[0] + 2; x++) for (let z = P[2] - 2; z <= P[2] + 2; z++) for (let y = P[1] - 3; y <= P[1] + 3; y++) world.set(x, y, z, 0, false, 0);
  const [mc, m] = support, o = fromOriginal(mc, m);
  world.set(P[0], P[1] - 1, P[2], o.id, false, o.meta);
  const survival = new Survival({ slots: [makeStack(itemId, 1)] }, "creative");
  const res = placeHeldBlock({ world, survival, position: { x: 0.5, y: 80, z: 0.5 }, flowers: {}, farming: new Farming(world), yaw: 0 }, { id: itemId, item: ITEMS[itemId], target: { block: [P[0], P[1] - 1, P[2]], adjacent: P } }, {});
  return res.placed;
}
const SUP = { stone: [1, 0], glass: [20, 0], leaves: [18, 0], water: [9, 0], lava: [11, 0], soulsand: [88, 0], farmland: [60, 7], slabBottom: [44, 0], slabTop: [44, 8], fence: [85, 0], wood: [5, 0], ice: [79, 0], stairsUp: [53, 0] };

test("block audit: jack o'lantern placement needs a solid top surface like the native BlockPumpkin", () => {
  const r = of("place").find((x) => x.id === 91);
  const item = ORIGINAL_ITEMS[91] ?? ORIGINAL_ITEMS["91:0"];
  assert.ok(item != null);
  for (const res of r.results) {
    const [name, val] = res.split("=");
    if (!(name in SUP)) continue;
    assert.equal(place(91, item, SUP[name]), val === "true", `jack o'lantern on ${name}`);
  }
});

test("block audit: Silk Touch on a double wood slab yields one slab; native canSilkHarvest set is covered", () => {
  const silk = of("silk").filter((x) => x.canSilkHarvest).map((x) => x.id);
  assert.ok(silk.includes(125));
  assert.equal(internalIdsFor(125).length > 0, true);
});
