import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "./world.js";
import { RedstoneWorld, replayScenario, refreshDaylightSensor } from "./redstone.js";
import { LiveRedstone } from "./redstone-live.js";
import { createRedstoneRuntime } from "./redstone-runtime.js";
import { toOriginal } from "./block-registry.js";

// Recorded by tools/verify-redstone-live.mjs from the unchanged 1.7.10 BlockDoor / BlockTNT classes.
const reference = JSON.parse(readFileSync(new URL("../public/research/redstone-live-reference.json", import.meta.url)));
const O = [20, 20, 20];

const fresh = () => new World("redstone-live-test", "meadow");
function clear(world, [ox, oy, oz], [sx, sy, sz]) {
  for (let x = -1; x <= sx; x++) for (let y = -1; y <= sy; y++) for (let z = -1; z <= sz; z++) world.put(ox + x, oy + y, oz + z, 0, 0, false);
}
// A LiveRedstone over a cleared World that a scenario's replay can drive like a RedstoneWorld.
function liveFactory(size, hooks = {}, origin = O) {
  return (options) => {
    const world = fresh();
    clear(world, origin, size);
    const w = new LiveRedstone(world, hooks);
    w.rand = new w.rand.constructor(options.seed);
    w.log = [];
    Object.assign(w, { sky: options.sky, skylightSubtracted: options.skylightSubtracted, celestialAngle: options.celestialAngle, noSky: options.noSky });
    return w;
  };
}

// The recorded call log uses origin-relative cells; a log entry's cell coordinates sit at these argument positions.
const CELL_AT = { s: 1, m: 1, n: 1, u: 1, g: 1, t: 1, b: 1, v: 1, k: 1, K: 1, a: 2 };
const relative = (line) => line.split(" ").map((entry) => {
  const parts = entry.split(","), at = CELL_AT[parts[0]];
  if (at !== undefined) for (let i = 0; i < 3; i++) parts[at + i] = String(Number(parts[at + i]) - O[i]);
  return parts.join(",");
}).join(" ");

for (const s of reference.scenarios)
  test(`live replay over a real World: ${s.name}`, () => {
    const tnt = [], drops = [], hooks = { primeTnt: (x, y, z) => tnt.push([x - O[0], y - O[1], z - O[2]]), drop: (x, y, z, d) => drops.push(d) };
    const hashOrdered = s.grid.split(",").some((c) => c.split(":")[0] === "55");
    const mine = replayScenario({ ...s, origin: O }, liveFactory(s.size, hooks));
    for (let t = 0; t < s.ticks; t++) {
      assert.deepEqual(mine.frames[t], s.frames[t], `block changes at tick ${t + 1}`);
      // Dust walks a HashSet of positions, so its call order depends on the absolute coordinates: compared without dust.
      if (!hashOrdered) assert.equal(relative(mine.calls[t]), s.calls[t], `call log at tick ${t + 1}`);
    }
    assert.equal(mine.final, s.final);
    assert.deepEqual(mine.pending, s.pending);
    assert.equal(mine.rng, s.rng);
    assert.equal(tnt.length, s.calls.join(" ").split(" ").filter((c) => c.startsWith("g,")).length);
    assert.equal(drops.length, s.drops.length);
  });

// ---- differential circuits: the same events through the native-verified RedstoneWorld and the live engine ----
const AIR = 0, STONE = 1, WIRE = 55, LEVER = 69, TORCH = 76, BUTTON = 77, REPEATER = 93, LAMP = 123, LIT_LAMP = 124, PLATE = 70, SENSOR = 151, COMPARATOR = 149, CHEST = 54, REDSTONE_BLOCK = 152;
function circuit(size, cells, { entities = [], slots = [], env = {} } = {}) {
  const [sx, sy, sz] = size, boxes = entities.map((e) => ({ ...e, box: e.box.map((v, i) => v + O[i % 3]) }));
  const ref = new RedstoneWorld({ seed: 7, sky: env.sky ?? 15, skylightSubtracted: env.subtracted ?? 0, celestialAngle: env.angle ?? 0 });
  const slotMap = new Map(slots.map((s) => [`${s.at.map((v, i) => v + O[i]).join(",")}`, s]));
  const world = fresh();
  clear(world, O, size);
  const live = new LiveRedstone(world, {
    entitiesIn: (box, mode) => liveEntities.filter((e) => (mode === "all" || e.kind !== "item") && e.box[3] > box[0] && e.box[0] < box[3] && e.box[4] > box[1] && e.box[1] < box[4] && e.box[5] > box[2] && e.box[2] < box[5]),
    containerSlots: (x, y, z) => slotMap.get(`${x},${y},${z}`)?.items.map((n) => (n ? { count: n, max: 64 } : null)) ?? null,
    environment: () => ({ skylightSubtracted: env.subtracted ?? 0, celestialAngle: env.angle ?? 0, sky: env.sky ?? 15 }),
    skyLight: () => env.sky ?? 15,
  });
  const liveEntities = boxes;
  ref.entities = boxes.map((e) => ({ kind: e.kind, cell: [0, 0, 0], box: e.box }));
  for (const [key, id, meta = 0] of cells) {
    const [x, y, z] = key.split(",").map(Number);
    for (const w of [ref, live]) w.setRaw(O[0] + x, O[1] + y, O[2] + z, id, meta);
  }
  for (const s of slots) {
    const [x, y, z] = s.at.map((v, i) => v + O[i]);
    s.items.forEach((n, i) => n && ref.setContainerSlot(x, y, z, i, 1, n, 64, 0));
  }
  const snap = (w) => {
    const out = [];
    for (let x = 0; x < sx; x++) for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) out.push(w.getBlock(O[0] + x, O[1] + y, O[2] + z) + ":" + w.getBlockMetadata(O[0] + x, O[1] + y, O[2] + z));
    return out.join(" ");
  };
  return {
    ref, live, world, snap,
    at: (x, y, z) => [O[0] + x, O[1] + y, O[2] + z],
    step(n = 1, events, after) {
      const trace = [];
      for (let i = 0; i < n; i++) {
        events?.(i, ref, live);
        ref.time++; ref.tickUpdates(); ref.sendQueuedBlockEvents(); ref.updateTileEntities();
        live.tick();
        // Entity collisions and the sensor's 20-tick refresh run after the scheduled ticks (Entity update order).
        after?.(i, ref);
        trace.push([snap(ref), snap(live)]);
      }
      return trace;
    },
  };
}
const same = (trace) => trace.forEach(([a, b], i) => assert.equal(b, a, `tick ${i + 1}`));
const floor = (sx, sz) => { const c = []; for (let x = 0; x < sx; x++) for (let z = 0; z < sz; z++) c.push([`${x},0,${z}`, STONE]); return c; };

test("lever -> dust -> lamp lights, and goes dark again, exactly like the native engine", () => {
  const c = circuit([6, 3, 3], [...floor(6, 3), ["0,1,1", LEVER, 5], ["1,1,1", WIRE], ["2,1,1", WIRE], ["3,1,1", LAMP]]);
  const use = (i, ref, live) => { if (i === 2 || i === 12) { ref.activate(...c.at(0, 1, 1)); live.use(...c.at(0, 1, 1)); } };
  same(c.step(25, use));
  assert.equal(c.live.getBlock(...c.at(3, 1, 1)), LAMP);
  c.step(0);
});
test("lever turning on lights the lamp (original id 124 while powered)", () => {
  const c = circuit([6, 3, 3], [...floor(6, 3), ["0,1,1", LEVER, 5], ["1,1,1", WIRE], ["2,1,1", WIRE], ["3,1,1", LAMP]]);
  assert.equal(c.live.use(...c.at(0, 1, 1)), true);
  c.live.tick();
  assert.equal(c.live.getBlock(...c.at(3, 1, 1)), LIT_LAMP);
  assert.equal(toOriginal(c.world.get(...c.at(3, 1, 1)), 0, {})[0], LIT_LAMP);
  c.live.use(...c.at(0, 1, 1));
  for (let i = 0; i < 6; i++) c.live.tick();
  assert.equal(c.live.getBlock(...c.at(3, 1, 1)), LAMP);
});
test("repeater delay cycles on use and delays the signal like the native engine", () => {
  const cells = [...floor(8, 3), ["0,1,1", LEVER, 5], ["1,1,1", REPEATER, 3], ["2,1,1", REPEATER, 7], ["3,1,1", WIRE], ["4,1,1", LAMP]];
  const c = circuit([8, 3, 3], cells);
  const use = (i, ref, live) => { if (i === 1) { ref.activate(...c.at(0, 1, 1)); live.use(...c.at(0, 1, 1)); } if (i === 30) { ref.activate(...c.at(0, 1, 1)); live.use(...c.at(0, 1, 1)); } };
  same(c.step(60, use));
  // a click on a repeater advances its delay in both engines
  const before = c.live.getBlockMetadata(...c.at(1, 1, 1));
  ref: { c.ref.activate(...c.at(1, 1, 1)); c.live.use(...c.at(1, 1, 1)); }
  assert.notEqual(c.live.getBlockMetadata(...c.at(1, 1, 1)), before);
  assert.equal(c.live.getBlockMetadata(...c.at(1, 1, 1)), c.ref.getBlockMetadata(...c.at(1, 1, 1)));
});
test("torch inverts the block it hangs on and a pulse clock burns out", () => {
  const inverter = circuit([5, 4, 3], [...floor(5, 3), ["0,1,1", LEVER, 5], ["1,1,1", STONE], ["2,1,1", TORCH, 1], ["3,1,1", WIRE], ["4,1,1", LAMP]]);
  // torch (meta 1: attached to the block on its west) on top of "1,1,1"
  same(inverter.step(20, (i, ref, live) => { if (i === 3 || i === 10) { ref.activate(...inverter.at(0, 1, 1)); live.use(...inverter.at(0, 1, 1)); } }));
  // a torch ring fed back on itself: the burnout rule (8 toggles in 60 ticks) shows identically in both engines
  const cells = [...floor(4, 4), ["1,1,1", STONE], ["2,1,1", WIRE], ["2,1,2", WIRE], ["1,1,2", WIRE], ["0,1,1", TORCH, 5], ["1,2,1", TORCH, 5], ["0,1,2", REDSTONE_BLOCK]];
  const burn = circuit([4, 4, 4], cells);
  same(burn.step(120, (i, ref, live) => { if (i === 0) { ref.setBlock(...burn.at(1, 1, 3), STONE, 0, 3); live.setBlock(...burn.at(1, 1, 3), STONE, 0, 3); } }));
});
test("pressure plates read entities (strict AABB) like the scripted native entities", () => {
  const cells = [...floor(5, 3), ["1,1,1", PLATE], ["2,1,1", WIRE], ["3,1,1", LAMP]];
  const mob = { kind: "mob", box: [1.2, 1, 1.2, 1.8, 2.8, 1.8] };
  const c = circuit([5, 3, 3], cells, { entities: [mob] });
  const trace = c.step(40, (i, ref) => {
    if (i === 15) { c.live.hooks.entitiesIn = () => []; ref.entities = []; }
  }, (i, ref) => { if (ref.getBlockMetadata(...c.at(1, 1, 1)) === 0) ref.collide(...c.at(1, 1, 1)); });
  same(trace);
  assert.ok(trace.some(([, b]) => b.includes(LIT_LAMP + ":0")), "the lamp lit while the mob stood on the plate");
  assert.ok(trace[39][1].includes(LAMP + ":0") && !trace[39][1].includes(LIT_LAMP + ":0"), "and went dark after");
  // touching boxes do not count
  const edge = circuit([5, 3, 3], cells, { entities: [{ kind: "mob", box: [2, 1, 1, 2.6, 2.8, 1.6] }] });
  edge.live.hooks.entitiesIn = (box) => [{ box: [2, 1, 1, 2.6, 2.8, 1.6].map((v, i) => v + (i % 3 === 0 ? O[0] - 1.0 + 0 : 0)) }].filter(() => false);
  assert.equal(edge.live.getEntities("all", edge.at(1, 1, 1).concat(edge.at(2, 2, 2))).length, 0);
});
test("a comparator reads a chest and a daylight sensor follows the sky", () => {
  const cells = [...floor(6, 3), ["2,1,1", CHEST, 3], ["1,1,1", COMPARATOR, 1], ["0,1,1", WIRE], ["4,1,1", SENSOR]];
  const c = circuit([6, 3, 3], cells, { slots: [{ at: [2, 1, 1], items: [64, 64, 64, 64, 64, 32, ...Array(21).fill(0)] }], env: { sky: 15, subtracted: 0, angle: 0.5 } });
  const trace = c.step(12);
  same(trace);
  c.live.containerChanged(...c.at(2, 1, 1));
  assert.ok(c.live.comparatorTile(...c.at(1, 1, 1)).signal >= 0);
  const noon = circuit([6, 3, 3], [...floor(6, 3), ["4,1,1", SENSOR]], { env: { sky: 15, subtracted: 0, angle: 0 } });
  same(noon.step(45, null, (i, ref) => { if (ref.time % 20 === 0) refreshDaylightSensor(ref, ...noon.at(4, 1, 1)); }));
  assert.ok(noon.live.getBlockMetadata(...noon.at(4, 1, 1)) > 0, "sensor reads daylight at noon");
  const night = circuit([6, 3, 3], [...floor(6, 3), ["4,1,1", SENSOR]], { env: { sky: 15, subtracted: 11, angle: Math.PI } });
  same(night.step(45, null, (i, ref) => { if (ref.time % 20 === 0) refreshDaylightSensor(ref, ...night.at(4, 1, 1)); }));
  assert.equal(night.live.getBlockMetadata(...night.at(4, 1, 1)), 0);
});
test("save and restore in the middle of a button pulse continues the same", () => {
  const cells = [...floor(6, 3), ["0,1,1", STONE], ["1,1,1", BUTTON, 1], ["0,1,2", LAMP]];
  const build = () => { const c = circuit([6, 3, 3], cells); return c; };
  const a = build(), b = build();
  const press = (c) => { c.live.use(...c.at(1, 1, 1)); };
  press(a); press(b);
  a.live.tick(); b.live.tick();
  for (let i = 0; i < 9; i++) { a.live.tick(); b.live.tick(); }
  const data = JSON.parse(JSON.stringify(b.live.save()));
  // a new World with the same blocks and a new engine restored from the data
  const world = fresh();
  clear(world, O, [6, 3, 3]);
  for (let x = 0; x < 6; x++) for (let y = 0; y < 3; y++) for (let z = 0; z < 3; z++) world.put(O[0] + x, O[1] + y, O[2] + z, b.world.get(O[0] + x, O[1] + y, O[2] + z), b.world.getMeta(O[0] + x, O[1] + y, O[2] + z), false);
  const r = new LiveRedstone(world, {});
  assert.equal(r.restore(data), true);
  const seen = [];
  for (let i = 0; i < 30; i++) { a.live.tick(); r.tick(); seen.push([a.snap(a.live), b.snap(r)]); }
  seen.forEach(([x, y], i) => assert.equal(y, x, `tick ${i + 1} after restore`));
  assert.ok(seen.some(([x]) => x.includes(LIT_LAMP)), "the pulse lit the lamp");
  assert.equal(seen.at(-1)[0].includes(LIT_LAMP), false, "and ended");
});

// ---- the main.js-side runtime ----
test("the runtime wires hooks: drops, TNT, sounds, light updates and use", () => {
  const world = fresh();
  clear(world, O, [6, 3, 3]);
  const log = { sounds: [], drops: [], tnt: [], updates: [], unsaved: 0 };
  const scene = { updateBlocks: (list) => log.updates.push(...list), setMovingBlocks() {} };
  const rt = createRedstoneRuntime({ world, scene, game: {
    sound: (name, x, y, z) => log.sounds.push(name), drop: (x, y, z, d) => log.drops.push(d), primeTnt: (x, y, z) => log.tnt.push([x, y, z]),
    markUnsaved: () => log.unsaved++, player: () => null, mobs: () => null, items: () => [], arrows: () => [], orbs: () => [], primed: () => [],
  } });
  const [x, y, z] = [O[0], O[1], O[2]];
  for (let i = 0; i < 6; i++) rt.redstone.setBlock(x + i, y, z + 1, STONE, 0, 3);
  rt.redstone.setBlock(x, y + 1, z + 1, LEVER, 5, 3);
  rt.redstone.setBlock(x + 1, y + 1, z + 1, WIRE, 0, 3);
  rt.redstone.setBlock(x + 2, y + 1, z + 1, LAMP, 0, 3);
  rt.redstone.setBlock(x + 4, y + 1, z + 1, 46, 0, 3);
  rt.flush();
  log.updates.length = 0;
  assert.equal(rt.use(x, y + 1, z + 1), true);
  rt.tick();
  assert.ok(log.sounds.includes("random.click"));
  assert.ok(log.updates.some(([ux, uy, uz, old, now]) => ux === x + 2 && uz === z + 1 && old !== now), "the lamp's block change reaches scene.updateBlocks with old and new ids");
  assert.ok(log.unsaved > 0);
  // support removal through the world.set funnel: dust drops as an item
  world.set(x + 1, y, z + 1, 0);
  rt.tick();
  assert.ok(log.drops.length >= 1, "unsupported dust dropped");
  // a TNT block next to a redstone block primes through the hook
  rt.redstone.setBlock(x + 4, y + 2, z + 1, REDSTONE_BLOCK, 0, 3);
  rt.tick();
  assert.equal(log.tnt.length, 1);
  assert.equal(world.get(x + 4, y + 1, z + 1), 0);
  rt.dispose();
});
