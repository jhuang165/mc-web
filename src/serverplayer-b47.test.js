import test from "node:test";
import assert from "node:assert/strict";
import { replayEndermanWolf, reference47 as reference, firstDivergence } from "./enderman-wolf-replay.js";
import { drainMobEvents } from "./living-simulation.js";
import { finishMinecartSimulation } from "./structure-simulation.js";

// enderman-wolf-b47sp-reference.json: EndermanWolfProbe, set b47sp (EW_SET=b47sp), executed on the unchanged obfuscated 1.7.10 jar. The probe's client position runs the
// EntityClientPlayerMP C03 rule and its server copy runs NetHandlerPlayServer.processPlayer + EntityPlayerMP.onUpdateEntity, so every tick compares the copy's motion and position.
test("b47sp reference covers collision, sneak edge, liquids, web, ladder and flying", () => {
  assert.ok(reference.records.length >= 19);
  for (const k of ["water", "lava", "web", "ladder", "sneak", "fly"]) assert.ok(reference.records.some((r) => r.name.includes(k)), k);
});
for (const r of reference.records) {
  test(`server player b47: ${r.name} replays with no divergence`, () => {
    assert.equal(firstDivergence(r, replayEndermanWolf(r)), null, r.name);
  });
}

test("a dragon wing sweep adds its velocity to the client player and the server copy", () => {
  const v = { x: 0, y: 0, z: 0 }, copy = { x: 0.1, y: 0, z: 0 };
  drainMobEvents({ mobs: { drain: () => [{ dragonPush: { x: 1, y: 0.2, z: -1 } }], ai: { player: { motion: copy } } }, xpOrbs: {}, items: {} },
    { push: (d) => { v.x += d.x; v.y += d.y; v.z += d.z; } });
  assert.deepEqual(v, { x: 1, y: 0.2, z: -1 });
  assert.deepEqual(copy, { x: 1.1, y: 0.2, z: -1 });
});

test("a cart's push on the player also reaches the server copy's motion", () => {
  const cart = { dead: false, bb: [0, 64, 0, 1, 65, 1], vx: 0, vz: 0 };
  const minecarts = { carts: [cart], pushEntity: () => [0.02, -0.01], drain: () => [] };
  const copy = { x: 0, y: 0, z: 0 }, velocity = { x: 0, y: 0, z: 0 };
  finishMinecartSimulation({ world: {}, minecarts, mobs: { entities: [], size: () => [1, 1], ai: { player: { motion: copy } } }, position: { x: 0.5, y: 64, z: 0.5 }, velocity, width: 0.6, height: 1.8, alive: true });
  assert.deepEqual([velocity.x, velocity.z], [0.02, -0.01]);
  assert.deepEqual([copy.x, copy.z], [0.02, -0.01]);
});
