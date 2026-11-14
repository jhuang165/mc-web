import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JavaRandom } from "./java-random.js";
import { Arrows, ARROW } from "./bow.js";
import { Fireballs } from "./fireballs.js";
import { Survival } from "./survival.js";
import { GaussianRandom } from "./projectiles.js";
import { makeStack } from "./inventory.js";
import { orderTargets, stampEntity } from "./candidate-order.js";

// Batch 72 (projectiles6). public/research/chunk-order-reference.json (tools/probes/ChunkOrderProbe.java): the unchanged World.getEntitiesWithinAABBExcludingEntity over
// real chunks (their 16 entity lists filled by the real addEntity / removeEntityAtIndex), the updateEntityWithOptionalForce re-slice (bytecode-read, composed) and
// EntityPlayer.onLivingUpdate's arrow trigger box (bytecode-read, composed) calling the real EntityArrow.onCollideWithPlayer.
const ref = JSON.parse(readFileSync(new URL("../public/research/chunk-order-reference.json", import.meta.url)));
const orders = ref.records.filter((r) => r.case === "order"), triggers = ref.records.filter((r) => r.case === "trigger");
const f = Math.fround, HALF = f(0.6) / 2, STONE = 1;
const over = (a, q) => a[3] > q[0] && a[0] < q[3] && a[4] > q[1] && a[1] < q[4] && a[5] > q[2] && a[2] < q[5];

test("the executed records show the order is observable", () => {
  assert.equal(orders.length, 700);
  assert.equal(triggers.length, 700);
  assert.ok(orders.filter((r) => r.candidates.some((v, i) => i && v < r.candidates[i - 1])).length > 400); // not insertion order
  assert.ok(orders.every((r) => r.picked === r.candidates[0])); // equal distances: the first candidate wins
  assert.ok(triggers.filter((r) => r.inventory === "full63" && r.taken.length === 1 && r.candidates.length > 1).length > 30);
});

function fireballScene(r) {
  const fb = new Fireballs({ fireballSeed: () => 1 }), made = [];
  for (const op of r.ops) {
    if (op[0] === "add") { const b = fb.launch({ large: true, x: op[2][0], y: op[2][1], z: op[2][2], dz: 0.1, exact: [0, 0, 0.1] }); b.ticks = 1; made[op[1]] = b; stampEntity(b, b.x, b.y, b.z); }
    else if (op[0] === "move") { const b = made[op[1]]; [b.x, b.y, b.z] = op[2]; stampEntity(b, b.x, b.y, b.z); }
    else for (const b of made) stampEntity(b, b.x, b.y, b.z); // the update's re-slice, in list order
  }
  return { fb, made };
}

test("candidate-order.js lists the entities the world query lists, in its order (chunk x, chunk z, slice, insertion; 700 scenes)", () => {
  for (const [n, r] of orders.entries()) {
    const { fb, made } = fireballScene(r), reach = r.creative ? 6 : 3;
    const viewer = [r.eye[0] - HALF, r.eye[1] - f(1.62), r.eye[2] - HALF, r.eye[0] + HALF, r.eye[1] - f(1.62) + f(1.8), r.eye[2] + HALF];
    const q = viewer.map((v, i) => (i < 3 ? Math.min(v, v + r.look[i] * reach) - 1 : Math.max(v, v + r.look[i - 3] * reach) + 1));
    const cands = made.filter((b) => over(fb.boxOf(b), q)).map((b) => ({ key: b, box: fb.boxOf(b) }));
    assert.deepEqual(orderTargets(cands).map((c) => made.indexOf(c.key)), r.candidates, `scene ${n}`);
  }
});

test("Fireballs.pick keeps the ball the native loop picks among equal distances (700 scenes)", () => {
  for (const [n, r] of orders.entries()) {
    const { fb, made } = fireballScene(r), reach = r.creative ? 6 : 3;
    const viewer = [r.eye[0] - HALF, r.eye[1] - f(1.62), r.eye[2] - HALF, r.eye[0] + HALF, r.eye[1] - f(1.62) + f(1.8), r.eye[2] + HALF];
    const hit = fb.pick({ x: r.eye[0], y: r.eye[1], z: r.eye[2] }, { x: r.look[0], y: r.look[1], z: r.look[2] }, reach, reach, viewer);
    assert.equal(hit ? made.indexOf(hit.entity) : -1, r.picked, `scene ${n}`);
    if (hit) assert.equal(hit.distance, r.distance, `scene ${n} distance`);
  }
});

function inventory(kind) {
  const s = new Survival({}, "survival"), main = s.inventory.main;
  main.fill(null);
  if (kind !== "empty") { for (let i = 0; i < 35; i++) main[i] = makeStack(STONE, 64); main[35] = kind === "full" ? makeStack(STONE, 64) : makeStack(ARROW, 63); }
  return s;
}
const arrowTotal = (s) => s.inventory.main.reduce((n, st) => n + (st && st.id === ARROW ? st.count : 0), 0);

test("Arrows.collect uses the player's trigger box (grown 1, 0.5, 1; riding union grown 1, 0, 1) and the chunk list order (700 executed scenes)", () => {
  let contested = 0, riding = 0;
  for (const [n, r] of triggers.entries()) {
    const arrows = new Arrows(() => 0.5), list = r.arrows.map(([x, y, z, shake]) => {
      const a = arrows.make({ x, y, z, mx: 0, my: 0, mz: 0, yaw: 0, pitch: 0 }, new GaussianRandom(1), { pickup: 1 });
      a.rand = new JavaRandom(7); a.inGround = true; a.shake = shake; arrows.list.push(a); stampEntity(a, a.x, a.y, a.z);
      return a;
    });
    const s = inventory(r.inventory), [px, py, pz] = r.feet;
    const feet = py + 1.62 - f(1.62), player = [px - HALF, feet, pz - HALF, px + HALF, feet + f(1.8), pz + HALF]; // the probe's setPosition(eye): the box starts one float yOffset below it
    const v = r.vehicle, vehicleBox = v && !v[3] ? [v[0] - 0.5, v[1], v[2] - 0.5, v[0] + 0.5, v[1] + 1, v[2] + 0.5] : null;
    assert.equal(arrowTotal(s), r.arrowsBefore);
    const n1 = arrows.collect(player, s, undefined, vehicleBox);
    const used = new Set(); // arrows can share a spot: the first not yet matched dead arrow there
    const took = arrows.drain().filter((e) => e.sound).map((e) => { const i = list.findIndex((a, j) => !used.has(j) && a.x === e.position.x && a.y === e.position.y && a.z === e.position.z && a.dead); used.add(i); return i; });
    assert.deepEqual(took, r.taken, `scene ${n} order`);
    assert.equal(n1, r.taken.length, `scene ${n}`);
    assert.equal(arrowTotal(s), r.arrowsAfter, `scene ${n} inventory`);
    if (r.inventory === "full63" && r.candidates.length > 1) contested++;
    if (vehicleBox) riding++;
  }
  assert.ok(contested > 100 && riding > 100);
});

// The live paths use the order too: of two targets at one distance, the arrow takes the one the world lists first (chunk z -1 before chunk z 0), whatever the order of the
// target list. Ground truth for the order itself is the executed ChunkOrderProbe above.
test("an arrow's sweep takes the first entity in chunk order among equal distances", () => {
  const worldAir = { get: () => 0, getMeta: () => 0, isLoaded: () => true };
  for (const reversed of [false, true]) {
    const A = { x: 3.5, y: 11.5, z: -0.05, health: 20 }, B = { x: 3.5, y: 11.5, z: 0.1, health: 20 }, hurt = [];
    const arrows = new Arrows(() => 0.5), a = arrows.make({ x: 0.5, y: 12, z: 0.5, mx: 2.4, my: 0, mz: 0, yaw: 0, pitch: 0 }, new GaussianRandom(1), { shooter: "player" });
    arrows.list.push(a);
    const box = (r) => [r.x - 0.3, r.y, r.z - 0.3, r.x + 0.3, r.y + 1.8, r.z + 0.3], targets = [{ ref: A, box: box(A) }, { ref: B, box: box(B) }];
    if (reversed) targets.reverse();
    arrows.tick(worldAir, { targets, mobs: { entities: [A, B], damage: (e) => (hurt.push(e), true) } });
    assert.deepEqual(hurt, [A], `reversed ${reversed}`);
  }
});

test("orderTargets: a player joined first, a mover lands at the end of its new list, positions without a box are accepted", () => {
  const p = { x: 5, y: 5, z: 5 }, m1 = { x: 6, y: 5, z: 5 }, m2 = { x: 7, y: 5, z: 5 }, cands = [m1, m2, p].map((k) => ({ key: k, pos: [k.x, k.y, k.z], player: k === p }));
  assert.deepEqual(orderTargets(cands).map((c) => c.key), [p, m1, m2]);
  m1.x = 20; // another chunk column: it sorts by chunk x now, and is stamped again
  assert.deepEqual(orderTargets(cands.map((c) => ({ ...c, pos: [c.key.x, c.key.y, c.key.z] }))).map((c) => c.key), [p, m2, m1]);
});
