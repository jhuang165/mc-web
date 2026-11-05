import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { solidBlock, WATER, SNOW_LAYER, LILY_PAD } from "./world.js";
import { Boats, BOAT_Y_OFFSET } from "./boats.js";
import { ITEMS, RECIPES } from "./survival.js";
import { ORIGINAL_ITEMS } from "./original-items.js";

const f = Math.fround;
// public/research/boat-reference.json: the unchanged EntityBoat/ItemBoat (tools/verify-boats.mjs).
const ref = JSON.parse(await readFile(new URL("../public/research/boat-reference.json", import.meta.url)));
// Original ids: stone 1, flowing 8 and still 9 water, snow layer 78, lily pad 111.
const internal = { 0: 0, 1: 3, 8: WATER, 9: WATER, 78: SNOW_LAYER, 111: LILY_PAD };
function probeWorld(cells) {
  const map = new Map(cells.map(([x, y, z, id, meta = 0]) => [`${x},${y},${z}`, [internal[id], meta]]));
  const cell = (x, y, z) => map.get(`${x},${y},${z}`) ?? [y < 0 ? 3 : 0, 0];
  return { get: (x, y, z) => cell(x, y, z)[0], getMeta: (x, y, z) => cell(x, y, z)[1], solid: (x, y, z) => solidBlock(...cell(x, y, z)),
    set: (x, y, z, id) => { map.set(`${x},${y},${z}`, [id, 0]); return true; } };
}
// The probes print doubles with VehicleProbe.num; float state is exact, double state needs the sine/cosine tolerance.
const num = (v) => (v === "-0" ? -0 : v);
const near = (actual, expected, at, tol = 1e-7) => {
  assert.equal(actual.length, expected.length, `${at} length`);
  actual.forEach((a, i) => { const e = num(expected[i]); typeof e === "number" ? assert.ok(Math.abs(a - e) <= tol * Math.max(1, Math.abs(e)), `${at}[${i}] ${a} vs ${e}`) : assert.equal(a, e, `${at}[${i}]`); });
};
const rider = (yaw, forward, strafe) => ({ player: true, x: 0, y: 0, z: 0, yaw, moveForward: forward, moveStrafing: strafe, vehicle: null, fallDistance: 0, falls: [], fall(d) { this.falls.push(d); } });
const state = (b) => [b.x, b.posY, b.z, b.vx, b.vy, b.vz, b.yaw, b.onGround, b.collidedH, b.dead, b.timeSinceHit, b.damage, b.forwardDir, b.speed, b.fallDistance, b.bb[0], b.bb[1], b.bb[2]];

test("native class digests are recorded", () => {
  for (const name of ["xi", "abj", "sa"]) assert.match(ref.classes[name].sha256, /^[0-9a-f]{64}$/);
  assert.ok(ref.cases.length >= 60);
});

for (const c of ref.cases.filter((r) => r.kind === "travel")) {
  test(`boat travel ${c.name}`, () => {
    const world = probeWorld(c.cells), boats = new Boats(), p = rider(c.yaw, c.forward, -c.strafe + 0);
    p.moveStrafing = c.strafe;
    const boat = boats.spawnBoat({ x: c.spawn[0], y: c.spawn[1], z: c.spawn[2], yaw: c.boatYaw, vx: c.spawn[3], vy: c.spawn[4], vz: c.spawn[5] }, { seed: 7 });
    if (c.ridden) assert.equal(boats.mount(boat, p), c.mounted);
    const spawned = [];
    c.ticks.forEach(([bs, ps, particles, count], t) => {
      const at = `${c.name} tick ${t}`, before = boats.drops.length;
      const out = boat.dead ? [] : boats.tickBoat(world, boat);
      if (c.ridden && boat.rider && !boat.dead) boats.updateRiderPosition(boat);
      near(state(boat), bs.map(num), at);
      if (boat.rider && !boat.dead) near([p.x, p.y, p.z, p.yaw], ps.slice(0, 4), `${at} rider`);
      assert.equal(out.length, particles.length, `${at} particle count`);
      out.forEach((q, i) => near(q.slice(1), particles[i].slice(1).map(num), `${at} particle ${i}`));
      spawned.push(boats.drops.length - before);
      assert.equal(boats.drops.length, count, `${at} drops`);
    });
    assert.deepEqual(boats.drops.map((d) => d.stack.id).sort(), c.drops.map((d) => ({ 333: 495, 5: 7, 280: 300 })[d[0]]).sort(), `${c.name} drop ids`);
    if (c.ridden) {
      // Entity.mountEntity(null): the rider ends on top of the boat (or on a clear neighbouring block), free of it.
      near([p.x, p.y, p.z], c.beforeDismount.slice(0, 3), `${c.name} before dismount`);
      boats.dismount(world, p);
      assert.equal(p.vehicle, null);
      near([p.x, p.y, p.z], c.dismount.slice(0, 3), `${c.name} dismount`);
    }
  });
}

for (const c of ref.cases.filter((r) => r.kind === "hits")) {
  test(`boat hits ${c.name}`, () => {
    const world = probeWorld([]), boats = new Boats(), boat = boats.spawnBoat({ x: 0.5, y: 0.5, z: 0.5 }, { seed: 7 }), p = rider(0, 0, 0);
    if (c.ridden) boats.mount(boat, p);
    for (let i = 0, k = 0; i < c.amounts.length; i++, k += 2) {
      const [ret, dead, timeSinceHit, damage, forwardDir, spawned, riderMounted] = c.seq[k], at = `${c.name} hit ${i}`;
      assert.equal(boats.attack(boat, c.amounts[i], { creative: c.creative }), ret, at);
      assert.deepEqual([boat.dead, boat.timeSinceHit, boat.damage, boat.forwardDir, boats.drops.length, !!p.vehicle], [dead, timeSinceHit, damage, forwardDir, spawned, riderMounted], at);
      for (let g = 0; g < c.gap && !boat.dead; g++) boats.tickBoat(world, boat);
      assert.deepEqual([boat.timeSinceHit, boat.damage], c.seq[k + 1], `${at} gap`);
    }
    assert.deepEqual(boats.drops.map((d) => d.stack.id), c.drops.map(() => 495));
  });
}

test("boat mount geometry and a second rider is refused", () => {
  const m = ref.cases.find((r) => r.kind === "mount"), boats = new Boats(), boat = boats.spawnBoat({ x: 0.5, y: 0.5, z: 0.5, yaw: 30 });
  const a = rider(0, 0, 0), b = rider(0, 0, 0);
  assert.equal(boats.mount(boat, a), m.first);
  assert.equal(boats.mount(boat, b), !m.occupied);
  assert.equal(b.vehicle, null);
  near([a.x, a.z], [m.position[0], m.position[2]], "rider");
  assert.equal(boats.getMountedYOffset(), m.offset);
  assert.deepEqual([f(1.5), f(0.6)], m.size.map(f));
  assert.equal(BOAT_Y_OFFSET, f(m.yOffset));
  near(boat.bb, m.box.map(num), "box");
});

for (const c of ref.cases.filter((r) => r.kind === "placement")) {
  test(`boat placement ${c.block}:${c.meta} yaw ${c.yaw}${c.side ? " beside a block" : ""}${c.creative ? " creative" : ""}`, () => {
    const cells = [[2, 1, 4, c.block, c.meta], ...(c.side ? [[3, 2, 4, 1, 0]] : [])];
    const world = probeWorld(cells), boats = new Boats();
    // The probe player: feet (2.5, 3, 4.5), eye + 1.62 looking straight down.
    const boat = boats.place(world, { eye: [2.5, 3 + f(1.62), 4.5], dir: [0, -1, 0], yaw: c.yaw });
    if (c.boat === null) return assert.equal(boat, null);
    assert.ok(boat, "boat placed");
    near([boat.x, boat.posY, boat.z, boat.yaw], c.boat, "boat");
  });
}

test("item, recipe, original id and persistence", () => {
  assert.equal(ITEMS[495].boat, true);
  assert.equal(ORIGINAL_ITEMS[333], 495);
  const recipe = RECIPES.find((r) => r.output === 495);
  assert.deepEqual([recipe.width, recipe.height, recipe.pattern, recipe.count], [3, 2, [7, 0, 7, 7, 7, 7], 1]);
  const boats = new Boats(), boat = boats.spawnBoat({ x: 3.5, y: 4, z: 5.5, yaw: 90 }, { seed: 1 });
  boat.vx = 0.1; boat.fallDistance = 1.5;
  const json = JSON.parse(JSON.stringify(boats.toJSON()));
  const back = Boats.fromJSON(json).boats[0];
  assert.deepEqual([back.x, back.posY, back.z, back.vx, back.yaw, back.fallDistance], [boat.x, boat.posY, boat.z, 0.1, 90, 1.5]);
  assert.equal(Boats.fromJSON([{ x: "bad" }, null, { x: 1, y: 2, z: 3, motion: [99, 0, 0] }]).boats[0].vx, 0);
});

test("boats survive chunked runtime storage and world import; old saves have none", async () => {
  const { splitRuntime, joinRuntime } = await import("./chunk-runtime.js");
  const { importedRuntime } = await import("./world-import.js");
  const boats = new Boats();
  boats.spawnBoat({ x: 3.5, y: 4, z: 5.5, yaw: 90 }, { seed: 1 });
  const mounted = boats.spawnBoat({ x: 40.5, y: 4, z: -7.5 }, { seed: 2 });
  mounted.vx = 0.1;
  boats.mount(mounted, rider(0, 0, 0));
  const list = JSON.parse(JSON.stringify(boats.toJSON()));
  assert.equal(list[1].rider, true);
  const split = splitRuntime({ id: "w", boats: list, minecarts: { version: 1, carts: [] } });
  assert.deepEqual(joinRuntime(split.metadata, split.columns).boats, list);
  const old = splitRuntime({ id: "w", minecarts: { version: 1, carts: [] } });
  assert.equal("boats" in joinRuntime(old.metadata, old.columns), false);
  assert.equal(importedRuntime({ boats: [...list, { x: "bad" }, null] }).boats.length, 2);
  assert.equal(importedRuntime({ minecarts: { version: 1, carts: [] } }).boats, undefined);
  const back = Boats.fromJSON(importedRuntime({ boats: list }).boats);
  assert.equal(back.boats.length, 2);
  assert.equal(back.boats[1].restorePlayer, true);
});

test("vehicle dispatch mounts, steers, hits and dismounts a boat", async () => {
  const { createPlayerRider, captureVehicleAction, dispatchVehicleAction, moveRidingPlayer, finishVehicleTick } = await import("./vehicle-simulation.js");
  const { Minecarts } = await import("./minecarts.js");
  const world = probeWorld([[0, 0, 0, 9, 0]]);
  const boats = new Boats(), boat = boats.spawnBoat({ x: 0.5, y: 1, z: 0.5 }, { seed: 3 });
  const survival = { health: 20, creative: false, held: null, exhaust() {} };
  const state = { screen: "playing", world, boats, minecarts: new Minecarts({ rails: {} }), rider: createPlayerRider(), survival,
    position: { x: 0.5, y: 1, z: 0.5 }, previous: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, motion: {}, yaw: 0, eating: null };
  const act = (a) => dispatchVehicleAction(state, a, {});
  assert.equal(act(captureVehicleAction({ cartId: boat.id, boat: true, place: true })).branch, "mount-boat");
  assert.equal(state.rider.vehicle, boat);
  const out = moveRidingPlayer(state, { forward: 1, strafe: 1 }, {});
  assert.ok(out && state.rider.moveForward > 0 && state.rider.moveStrafing < 0);
  finishVehicleTick(state);
  assert.equal(act(captureVehicleAction({ dismount: true })).branch, "dismount-minecart");
  assert.equal(state.rider.vehicle, null);
  assert.equal(act(captureVehicleAction({ cartId: boat.id, boat: true, place: false })).branch, "hit-boat");
  assert.equal(boat.damage > 0, true);
});
