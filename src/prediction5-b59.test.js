// Batch 59 prediction5: flower pot contents, empty-bucket stacks, the command block screen, dragon egg particles, splash potions, real fire losing support and flint-and-steel fire,
// all at the click. Replayed against public/research/client-predict-reference.json (tools/probes/ClientPredictProbe.java, unchanged 1.7.10 classes, isRemote world double).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World, WATER, LAVA } from "./world.js";
import { fromOriginal } from "./block-registry.js";
import { PlayerInventory, makeStack } from "./inventory.js";
import { ITEMS } from "./survival.js";
import { createPrediction, dryBreak, dryFlint, dryPot, heldPlan, applyHeldPlan, useKind, throwsPotion, clientNeighbourChange } from "./client-prediction.js";
import { clientDragonEgg } from "./dragon-egg-live.js";
import { ITEM_POTION } from "./potions.js";

const main = readFileSync(new URL("./main.js", import.meta.url), "utf8");
const edit = readFileSync(new URL("./player-edit-simulation.js", import.meta.url), "utf8");
const ref = JSON.parse(readFileSync(new URL("../public/research/client-predict-reference.json", import.meta.url), "utf8"));
const records = (kind) => ref.records.filter((r) => r.case === kind);
const named = (kind, name) => records(kind).find((r) => r.name === name);
const mapped = (id, meta) => (id === 0 ? { id: 0, meta: 0 } : fromOriginal(id, meta));
const key = (x, y, z, b, m) => `${x},${y},${z},${b},${m}`;
const DY = -30;
const flat = () => { const w = new World("b59-p5"); for (let x = 2; x <= 14; x++) for (let z = 2; z <= 14; z++) { for (let y = 28; y <= 40; y++) w.set(x, y, z, 0, false, 0); w.set(x, 33, z, 1, false, 0); } return w; };
const load = (r) => { const w = flat(); for (const [x, y, z, id, meta] of r.setup) { const m = mapped(id, meta); w.set(x, y + DY, z, m.id, false, m.meta); } return w; };
const wantCells = (diff) => diff.map(([x, y, z, id, meta]) => { const m = mapped(id, meta); return key(x, y + DY, z, m.id, m.meta); }).sort();
const gotCells = (cells) => cells.map((c) => key(c.x, c.y, c.z, c.block, c.meta)).sort();
const FIRE = mapped(51, 0).id;

test("b59: a broken support removes a real fire, a flammable neighbour keeps it (executed break records)", () => {
  let checked = 0;
  for (const r of records("break").filter((x) => /fire/.test(x.name))) {
    const w = load(r), p = [r.target[0], r.target[1] + DY, r.target[2]];
    assert.deepEqual(gotCells(dryBreak({ world: w }, p).cells), wantCells(r.diff), r.name);
    checked++;
  }
  assert.equal(checked, 5);
  const w = flat(); w.set(8, 34, 8, FIRE, false, 0);
  w.set(8, 33, 8, 0, false, 0);
  clientNeighbourChange(w, 8, 34, 8);
  assert.equal(w.get(8, 34, 8), 0, "the unsupported fire goes");
});

test("b59: flint and steel sets fire beside the face on the client; unsupported or occupied cells stay empty; the stack is damaged by 1 (executed use records)", () => {
  let checked = 0;
  const steps = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
  for (const r of records("use").filter((x) => x.item === 259)) {
    const w = load(r), [x, y, z, side] = r.at, block = [x, y + DY, z], adjacent = block.map((v, i) => v + steps[side][i]);
    assert.deepEqual(gotCells(dryFlint({ world: w }, { block, adjacent })), wantCells(r.diff), r.name);
    assert.equal(r.itemDamage, r.damage + 1, `${r.name}: damageItem(1) runs on the client too`);
    assert.equal(r.count, 3, `${r.name}: the stack size is untouched`);
    const stack = { id: 126, count: 1, damage: r.damage };
    const plan = heldPlan({ kind: "flint", stack, creative: false });
    assert.deepEqual(plan, { dCount: 0, dDamage: 1 });
    const inv = new PlayerInventory(ITEMS); inv.main[0] = stack;
    const undo = applyHeldPlan(inv, plan);
    assert.equal(stack.damage, r.itemDamage); undo(); assert.equal(stack.damage, r.damage);
    checked++;
  }
  assert.equal(checked, 8);
  assert.equal(heldPlan({ kind: "flint", stack: { id: 126, count: 1, damage: 0 }, creative: true }), null);
  assert.equal(heldPlan({ kind: "flint", stack: { id: 126, count: 1, damage: 63 }, creative: false }), null, "a breaking tool is left to the server");
  const w = flat();
  assert.equal(useKind({ world: w, target: { block: [8, 33, 8], adjacent: [8, 34, 8] }, heldId: 126, sneaking: false, aimed: false }), "flint");
});

test("b59: a flower pot takes the plant on the client: its tile content, the metadata and one item (executed pot records)", () => {
  const w = flat(); const pot = mapped(140, 0); w.set(8, 34, 8, pot.id, false, pot.meta);
  const target = { block: [8, 34, 8], adjacent: [8, 35, 8] };
  const cases = [["pot-hold38-d0", 44, 0], ["pot-hold37-d0", 43, 0], ["pot-hold6-d1", 48, 1], ["pot-hold6-d5", 48, 5], ["pot-hold40-d0", 76, 0]];
  for (const [name, id, damage] of cases) {
    const r = named("activate", name), got = dryPot({ world: w, heldId: id, heldDamage: damage }, target);
    assert.ok(got, name);
    assert.equal(r.potTile[0] > 0, true, `${name}: the tile holds a plant`);
    assert.equal(got.cell.meta, got.content.id === 44 || got.content.id === 48 ? damage : 0, `${name} meta`);
    assert.equal(r.potTile[1], damage, `${name}: tile data`);
    assert.equal(useKind({ world: w, target, heldId: id, heldDamage: damage, sneaking: false, aimed: false }), "pot", name);
  }
  assert.equal(dryPot({ world: w, heldId: 1, heldDamage: 0 }, target), null, "stone goes in no pot (record pot-hold1-d0 result false)");
  assert.equal(named("activate", "pot-hold1-d0").result, false);
  assert.equal(named("activate", "pot-empty-hand").result, false);
  assert.deepEqual(named("activate", "pot-hold38-creative").held, [38, 2], "Creative keeps the stack");
  assert.equal(named("activate", "pot-hold37-d0").held[1], 1, "one of two taken");
  assert.deepEqual(heldPlan({ kind: "pot", stack: { id: 44, count: 2, damage: 0 }, creative: false, placed: true }), { dCount: -1 });
  assert.equal(heldPlan({ kind: "pot", stack: { id: 44, count: 2, damage: 0 }, creative: true, placed: true }), null);
  assert.equal(useKind({ world: w, target, heldId: 1, sneaking: false, aimed: false }), null);
});

test("b59: the overlay answers the view's pots with the predicted plant and drops it with its entry", () => {
  const w = flat(); const pot = mapped(140, 0); w.set(8, 34, 8, pot.id, false, pot.meta);
  const layer = createPrediction(w);
  assert.equal(layer.setPot(8, 34, 8, { id: 44, damage: 0 }), false, "no entry, nothing to hang it on");
  layer.set(8, 34, 8, pot.id, 1, 7);
  assert.equal(layer.setPot(8, 34, 8, { id: 44, damage: 3 }), true);
  assert.deepEqual(layer.view.pots.get("8,34,8"), { id: 44, damage: 3 });
  assert.equal(w.pots?.get("8,34,8"), undefined, "the real world is untouched");
  layer.clear(8, 34, 8, 7);
  assert.equal(layer.view.pots?.get("8,34,8"), undefined);
});

test("b59: an empty bucket stack gives one and the filled bucket goes to the first free slot (executed stack records)", () => {
  const port = { 325: 340, 326: 341, 327: 342 };
  for (const name of ["empty-stack2-water", "empty-stack16-lava"]) {
    const r = named("bucket", name), took = r.inventory[1][1] === 326 ? WATER : LAVA;
    const inv = new PlayerInventory(ITEMS); inv.main[0] = makeStack(340, r.count);
    const plan = heldPlan({ kind: "bucket", stack: inv.held, creative: false, placed: true, took });
    assert.ok(plan.give, name); assert.equal(plan.dCount, -1);
    const undo = applyHeldPlan(inv, plan);
    assert.deepEqual(inv.main.map((s, i) => s && [i, s.id, s.count]).filter(Boolean), r.inventory.map(([i, id, n]) => [i, port[id], n]), name);
    undo();
    assert.deepEqual(inv.main.map((s, i) => s && [i, s.id, s.count]).filter(Boolean), [[0, 340, r.count]], `${name}: undone`);
  }
  const full = named("bucket", "empty-stack2-water-full-inventory");
  assert.equal(full.spawned, 1, "no free slot: the client drops it (the entity itself is the server's)");
  assert.equal(full.resultCount, 1);
  const inv = new PlayerInventory(ITEMS); inv.main.fill(null).forEach(() => {});
  for (let i = 0; i < 36; i++) inv.main[i] = makeStack(1, 64);
  inv.main[0] = makeStack(340, 2);
  const undo = applyHeldPlan(inv, heldPlan({ kind: "bucket", stack: inv.held, creative: false, placed: true, took: WATER }));
  assert.equal(inv.held.count, 1); assert.equal(inv.main.filter((s) => s?.id === 341).length, 0);
  undo(); assert.equal(inv.held.count, 2);
  assert.equal(heldPlan({ kind: "bucket", stack: makeStack(340, 2), creative: true, placed: true, took: WATER }), null);
  assert.equal(named("bucket", "empty-stack2-creative").inventory.length, 1);
});

test("b59: the command block opens its screen at the click from the client's tile, for a non-creative player too (executed)", () => {
  const withTile = named("commandblock", "commandblock-tile"), without = named("commandblock", "commandblock-no-tile");
  assert.equal(withTile.openedScreen, true); assert.equal(without.openedScreen, false);
  const w = flat(); const cb = mapped(137, 0); w.set(8, 34, 8, cb.id, false, 0);
  assert.equal(useKind({ world: w, target: { block: [8, 34, 8], adjacent: [8, 35, 8] }, heldId: 1, sneaking: false, aimed: false }), "command");
  assert.equal(useKind({ world: w, target: { block: [8, 34, 8], adjacent: [8, 35, 8] }, heldId: 1, sneaking: true, aimed: false }) === "command", false, "sneaking with an item skips onBlockActivated");
  assert.match(main, /kind === 'command'\) \{ if \(screen === "playing"\) openCommandBlock\(\.\.\.target\.block, null, true\)/);
  assert.match(main, /if \(!atClick && \(!survival\.creative \|\| !commandHost\.cheats\)\) return;/);
  assert.match(main, /done: \(command\) => \{ if \(!survival\.creative \|\| !commandHost\.cheats\)/, "the server's MC|AdvCdm check stays on the edit");
});

test("b59: dragon egg particles run on the client at the click (activate and punch), the move stays the server's (executed records)", () => {
  for (const r of [named("activate", "dragonegg-activate"), named("blockclick", "dragonegg-click")]) {
    assert.deepEqual(r.diff, [], "no block changes on the client");
    assert.equal(r.log.filter((l) => l.startsWith("particle portal")).length, 128, r.name);
  }
  const w = flat(); const egg = mapped(122, 0); w.set(8, 34, 8, egg.id, false, 0);
  let n = 0, flip = 0; const rnd = { nextInt: () => (flip++ % 2 ? 2 : 5), nextDouble: () => 0.5, nextFloat: () => 0.5 };
  assert.equal(clientDragonEgg({ world: w, clientRandom: () => rnd, spawnParticle: () => { n++; } }, 8, 34, 8), true);
  assert.equal(n, 128); assert.equal(w.get(8, 34, 8), egg.id, "the egg stays");
  assert.equal(useKind({ world: w, target: { block: [8, 34, 8], adjacent: [8, 35, 8] }, heldId: 0, sneaking: false, aimed: false }), "egg");
  assert.match(main, /kind === 'egg'\) \{ eggClient\(target\.block\); eggDone = true;/);
  assert.match(main, /skipClient \|\| eggClientDone/);
  assert.match(edit, /hook\('clientDragonEgg', \.\.\.dug\)/);
  assert.match(edit, /hook\('useDragonEgg', \.\.\.dug, true\)/);
  assert.match(main, /bje\.b|clientDragonEgg: \(x, y, z\) => \{ eggClient\(\[x, y, z\]\); \}/);
});

test("b59: a splash potion takes one from the client stack like the other throws, a drinkable potion keeps its count (executed throw records)", () => {
  assert.equal(throwsPotion(ITEM_POTION, 16400), true); assert.equal(throwsPotion(ITEM_POTION, 8197), false); assert.equal(throwsPotion(1, 16400), false);
  assert.equal(named("throw", "throw373-x5").resultCount, 4);
  assert.equal(named("throw", "throw373-x1").resultCount, 0);
  assert.equal(named("throw", "throw373-creative").resultCount, 5);
  assert.equal(named("throw", "drink373-x5").resultCount, 5);
  assert.equal(named("throw", "throw373-x5").spawned, 0, "the entity is the server's");
  assert.deepEqual(heldPlan({ kind: "throw", stack: { id: ITEM_POTION, count: 5, damage: 16400 }, creative: false }), { dCount: -1 });
  assert.match(main, /throwsPotion\(held, survival\.held\?\.damage\)/);
});
