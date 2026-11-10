// The live tick with the shared tick tree attached, on the real redstone runtime (batch 35 ticktree3). Release 0.62.0 ran the tree and never
// ran redstone tickEnd (block events, the tile-entity loop, the piston pushes); 0.63.0 fixed it and only a stub test in world-tick.test.js pinned
// that. These tests drive tickWorldSystems exactly as main.js does, with attachTickTree over the real runtime.
import { test } from "node:test";
import assert from "node:assert/strict";
import { World, WATER } from "./world.js";
import { Fluids } from "./fluids.js";
import { Fire } from "./fire.js";
import { FallingBlocks } from "./falling.js";
import { Weather } from "./weather.js";
import { createRedstoneRuntime } from "./redstone-runtime.js";
import { attachTickTree } from "./tile-ticks.js";
import { tickWorldSystems } from "./world-tick.js";
import { PISTON, PISTON_HEAD } from "./dispenser-piston.js";
import { LEVER, REPEATER } from "./redstone-blocks.js";

const STONE = 3, NOTE = 177, O = [20, 20, 20];

function build(withTree) {
  const world = new World("tick-tree-runtime", "meadow");
  for (let x = -3; x <= 8; x++) for (let y = -2; y <= 4; y++) for (let z = -4; z <= 4; z++) world.put(O[0] + x, O[1] + y, O[2] + z, y < 0 ? STONE : 0, 0, false);
  world.isTicking = () => true;
  const weather = new Weather(), fluids = new Fluids(world, { seed: 1 }), fire = new Fire(world, { weather: () => weather }), falling = new FallingBlocks(world, { drop() {} }, []);
  const sounds = [], particles = [];
  const game = { sound: (...a) => sounds.push(a), markUnsaved() {}, drop() {}, primeTnt() {}, player: () => null, mobs: () => null, items: () => [], arrows: () => [], orbs: () => [], primed: () => [], commandHost: () => null,
    music: { particle: (...a) => particles.push(a), play() {}, spawn() {} } };
  const rt = createRedstoneRuntime({ world, scene: null, game });
  fire.watch(); falling.watch();
  const tickTree = withTree ? attachTickTree({ fluids, fire, falling, redstone: rt }) : null;
  const step = (t) => tickWorldSystems({ farming: { tick: () => [] }, fluids, fire, falling, tickTree, redstone: rt }, { time: t, daylight: 1, x: O[0], z: O[2] }, { farming() {}, fluids() {}, fire() {} });
  const at = (x, y, z) => [O[0] + x, O[1] + y, O[2] + z];
  return { world, rt, sounds, particles, step, at, tickTree };
}

for (const withTree of [true, false]) {
  test(`a lever powers a piston through tickWorldSystems ${withTree ? "with" : "without"} the tick tree: it extends, then retracts`, () => {
    const s = build(withTree), [px, py, pz] = s.at(0, 0, 0), [lx, ly, lz] = s.at(0, 0, 1);
    s.world.set(px, py, pz, PISTON, true, 5); // facing east, +x
    s.world.set(lx, ly, lz, LEVER, true, 5);  // floor lever beside the piston
    s.rt.redstone.placed(px, py, pz);
    s.rt.redstone.placed(lx, ly, lz);
    for (let t = 1; t <= 3; t++) s.step(t);
    assert.equal(s.world.get(px + 1, py, pz), 0, "off: nothing pushed");
    assert.ok(s.rt.use(lx, ly, lz), "the lever took the click");
    let head = false;
    for (let t = 4; t <= 20; t++) { s.step(t); if (s.world.get(px + 1, py, pz) === PISTON_HEAD) { head = true; break; } }
    assert.ok(head, "the piston head appears (block event and piston tile ran in the tick)");
    for (let t = 21; t <= 30; t++) s.step(t);
    assert.equal(s.rt.pistons ? s.rt.redstone.pistonTiles().length : 0, 0, "the moving tile settled");
    assert.equal(s.world.get(px + 1, py, pz), PISTON_HEAD, "stays extended while powered");
    assert.ok(s.rt.use(lx, ly, lz), "lever off");
    for (let t = 31; t <= 50; t++) s.step(t);
    assert.equal(s.world.get(px + 1, py, pz), 0, "retracted");
    assert.equal(s.world.get(px, py, pz), PISTON, "base remains");
    assert.ok(s.sounds.some((a) => /piston/.test(a[0])), "piston sounds played");
  });
}

test("the tree run and the standalone run give the same piston timeline and world", () => {
  const run = (withTree) => {
    const s = build(withTree), [px, py, pz] = s.at(0, 0, 0), [lx, ly, lz] = s.at(0, 0, 1), log = [];
    s.world.set(px, py, pz, PISTON, true, 5); s.world.set(lx, ly, lz, LEVER, true, 5);
    s.rt.redstone.placed(px, py, pz); s.rt.redstone.placed(lx, ly, lz);
    for (let t = 1; t <= 40; t++) {
      if (t === 3) s.rt.use(lx, ly, lz);
      if (t === 25) s.rt.use(lx, ly, lz);
      s.step(t);
      log.push([s.world.get(px + 1, py, pz), s.rt.redstone.pistonTiles().map((p) => [p.x, p.y, p.z, p.extending, p.progress])]);
    }
    return log;
  };
  assert.deepEqual(run(true), run(false));
});

test("a note block block event fires inside the tree-attached tick", () => {
  const s = build(true), [nx, ny, nz] = s.at(2, 0, 0), [lx, ly, lz] = s.at(3, 0, 0);
  s.world.set(nx, ny, nz, NOTE, true, 0);
  s.world.set(lx, ly, lz, LEVER, true, 5); // floor lever beside the note block
  s.rt.redstone.placed(nx, ny, nz);
  s.rt.redstone.placed(lx, ly, lz);
  for (let t = 1; t <= 3; t++) s.step(t);
  const before = s.particles.length + s.sounds.length;
  s.world.set(lx, ly, lz, LEVER, true, 13); // the lever flips on by an edit: the event is only queued until the tick's block-event step
  s.rt.redstone.external(lx, ly, lz, LEVER);
  assert.equal(s.particles.length + s.sounds.length, before, "queued, not yet sent");
  for (let t = 4; t <= 8; t++) s.step(t);
  assert.ok(s.particles.length + s.sounds.length > before, "the note block event (note particle and sound) ran through tickEnd");
});

test("water still ticks next to the runtime under the tree (the tree does not starve the fluid list)", () => {
  const s = build(true), [x, y, z] = s.at(4, 0, 0);
  s.world.set(x, y, z, WATER, true, 0);
  s.world.set(x, y - 1, z, STONE, true, 0);
  for (let t = 1; t <= 12; t++) s.step(t);
  assert.ok([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => s.world.get(x + dx, y, z + dz) !== 0), "water spread");
});

// ---- fluid writes notify redstone per setBlock (batch 35) ----
const WIRE = 107;
function fluidScene(perWrite) {
  const s = build(true), log = [];
  const [x, y, z] = s.at(4, 0, 0);
  // water source on a stone shelf one block up with dust on three sides and one repeater beside the dust
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) s.world.put(x + dx, y - 1, z + dz, STONE, 0, false);
  s.world.put(x - 1, y, z, WIRE, 0, false); s.world.put(x + 1, y, z, WIRE, 0, false); s.world.put(x, y, z + 1, WIRE, 0, false);
  s.world.put(x + 2, y, z, REPEATER, 0, false); // powered-less repeater next to the east dust
  s.world.put(x, y, z, WATER, 0, false);
  const fluids = s.tickTree.sources.find((q) => q.name === "fluids").sys;
  const put = s.world.put.bind(s.world), external = s.rt.redstone.external.bind(s.rt.redstone);
  s.world.put = (...a) => { const r = put(...a); if (r) log.push(["put", a[0], a[1], a[2], a[3]]); return r; };
  s.rt.redstone.external = (...a) => { log.push(["external", a[0], a[1], a[2]]); return external(...a); };
  if (perWrite) fluids.writers.push((a, b, c, d, e) => s.rt.fluidChanges([[a, b, c, d, e]], true));
  fluids.schedule(x, y, z, 1);
  const observers = { farming() {}, fluids() { s.rt.flush(); }, fire() {}, step: perWrite ? undefined : (name, changes) => { if (name === "fluids") s.rt.fluidChanges(changes, true); } };
  for (let t = 1; t <= 14; t++) tickWorldSystems({ farming: { tick: () => [] }, fluids, fire: null, tickTree: s.tickTree, redstone: s.rt }, { time: t, daylight: 1, x, z }, observers);
  return { s, log, world: s.world.snapshot(), redstone: s.rt.save(), fluids: fluids.save() };
}

test("with fluids.writers redstone hears every write of a fluid run before the next write", () => {
  const a = fluidScene(true), writes = a.log.filter((e) => e[0] === "put" && (e[4] === 0 || e[4] === WATER || e[4] === 8 || e[4] === 9) );
  assert.ok(writes.length >= 3, "the water broke dust and spread");
  // Every put that replaced a redstone part is immediately followed by the engine's external() for that cell.
  let checked = 0;
  a.log.forEach((e, i) => {
    if (e[0] !== "put" || e[4] === 0) return;
    const next = a.log.slice(i + 1).find((n) => n[0] === "external" && n[1] === e[1] && n[2] === e[2] && n[3] === e[3]);
    if (next) { checked++; const between = a.log.slice(i + 1, a.log.indexOf(next)).filter((n) => n[0] === "put"); assert.equal(between.length, 0, `no other fluid write between a write and its notification at ${e.slice(1, 4)}`); }
  });
  assert.ok(checked >= 2, `notifications seen (${checked})`);
});

test("per-write and per-run notification end in the same world and the same scheduled ticks here", () => {
  const a = fluidScene(true), b = fluidScene(false);
  assert.deepEqual(a.world, b.world);
  assert.deepEqual(a.fluids, b.fluids);
  assert.deepEqual(a.redstone, b.redstone);
});
