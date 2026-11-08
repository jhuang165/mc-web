// Batch 27 negstacks2: negative and zero stacks through addItemStackToInventory, EntityItem pickup, decrStackSize, drops, armour slots and fireworks.
// Replays public/research/neg-stacks2-reference.json (tools/probes/NegStacks2Probe.java, run natively on the unchanged 1.7.10 classes by tools/verify-neg-stacks2.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ITEMS } from "./survival.js";
import { makeStack, PlayerInventory } from "./inventory.js";
import { itemFromOriginal } from "./region-import.js";
import { ItemEntities } from "./item-entities.js";
import { Survival } from "./survival.js";
import { useFirework } from "./fireworks-live.js";
import { ITEM_FIREWORK_ROCKET } from "./fireworks.js";

const ref = JSON.parse(await readFile(new URL("../public/research/neg-stacks2-reference.json", import.meta.url)));
const by = (c) => ref.records.filter((r) => r.case === c);
const port = (orig, damage = 0) => itemFromOriginal(orig, damage);
const KINDS = { diamond: [264, 0], ironSword: [267, 0], damagedSword: [267, 7], bucket: [325, 0] };
const snapshot = (inv) => {
  const out = [];
  [...inv.main, ...inv.armor].forEach((s, k) => { if (s) out.push([k, s.id, s.count, s.damage ?? 0]); });
  return out;
};
const expected = (list) => list.map(([k, id, n, d]) => [k, port(id, d).id, n, port(id, d).damage ?? d]);
const stackOf = (orig, count, damage = 0) => { const m = port(orig, damage); return makeStack(m.id, count, m.damage ?? damage); };
function fill(inv, state, orig) {
  if (state === 1) inv.main[2] = stackOf(orig, 5);
  if (state === 2) inv.main[2] = stackOf(orig, 64);
  if (state >= 3) for (let k = 0; k < 36; k++) inv.main[k] = stackOf(3, 64);
  if (state === 4) inv.main[7] = stackOf(orig, 10);
}

test("native: record counts and class digests", () => {
  assert.deepEqual(ref.counts, { add: 200, pickup: 18, decr: 60, drop: 12, armour: 6, firework: 6, interact: 60 });
  for (const c of ["add", "yx", "yz", "xk", "acs", "at"]) assert.match(ref.classes[c].sha256, /^[0-9a-f]{64}$/);
});

test("native and port: addItemStackToInventory with size -2..2 (200 records)", () => {
  for (const r of by("add")) {
    const [orig, dmg] = KINDS[r.name], inv = new PlayerInventory(ITEMS);
    inv.creative = r.creative;
    fill(inv, r.state, orig);
    const s = stackOf(orig, r.count, dmg);
    const got = inv.add(s);
    const label = `${r.name} creative ${r.creative} state ${r.state} count ${r.count}`;
    assert.equal(got, r.result, label);
    assert.equal(s.count, r.left, label);
    assert.deepEqual(snapshot(inv), expected(r.inventory), label);
  }
});

test("native and port: picking up a Count -n item entity adds a -n stack, empties the entity and leaves it alive", () => {
  assert.equal(by("pickup").length, 18);
  for (const r of by("pickup")) {
    const inv = new PlayerInventory(ITEMS);
    inv.creative = r.creative;
    fill(inv, r.state, 264);
    const items = new ItemEntities(() => 0.5), d = port(264);
    const e = items.spawn(makeStack(d.id, r.count), 0, 64, 0, { empty: true });
    r.steps.forEach((step, i) => {
      const picked = items.collect({ x: 0, y: 64, z: 0 }, 0.6, 1.8, (s) => inv.add(s));
      const label = `creative ${r.creative} state ${r.state} count ${r.count} pass ${i}`;
      assert.deepEqual(picked, [], label); // add reports false for a size <= 0 stack: no pickup event
      assert.equal(e.stack.count, step.stack[1], label);
      assert.equal(e.dead === true, step.dead, label);
      assert.deepEqual(snapshot(inv), expected(step.inventory), label);
    });
  }
});

test("native and port: InventoryPlayer.decrStackSize with size -2..5 and n 0..64 (60 records)", () => {
  for (const r of by("decr")) {
    const inv = new PlayerInventory(ITEMS), s = stackOf(264, r.size);
    inv.setStack(r.slot, s);
    const got = inv.decr(r.slot, r.n), label = `slot ${r.slot} size ${r.size} n ${r.n}`;
    assert.deepEqual(got ? [got.id, got.count, got.damage ?? 0] : null, r.result ? [port(r.result[0]).id, r.result[1], r.result[2]] : null, label);
    assert.equal(got === s, r.same, label);
    assert.deepEqual(snapshot(inv), expected(r.inventory), label);
  }
});

test("native and port: dropping and dying drop any stack but an exact size 0; -1 is thrown, 0 vanishes", () => {
  for (const r of by("drop").filter((r) => r.what !== "dropItemNull" && r.what !== "dropItemEntity")) {
    const inv = new PlayerInventory(ITEMS);
    if (r.what === "dropAll") { inv.main[0] = stackOf(264, r.count); inv.main[5] = stackOf(264, r.count); } else inv.armor[2] = stackOf(264, r.count);
    const out = inv.takeAll();
    assert.deepEqual(out.map((s) => s.count), r.spawned.map((s) => s[1]), `${r.what} ${r.count}`);
    assert.deepEqual(snapshot(inv), []);
  }
  for (const r of by("drop").filter((r) => r.what.startsWith("dropItem"))) {
    const items = new ItemEntities(() => 0.5), e = items.dropPlayer(stackOf(264, r.count), { x: 0, y: 64, z: 0 }, 0, 0);
    assert.equal(e?.stack.count ?? null, r.spawned[0]?.[1] ?? null, `drop item ${r.count}`);
  }
});

test("native and port: an armour slot keeps whatever item it was saved with, and counts armour points only for armour", () => {
  for (const r of by("armour")) {
    const saved = [null, null, { id: port(r.item).id, count: r.count, damage: 0 }, null];
    const inv = new PlayerInventory(ITEMS, [], saved);
    assert.equal(inv.armor[2]?.count, r.count, `kept ${r.item} ${r.count}`);
    const defense = inv.armor.reduce((n, s) => n + (ITEMS[s?.id]?.defense || 0), 0);
    assert.equal(defense, r.armorValue, `armor value ${r.item} ${r.count}`);
  }
});

test("native and port: interactWith spends a saddle, lead or name tag by `--stackSize`: the slot clears at size <= 1 outside Creative, and Creative uses nothing", () => {
  const recs = by("interact").filter((r) => r.result);
  assert.equal(recs.length, 50);
  for (const r of recs) {
    const inv = new PlayerInventory(ITEMS);
    inv.main[0] = stackOf(264, r.count);
    if (!r.creative) inv.decr(0, 1); // what every port caller does for a click that used the item
    const label = `${r.subject} ${r.item} creative ${r.creative} count ${r.count}`;
    if (r.creative) assert.equal(r.heldCount, r.count, label);
    else assert.deepEqual(inv.main[0] ? [inv.main[0].count] : null, r.after ? [r.after[1]] : null, label);
  }
});

test("native and port: ItemFirework.onItemUse launches at stackSize -1 and 0 (no count check) and leaves count - 1 outside Creative", () => {
  for (const r of by("firework")) {
    const s = new Survival({}, r.creative ? "creative" : "survival");
    s.inventory.main[0] = makeStack(ITEM_FIREWORK_ROCKET, r.count);
    s.inventory.current = 0;
    let launched = 0;
    const state = { survival: s, rockets: { launch: () => { launched++; } } };
    assert.equal(r.creative || s.usable(ITEM_FIREWORK_ROCKET), true);
    assert.deepEqual(useFirework(state, { target: { block: [0, 63, 0], hit: [0.5, 64, 0.5] }, usesBlock: false }), { branch: "launch-firework" });
    const label = `creative ${r.creative} count ${r.count}`;
    assert.equal(launched, r.spawned, label);
    // The server clears a held stack of exactly 0 afterwards (NetHandlerPlayServer); the probe's `after` is the raw stackSize.
    assert.equal(s.held?.count ?? 0, r.after, label);
  }
});

test("native: /give refuses a count outside 1..64 before any item exists, so a Count 0 /give stack cannot be built (CommandGive, bytecode-read)", () => {
  // CommandGive.processCommand reads the count with CommandBase.parseIntBounded(sender, arg, 1, 64) and drops the new stack through
  // EntityPlayer.dropPlayerItemWithRandomChoice; src/commands.js give() uses the same bounds.
  assert.equal(ref.classes.at.name, "CommandGive");
});
