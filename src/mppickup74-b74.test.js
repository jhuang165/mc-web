// Batch 74 (mppickup74): the dedicated server takes dropped items and stuck arrows in one pass in the world's list order. The 700 executed scenes of
// public/research/pickup-order-reference.json (PickupOrderProbe: the unchanged 1.7.10 pickup loop over real chunks) are replayed through the server's tick pass
// (ServerDispense.collectArrows) and through the client's `pickup` message.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "./world.js";
import { makeStack } from "./inventory.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { ARROW } from "./bow.js";
import { stampEntity } from "./candidate-order.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/pickup-order-reference.json", import.meta.url))).records;
const f = Math.fround, STONE = 3, NATIVE = { "1": STONE, "262": ARROW }, invOf = (p) => p.survival.inventory.main.map((x) => (x ? `${x.id}*${x.count}` : 0));
const natInv = (a) => a.map((v) => (v === 0 ? 0 : v.replace(/^(\d+)\*/, (_, id) => `${NATIVE[id]}*`)));
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

function fixture() {
  const world = new World("mp-pickup-b74");
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: "survival", mobs: true });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  const p = s.addPlayer("a", "ax", key(1));
  s.input("a", { type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
  return { s, p };
}
function load({ s, p }, r) {
  s.items.items = []; s.dispense.arrows.list = []; s.dispense.collected = []; s.serverItems.taken = []; p.collectedOut = [];
  p.survival.inventory.main.fill(null);
  r.before.forEach((v, i) => { p.survival.inventory.main[i] = v === 0 ? null : makeStack(NATIVE[v.split("*")[0]], +v.split("*")[1]); });
  const made = [];
  for (const [kind, name, n, pos, moved] of r.entities) {
    if (kind === "orb") { made.push(null); continue; } // orbs have their own pass (tickOrbs)
    const [x, y, z] = pos, [mx, , mz] = moved ?? pos;
    let e;
    if (kind === "item") e = s.items.spawn({ id: name === "arrow" ? ARROW : STONE, count: n, damage: 0 }, mx, y, mz, { motion: [0, 0, 0] });
    else { e = s.dispense.arrows.make({ x: mx, y, z: mz, mx: 0, my: 0, mz: 0, yaw: 0, pitch: 0 }, s.dispense.arrows.rng(), { inGround: true, pickup: 1, shooter: null }); e.shake = 0; s.dispense.arrows.list.push(e); }
    stampEntity(e, x, y, z); if (moved) stampEntity(e, mx, y, mz);
    made.push(e);
  }
  p.position.copy({ x: r.feet[0], y: r.feet[1] + 1.62 - f(1.62), z: r.feet[2] });
  return made;
}
function trace(s, made, taken) { // the order the server takes things in
  const si = s.serverItems, itemTake = si.takeItem.bind(si), arrows = s.dispense.arrows, arrowTake = arrows.takeOne.bind(arrows);
  si.takeItem = (pl, e, ...rest) => { const ok = itemTake(pl, e, ...rest); if (ok) taken.push(made.indexOf(e)); return ok; };
  arrows.takeOne = (a, ...rest) => { const ok = arrowTake(a, ...rest); if (ok) taken.push(made.indexOf(a)); return ok; };
  return () => { delete si.takeItem; delete arrows.takeOne; };
}
const run = (fx, r, via) => {
  const made = load(fx, r), taken = [], undo = trace(fx.s, made, taken);
  try {
    if (via === "tick") fx.s.dispense.collectArrows(fx.s.dispense);
    else fx.s.pickup("a", fx.s.items.items.map((e) => e.eid));
  } finally { undo(); }
  return { taken, inv: invOf(fx.p), collected: fx.s.dispense.collected.length };
};

test("the server's tick pass takes items and arrows in native list order (700 executed scenes: order, inventory, collect rows)", () => {
  const fx = fixture();
  let mixed = 0;
  for (const [n, r] of ref.entries()) {
    if (!r.entities.some((e) => e[0] === "arrow")) continue; // the tick pass runs while stuck arrows exist (items alone: the client's pickup message)
    const got = run(fx, r, "tick"), kinds = r.entities.map((e) => e[0]), want = r.taken.filter((i) => kinds[i] !== "orb");
    assert.deepEqual(got.taken, want, `scene ${n} order`);
    assert.deepEqual(got.inv, natInv(r.inventory), `scene ${n} inventory`);
    assert.equal(got.collected, want.filter((i) => kinds[i] === "arrow").length, `scene ${n} arrow rows`);
    if (new Set(want.map((i) => kinds[i])).size > 1) mixed++;
  }
  assert.ok(mixed > 100, `${mixed} scenes take both kinds`);
});

test("the client's pickup message joins the stuck arrows in reach into the same pass (700 scenes)", () => {
  const fx = fixture();
  for (const [n, r] of ref.entries()) {
    if (!r.candidates.some((i) => r.entities[i][0] === "item")) continue; // a pickup message needs an item in reach to name
    const got = run(fx, r, "msg"), kinds = r.entities.map((e) => e[0]), want = r.taken.filter((i) => kinds[i] !== "orb");
    assert.deepEqual(got.taken, want, `scene ${n} order`);
    assert.deepEqual(got.inv, natInv(r.inventory), `scene ${n} inventory`);
  }
});

test("with no stuck arrow the item pickup is the old item-only path, and with no item the arrow-only path", () => {
  const fx = fixture(), { s, p } = fx;
  load(fx, { before: [], entities: [], feet: [64.5, 10, 64.5] });
  const it = s.items.spawn({ id: STONE, count: 3, damage: 0 }, 64.5, 10.5, 64.5, { motion: [0, 0, 0] });
  assert.equal(s.pickup("a", [it.eid]), true);
  assert.equal(invOf(p).filter((v) => v !== 0)[0], `${STONE}*3`);
  assert.equal(s.serverItems.taken.length, 1);
});

test("a partial take (the stack does not fit whole) shrinks the item but sends no S0D, pop or pickup event, as addItemStackToInventory answers false (executed)", () => {
  const fx = fixture(), { s, p } = fx;
  load(fx, { before: Array(36).fill("1*64").fill(0, 35).map((v, i) => (i === 35 ? "1*40" : v)), entities: [], feet: [64.5, 10, 64.5] });
  p.survival.inventory.main[35] = makeStack(STONE, 40);
  const it = s.items.spawn({ id: STONE, count: 30, damage: 0 }, 64.5, 10.5, 64.5, { motion: [0, 0, 0] });
  const sounds = s.soundsOut.length;
  s.pickup("a", [it.eid]);
  assert.equal(p.survival.inventory.main[35].count, 64);
  assert.equal(it.stack.count, 6);
  assert.equal(s.serverItems.taken.length, 0);
  assert.equal(s.soundsOut.length, sounds);
  assert.ok(!s.items.items.every((e) => e.dead) && s.items.items.includes(it));
});
