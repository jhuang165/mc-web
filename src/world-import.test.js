import { test } from "node:test";
import assert from "node:assert/strict";
import { importedRuntime } from "./world-import.js";
import { World, WATER, SAND } from "./world.js";
import { Fluids } from "./fluids.js";
import { FallingBlocks } from "./falling.js";
import { Weather } from "./weather.js";
import { Projectiles } from "./projectiles.js";
import { Arrows } from "./bow.js";

test("an exported world retains weather, projectiles, TNT and scheduled work on import", () => {
  const w = new World("import");
  w.set(30, 50, 30, WATER);
  const fluids = new Fluids(w);
  fluids.schedule(30, 50, 30, 2);
  w.set(31, 50, 30, SAND);
  const falling = new FallingBlocks(w);
  falling.schedule(31, 50, 30);
  falling.tick();
  const data = JSON.parse(JSON.stringify({
    weather: { rainTime: 123, thunderTime: 456, raining: true, thundering: false },
    projectiles: [{ kind: "egg", x: 30, y: 50, z: 30, mx: 0.1, my: 0.2, mz: 0.3, yaw: 0, pitch: 0 }],
    arrows: [{ x: 31, y: 50, z: 30, mx: 0.4, my: 0.1, mz: 0.2, yaw: 0, pitch: 0, inGround: false }],
    tnt: [{ x: 30, y: 50, z: 30, vx: 0, vy: 0, vz: 0, fuse: 17 }],
    fallingTicks: falling.save(), fluidTicks: fluids.save(), fireTicks: { version: 1, time: 10, entries: [] },
    position: { x: 30, y: 50, z: 30 }, drops: [], entities: [], farms: [],
    experience: { total: 7 }, xpOrbs: [], falling: [], id: "foreign-id", mode: "invalid", unknown: true,
  }));
  const payload = importedRuntime(data);
  assert.equal(payload.id, undefined);
  assert.equal(payload.mode, undefined);
  assert.equal(payload.unknown, undefined);
  for (const key of ["weather", "projectiles", "arrows", "tnt", "fluidTicks", "fireTicks", "fallingTicks", "position", "drops", "entities", "farms", "experience", "xpOrbs", "falling"])
    assert.deepEqual(payload[key], data[key], key);
  assert.deepEqual(new Weather().restore(payload.weather).save(), data.weather);
  const projectiles = new Projectiles(), arrows = new Arrows();
  projectiles.load(payload.projectiles);
  arrows.load(payload.arrows);
  assert.equal(projectiles.serialize()[0].kind, "egg");
  assert.equal(projectiles.serialize()[0].mx, 0.1);
  assert.equal(arrows.serialize()[0].x, 31);
  assert.equal(arrows.serialize()[0].mx, 0.4);
  const restored = new Fluids(w);
  restored.load(payload.fluidTicks);
  assert.deepEqual(restored.save(), fluids.save());
  const restoredFalling = new FallingBlocks(w);
  restoredFalling.load(payload.fallingTicks);
  assert.deepEqual(restoredFalling.save(), falling.save());
});

test("legacy imports leave absent runtime fields absent for subsystem migration", () => {
  assert.deepEqual(importedRuntime({ position: { x: 1, y: 2, z: 3 }, drops: [] }), { position: { x: 1, y: 2, z: 3 }, drops: [] });
});
