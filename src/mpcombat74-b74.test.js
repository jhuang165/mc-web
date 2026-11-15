// b74 mpcombat74: server player hits on mobs carry the sprint knockback and slow the attacker; the crit animation follows the live entity.
import test from "node:test";
import assert from "node:assert/strict";
import { applyCritFx } from "./multiplayer/client-crit-fx.js";
import { attackerSlowdown } from "./multiplayer/server-attack-slowdown.js";
import { sendCritFx } from "./multiplayer/server-crit-fx.js";

test("attackerSlowdown: only with knockback, 0.6 on motion and sprint off", () => {
  const p = { velocity: { x: 1, y: 0.2, z: -1 }, motion: { sprinting: true } };
  assert.equal(attackerSlowdown(p, { knockback: 0 }), false);
  assert.equal(p.motion.sprinting, true);
  assert.equal(attackerSlowdown(p, { knockback: 1 }), true);
  assert.deepEqual([p.velocity.x, p.velocity.y, p.velocity.z, p.motion.sprinting], [0.6, 0.2, -0.6, false]);
});

test("crit animation follows the live mob and player, falls back to the snapshot", () => {
  const out = [];
  const fx = { crit2: (t, m) => out.push(t) };
  const live = { mob: id => (id === 7 ? { x: 9, z: 9, minY: 70, width: 0.6, height: 1.8, mx: 0, my: 0, mz: 0 } : null), player: id => (id === 3 ? { x: 4, y: 65, z: 5, ySize: 0.5 } : null) };
  const base = { x: 1, y: 64, z: 2, w: 0.6, h: 1.8, m: 0 };
  applyCritFx({ events: [{ ...base, i: 7 }, { ...base, pl: 3 }, { ...base, i: 8 }] }, fx, live);
  assert.equal(out[0]().x, 9);
  assert.deepEqual([out[1]().x, out[1]().minY, out[1]().z], [4, 64.5, 5]);
  assert.equal(out[2]().x, 1);
});

test("server crit event carries the target id", () => {
  const a = { id: 1, dimension: 0, position: { x: 0, y: 0, z: 0 } };
  sendCritFx({ players: new Map([[1, a]]) }, a, { x: 1, y: 2, z: 3, w: 0.6, h: 1.8, mob: 12 }, false);
  assert.equal(a.dispOut[0].events[0].i, 12);
  assert.equal(a.dispOut[0].events[0].pl, undefined);
});

test("dedicated server: a sprinting hit on a pig pushes it and stops the attacker's sprint", async () => {
  const { World } = await import("./world.js");
  const { DedicatedSimulation } = await import("./multiplayer/simulation.js");
  const { IDLE_INPUT } = await import("./multiplayer/protocol.js");
  const world = new World("mpcombat74");
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: "survival", mobs: true });
  s.mobs.spawning = false;
  const a = s.addPlayer("a", "ax", "00000000-0000-0000-0000-000000000001");
  a.position.copy({ x: 64.5, y: 10, z: 64.5 }); a.previous.copy(a.position);
  s.input("a", { type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
  s.mobs.mobs.entities.length = 0;
  const pig = s.mobs.mobs.create("pig", 66.5, 10, 64.5);
  s.mobs.mobs.entities.push(pig);
  s.tick();
  a.motion.sprinting = true; a.velocity.x = 0.2; a.velocity.z = 0.2;
  const vx = pig.vx;
  assert.equal(s.mobs.attack(a, Number(pig.id.slice(4))), true);
  assert.equal(a.motion.sprinting, false);
  assert.ok(Math.abs(a.velocity.x - 0.12) < 1e-9);
  assert.notEqual(pig.vx, vx);
  assert.equal(a.dispOut?.filter(m => m.type === "pfx73").length ?? 0, 0);
});
