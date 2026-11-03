import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JavaRandom } from "./java-random.js";
import { ENCHANTMENT_LIST, ENCHANTED_BOOK } from "./enchantments.js";
import {
  ANVIL_BLOCK, REPAIR_MATERIAL, isRepairable, isBlank, rarityMultiplier, updateRepairOutput, damagedAnvilMetadata, AnvilContainer,
  ANVIL_DAMAGE_CHANCE,
} from "./anvil.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/anvil-reference.json", import.meta.url)));
const pairs = (a) => a.map(([id, lvl]) => ({ id, lvl }));
// [id, count, damage, ench, stored, unbreakable, repairCost, customName]
const decode = (s) => {
  if (!s) return null;
  const st = { id: s[0], count: s[1], damage: s[2], enchantments: pairs(s[3]), storedEnchantments: pairs(s[4]), unbreakable: !!s[5], repairCost: s[6] };
  if (s[7] !== null) st.displayName = s[7];
  return st;
};
const encode = (s) => s && [s.id, s.count ?? 1, s.damage ?? 0, (s.enchantments || []).map((e) => [e.id, e.lvl]), (s.storedEnchantments || []).map((e) => [e.id, e.lvl]), s.unbreakable ? 1 : 0, s.repairCost | 0, s.displayName ?? null];
const itemName = (stack) => ref.names[stack.id] ?? "";

// The probe's world: one cell holding the anvil (or air), logging what the container asks the world to do.
function makeWorld(meta, remote, log) {
  const w = {
    isRemote: remote,
    meta,
    getBlock: (x, y, z) => (x === 5 && y === 64 && z === -3 && w.meta >= 0 ? ANVIL_BLOCK : 0),
    getBlockMetadata: () => w.meta,
    setBlockMetadataWithNotify: (x, y, z, m, flags) => { log.push(`meta:${m}:${flags}`); w.meta = m; },
    setBlockToAir: () => { log.push("air"); w.meta = -1; },
    playAuxSFX: (id) => log.push(`aux:${id}`),
  };
  return w;
}
function rig({ creative, remote, meta, seed }) {
  const log = [], w = makeWorld(meta, remote, log);
  const player = { creative: !!creative, experienceLevel: 0, experienceTotal: 0, experience: 0.25 };
  const random = new JavaRandom(seed);
  return { log, player, random, container: new AnvilContainer({ world: w, x: 5, y: 64, z: -3, player, random, itemName }), world: w };
}

test("repair material table, item list and quirky helpers match the original", () => {
  assert.ok(ref.items.length > 300);
  for (const id of ref.items) {
    const mats = ref.materials[id] || [];
    for (const m of ref.items) assert.equal(isRepairable(id, m), mats.includes(m), `${id} ${m}`);
  }
  assert.deepEqual(Object.keys(REPAIR_MATERIAL).map(Number).sort((a, b) => a - b), Object.keys(ref.materials).map(Number).sort((a, b) => a - b));
  for (const [s, blank] of [[null, true], ["", true], [" \t\n", true], ["\u2003", true], ["\u3000", true], ["\u001f", true], ["\u00a0", false], ["\u2007", false], ["\u202f", false], ["a", false], [" a ", false]])
    assert.equal(isBlank(s), blank, JSON.stringify(s));
  assert.deepEqual([1, 2, 5, 10, 3].map(rarityMultiplier), [8, 4, 2, 1, 0]);
  assert.deepEqual([...new Set(ENCHANTMENT_LIST.map((e) => e.weight))].sort((a, b) => a - b), [1, 2, 5, 10]);
});

function replay(kind, { takes }) {
  const rows = ref[kind];
  assert.ok(rows.length > 0);
  let taken = 0, outputs = 0;
  for (const [left, right, name, creative, remote, meta, seed, level, total, out, maxCost, used, can, take] of rows) {
    const label = JSON.stringify([left, right, name, creative]);
    const r = rig({ creative, remote: !!remote, meta, seed });
    r.container.setInput(0, decode(left));
    r.container.setInput(1, decode(right));
    if (name !== null) r.container.setName(name);
    assert.deepEqual(encode(r.container.output), out, label);
    assert.equal(r.container.maximumCost, maxCost, label);
    assert.equal(r.container.stackSizeToBeUsedInRepair, used, label);
    if (out) outputs++;
    // The same inputs through the pure function.
    const pure = updateRepairOutput(decode(left), decode(right), name, { creative: !!creative, itemName });
    assert.deepEqual([encode(pure.output), pure.maximumCost], [out, maxCost], label);
    Object.assign(r.player, { experienceLevel: level, experienceTotal: total, experience: 0.25 });
    assert.equal(r.container.canTake(), !!can, label);
    if (take) {
      taken++;
      assert.ok(takes);
      const stack = r.container.take();
      assert.deepEqual(encode(stack), out, label);
      const [slot1, lvl, tot, progress, events, worldMeta, cost, slot0, next] = take;
      assert.deepEqual(encode(r.container.inputs[1]), slot1, label);
      assert.deepEqual(encode(r.container.inputs[0]), slot0, label);
      assert.deepEqual([r.player.experienceLevel, r.player.experienceTotal, r.player.experience], [lvl, tot, progress], label);
      assert.deepEqual(r.log, events, label);
      assert.equal(r.world.meta, worldMeta, label);
      assert.equal(r.container.maximumCost, cost, label);
      assert.equal(r.random.nextInt(), next, label);
    }
  }
  return { count: rows.length, taken, outputs };
}

test("random item pairs: output stack, maximum cost, material count, can-take and the take step", () => {
  const { count, taken, outputs } = replay("repair", { takes: true });
  assert.ok(count >= 9000 && taken > 500 && outputs > 2000, `${count} ${taken} ${outputs}`);
  console.log(`replayed ${count} random cases (${outputs} with an output, ${taken} taken)`);
});

test("every damageable item with every repair material, counts 1/2/64 and three damage levels", () => {
  const { count, taken } = replay("material", { takes: true });
  assert.ok(count >= 700 && taken > 50);
  console.log(`replayed ${count} material cases (${taken} taken)`);
});

test("enchantment pairs: every id on every id across items, books and creative", () => {
  const { count, outputs } = replay("conflict", { takes: false });
  assert.ok(count >= 2000 && outputs > 1000);
  console.log(`replayed ${count} conflict cases (${outputs} with an output)`);
});

test("anvil block damage: seeded 12% rolls, metadata stages 0/4/8, break, creative/remote/air", () => {
  assert.equal(ANVIL_DAMAGE_CHANCE, Math.fround(0.12));
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(damagedAnvilMetadata), [4, 5, 6, 7, 8, 9, 10, 11, -1, -1, -1, -1]);
  for (const [seed, hits, next] of ref.roll) {
    const r = new JavaRandom(seed), got = [];
    for (let i = 0; i < 400; i++) if (r.nextFloat() < ANVIL_DAMAGE_CHANCE) got.push(i);
    assert.deepEqual(got, hits, String(seed));
    assert.equal(r.nextInt(), next);
  }
  let broke = 0, steps = 0;
  for (const [creative, remote, meta, seed, recorded, next] of ref.block) {
    const r = rig({ creative, remote: !!remote, meta, seed });
    recorded.forEach(([can, events, worldMeta, lvl], i) => {
      r.log.length = 0;
      r.player.experienceLevel = 100;
      r.container = new AnvilContainer({ world: r.world, x: 5, y: 64, z: -3, player: r.player, random: r.random, itemName });
      r.container.setInput(0, { id: 257, count: 1, damage: 100 });
      r.container.setInput(1, { id: 265, count: 2 });
      assert.equal(r.container.canTake(), !!can);
      if (can) r.container.take();
      assert.deepEqual([r.log, r.world.meta, r.player.experienceLevel], [events, worldMeta, lvl], `${seed} step ${i}`);
      steps++;
      if (events.includes("air")) broke++;
    });
    assert.equal(r.random.nextInt(), next, String(seed));
  }
  assert.ok(broke > 20 && steps > 500, `${broke} ${steps}`);
  console.log(`replayed ${ref.block.length} anvil block sequences (${steps} uses, ${broke} breaks) and ${ref.roll.length} roll streams`);
});

test("no left stack: no output, and the container keeps its previous material count", () => {
  const book = { id: ENCHANTED_BOOK, count: 1, storedEnchantments: [{ id: 16, lvl: 1 }] };
  assert.deepEqual(updateRepairOutput(null, book, "x"), { output: null, maximumCost: 0, stackSizeToBeUsedInRepair: null });
});
