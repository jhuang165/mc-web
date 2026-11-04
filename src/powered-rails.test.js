import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "./world.js";
import { fromOriginal, toOriginal } from "./block-registry.js";
import { createRedstoneRuntime } from "./redstone-runtime.js";
import { installPopulationRecipes } from "./population-content.js";
import { Minecarts } from "./minecarts.js";
import { POWERED, DETECTOR, ACTIVATOR, PLAIN, MAX_DEPTH } from "./powered-rails.js";
import { POWERED_RAIL, DETECTOR_RAIL, ACTIVATOR_RAIL, railItemBlock } from "./rails.js";

// Recorded by tools/verify-powered-rails.mjs from the unchanged BlockRailPowered / BlockRailDetector / BlockRail and real
// EntityMinecartEmpty / EntityMinecartChest classes (tools/probes/RailProbe.java).
const ref = JSON.parse(readFileSync(new URL("../public/research/powered-rails-reference.json", import.meta.url)));
const O = [20, 20, 20], f = Math.fround;
const num = (v) => (v === "-0" ? -0 : v);

function arena() {
  const world = new World("powered-rails-test", "meadow");
  for (let x = -6; x <= 62; x++) for (let y = -3; y <= 8; y++) for (let z = -8; z <= 8; z++) world.put(O[0] + x, O[1] + y, O[2] + z, 0, 0, false);
  return world;
}
const putOriginal = (world, [x, y, z, id, meta]) => {
  const m = id ? fromOriginal(id, meta) : { id: 0, meta: 0 };
  world.put(O[0] + x, O[1] + y, O[2] + z, m.id, m.meta, false);
};

function replay(c) {
  const world = arena(), carts = new Minecarts();
  const runtime = createRedstoneRuntime({ world, game: { minecarts: () => carts, maxStack: () => 64 } });
  for (const cell of c.cells) putOriginal(world, cell);
  const list = c.carts.map(([type, x, y, z, vx, vy, vz, stacks], i) => {
    const items = Array.from({ length: stacks }, (_, slot) => ({ slot, id: 4, damage: 0, count: 64 }));
    const cart = carts.spawnChest({ x: x + O[0], y: y + O[1], z: z + O[2], type, items }, { seed: 1000 + i });
    assert.equal(cart.id, i + 1);
    [cart.vx, cart.vy, cart.vz] = [vx, vy, vz];
    return cart;
  });
  const drops = [];
  runtime.redstone.hooks.drop = (x, y, z, d) => drops.push([d.id, d.count, d.damage]);
  const rel = (p) => [p[0] + O[0], p[1] + O[1], p[2] + O[2]];
  c.ticks.forEach(([states, cells, dets, sig, dropped], t) => {
    const at = `${c.name} tick ${t}`;
    drops.length = 0;
    for (const [tick, kind, x, y, z, id, meta] of c.events) {
      if (tick !== t) continue;
      if (kind === 0) runtime.redstone.setBlock(...rel([x, y, z]), id, meta, 3);
      else runtime.redstone.setBlock(...rel([x, y, z]), 0, 0, 3);
      runtime.flush();
    }
    runtime.tick();
    carts.tick(world);
    states.forEach((s, i) => {
      const cart = list[i], [x, y, z, vx, vy, vz, onGround, dead, yaw] = s.map(num);
      assert.deepEqual([cart.x, cart.posY, cart.z, cart.vx, cart.vy, cart.vz], [x, y, z, vx, vy, vz], `${at} cart ${i}`);
      assert.deepEqual([cart.onGround, cart.dead, cart.yaw], [!!onGround, !!dead, f(yaw)], `${at} cart ${i} state`);
    });
    c.watch.forEach((w, i) => {
      const abs = rel(w), id = runtime.redstone.getBlock(...abs);
      assert.equal((id << 4) | (id ? runtime.redstone.getBlockMetadata(...abs) : 0), cells[i], `${at} cell ${w}`);
    });
    c.det.forEach((d, i) => {
      const abs = rel(d), expect = dets[i];
      if (expect[0] === -1) return assert.notEqual(runtime.redstone.getBlock(...abs), DETECTOR, `${at} detector gone`);
      const b = runtime.redstone, got = [b.weakPower(...abs, 0), b.strongPower(...abs, 1), b.strongPower(...abs, 0), b.behaviours[DETECTOR].comparator(b, ...abs)];
      assert.deepEqual(got, expect, `${at} detector ${d}`);
    });
    c.cmp.forEach((p, i) => assert.equal(runtime.redstone.comparatorTile(...rel(p)).signal, sig[i], `${at} comparator ${p}`));
    assert.equal(drops.length, dropped.length, `${at} drops`);
    dropped.forEach(([, , , , id, count, damage], k) => {
      assert.deepEqual(drops[k], [1000 + fromOriginal(id, 0).id, count, damage], `${at} drop ${k}`);
    });
  });
  return { world, runtime, carts, list };
}

test("the recording covers the expected layouts", () => {
  assert.deepEqual(ref.cases.map((c) => c.name), ["chain", "hill", "mixed", "boost-toggle", "push-start", "activator-ride", "detector-pass",
    "detector-parked", "place", "break", "plain-tee"]);
  assert.equal(ref.cases.reduce((n, c) => n + c.ticks.length, 0), 388);
});
for (const c of ref.cases) test(`rails replay against the original classes: ${c.name}`, () => replay(c));

test("block ids, original ids and items", () => {
  assert.deepEqual([POWERED_RAIL, DETECTOR_RAIL, ACTIVATOR_RAIL], [135, 136, 137]);
  assert.deepEqual([POWERED, DETECTOR, ACTIVATOR, PLAIN], [27, 28, 157, 66]);
  for (const [internal, orig] of [[135, 27], [136, 28], [137, 157]]) {
    assert.equal(fromOriginal(orig, 5).id, internal);
    assert.deepEqual(toOriginal(internal, 5).slice(0, 2), [orig, 5]);
    assert.equal(railItemBlock(1000 + internal), internal);
  }
});

test("power travels at most eight rails along a straight line and activator rails stay separate", () => {
  const world = arena(), rt = createRedstoneRuntime({ world, game: {} }), r = rt.redstone;
  for (let x = 0; x < 30; x++) { putOriginal(world, [x, -1, 0, 1, 0]); putOriginal(world, [x, 0, 0, 27, 1]); }
  putOriginal(world, [0, -1, 2, 1, 0]); putOriginal(world, [0, 0, 2, 157, 1]); putOriginal(world, [1, 0, 2, 157, 1]);
  r.setBlock(...[15, 0, 1].map((v, i) => v + O[i]), 152, 0, 3);
  const on = [];
  for (let x = 0; x < 30; x++) if (r.getBlockMetadata(O[0] + x, O[1], O[2]) & 8) on.push(x);
  assert.deepEqual([on[0], on.at(-1)], [15 - MAX_DEPTH, 15 + MAX_DEPTH]);
  assert.equal(r.getBlockMetadata(O[0], O[1], O[2] + 2) & 8, 0);
  assert.equal(r.getBlockMetadata(O[0] + 1, O[1], O[2] + 2) & 8, 0);
});

test("the three recipes give six rails each", () => {
  const found = {};
  installPopulationRecipes({ recipe: (id, name, rows, key, result, count = 1) => { found[id] = { rows, key, result, count }; }, shapeless: () => {} });
  assert.deepEqual(found["powered-rail"], { rows: ["G G", "GSG", "GRG"], key: { G: 304, S: 300, R: 360 }, result: 1135, count: 6 });
  assert.deepEqual([found["detector-rail"].result, found["detector-rail"].count, found["detector-rail"].rows], [1136, 6, ["I I", "IPI", "IRI"]]);
  assert.deepEqual([found["activator-rail"].result, found["activator-rail"].count, found["activator-rail"].rows], [1137, 6, ["ISI", "ITI", "ISI"]]);
});
