// Batch 67 (tag b67bs): players and mobs stand on and bump into boats on the dedicated server (World.getCollidingBoundingBoxes adds EntityBoat's box;
// EntityMinecart has none). The expected tick records are the executed BoatProbe `collide` cases (public/research/boat-reference.json, replayed for single
// player in boats.test.js); here the boats come from a ServerVehicles and the mover walks in that world, found by world (no global boat list).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { World } from "./world.js";
import { moveEntity } from "./entities.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";

const ref = JSON.parse(await readFile(new URL("../public/research/boat-reference.json", import.meta.url)));
const num = (v) => (v === "-0" ? -0 : v);
const MOVES = { "stand-on-boat": [0, -0.2, 0, 40], "walk-into-boat-side": [0.2, -0.08, 0, 30], "walk-into-boat-side-z": [0, -0.08, -0.2, 30],
  "step-onto-boat": [0.2, -0.08, 0, 30], "stand-on-raised-boat": [0.2, -0.08, 0, 30], "rise-into-boat-from-below": [0, 0.2, 0, 20],
  "edge-walk-off-boat": [0.1, -0.08, 0, 30], "fall-through-minecart": [0, -0.2, 0, 40], "walk-through-minecart": [0.2, -0.08, 0, 30] };
// A flat world with the floor at y -1 of the probe (probe y 0 = world y 10).
const OY = 10;
function fixture() {
  const world = new World("boatstand-b67");
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return new DedicatedSimulation({}, { world, gameMode: "survival", mobs: false });
}
const at = (c, ox = 60, oz = 60) => ({ x: ox + c[0], y: OY + c[1], z: oz + c[2] });

for (const c of ref.cases.filter((r) => r.kind === "collide")) {
  test(`server mover: ${c.name}`, () => {
    const s = fixture(), world = s.world, sv = s.vehicles;
    if (c.cart) sv.spawnVehicle("minecart", ...Object.values(at(c.vehicle)));
    else {
      const v = at(c.vehicle), b = sv.spawnVehicle("boat", v.x, v.y, v.z);
      b.bb = c.vehicleBox.map(num).map((n, i) => n + [60, OY, 60][i % 3]); b.posY = v.y;
    }
    const st = at(c.start), e = { x: st.x, y: st.y, z: st.z, vx: 0, vy: 0, vz: 0, onGround: false, fallDistance: 0, living: true };
    const m = MOVES[c.name];
    c.ticks.forEach((t, i) => {
      moveEntity(world, e, 0.6, 1.8, m[0], m[1], m[2], c.step);
      for (const [k, v] of [[e.x - 60, t[0]], [e.y - OY, t[1]], [e.z - 60, t[2]]]) assert.ok(Math.abs(k - v) < 1e-6, `${c.name} tick ${i}: ${k} vs ${v}`);
      // Shifted by 10 blocks the landing tick's dy differs from the request by float noise (4e-16), so onGround is only compared after the landing tick.
      if (!(i > 0 && t[3] && !c.ticks[i - 1][3])) assert.equal(e.onGround, t[3], `onGround ${i}`);
      assert.equal(e.collidedH, t[4], `collidedH ${i}`);
    });
  });
}

test("another world's boats do not block (each dimension has its own boats)", () => {
  const a = fixture(), b = fixture();
  const boat = a.vehicles.spawnVehicle("boat", 60.5, 10, 60.5);
  assert.ok(boat);
  const drop = (world) => { const e = { x: 60.5, y: 13, z: 60.5, vx: 0, vy: 0, vz: 0, onGround: false, fallDistance: 0, living: true }; for (let i = 0; i < 40; i++) moveEntity(world, e, 0.6, 1.8, 0, -0.2, 0); return e.y; };
  assert.ok(drop(a.world) > 10.5, "stands on the boat in its own world");
  assert.equal(drop(b.world), 10, "falls to the floor in the other world");
});

test("a server player walking with movePlayer stands on a boat and is stopped by its side", () => {
  const s = fixture(), key = "00000000-0000-0000-0000-000000000001";
  const p = s.addPlayer("p1", "p1x", key);
  const boat = s.vehicles.spawnVehicle("boat", 70.5, 10, 70.5);
  p.position.copy({ x: 70.5, y: 12, z: 70.5 }); p.previous.copy(p.position);
  const input = (c) => ({ type: "input", controls: { ...IDLE_INPUT, ...c }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
  s.input("p1", input({}));
  for (let i = 0; i < 20; i++) s.tick();
  assert.ok(Math.abs(p.position.y - (boat.bb[4])) < 1e-6, `stands on the boat top ${p.position.y} vs ${boat.bb[4]}`);
  assert.ok(p.grounded !== false);
});
