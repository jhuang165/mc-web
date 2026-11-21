// Batch 91 mpobjects91: WorldServer.tick's weather / random ticks / lightning and the map updates run before the EntityTracker flush (bytecode-read mt.b, MinecraftServer
// updateTimeLightAndEntities: mt.b(), mt.h(), mn.a()), and the multiplayer client's boat and cart copies cast their 0.5 shadow.
// See .shared-memory/notes/mpobjects91-b91-track.md.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { SHADOWS, vehicleShadowCasters } from "./shadows.js";

const src = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

test("a server tick runs weather, lightning and the mob entity pass before the tracker flush, and the map update before it too", () => {
  const w = new World("b91-order");
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 9; y <= 20; y++) w.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  w.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world: w, gameMode: "survival", mobs: false });
  const p = s.addPlayer("a", "ax", key(1)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position);
  s.input("a", { type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
  s.tick();
  const log = [];
  const spy = (o, name, tag) => { const f = o[name].bind(o); o[name] = (...a) => { log.push(tag); return f(...a); }; };
  spy(s.weather, "tick", "weather"); spy(s.lightning, "tick", "lightning"); spy(s.weather, "drain", "drain");
  spy(s.mobs, "tick", "mobs"); spy(s.maps, "tick", "maps"); spy(s.dispense, "flush", "flush");
  s.tick();
  const at = (t) => log.indexOf(t);
  assert.ok(at("weather") >= 0 && at("flush") >= 0);
  assert.ok(at("weather") < at("lightning") && at("lightning") < at("drain"), "bolts update after the random ticks");
  assert.ok(at("drain") < at("mobs"), "WorldServer.tick precedes World.updateEntities");
  assert.ok(at("mobs") < at("maps") && at("maps") < at("flush"), "ItemMap.onUpdate is a player entity update: before the tracker pass");
});

test("the Nether tick draws its random block ticks before the entity pass and the flush (source pin)", () => {
  const n = src("./multiplayer/server-nether.js");
  assert.ok(n.indexOf("n.weather.tickDimension(") < n.indexOf("n.dispense.tick();"));
  assert.ok(n.indexOf("n.weather.tickDimension(") < n.indexOf("n.dispense.flush();"));
});

test("boat and cart copies cast the 0.5 shadow at posY, interpolated by the partial tick; dead ones cast none", () => {
  const boat = { px: 0, py: 4, pz: 2, x: 2, posY: 6, z: 4, dead: false }, gone = { px: 0, py: 0, pz: 0, x: 0, posY: 0, z: 0, dead: true };
  const [c] = vehicleShadowCasters([boat, gone], SHADOWS.boat, 0.5);
  assert.deepEqual([c.x, c.y, c.z, c.height, c.size, c.opaque], [1, 5, 3, 0, Math.fround(0.5), 1]);
  assert.deepEqual(c.pos, { x: 2, y: 6, z: 4 });
  assert.equal(vehicleShadowCasters([gone], SHADOWS.minecart, 1).length, 0);
  assert.equal(SHADOWS.minecart.size, Math.fround(0.5));
});

test("main.js wires the remote vehicles into shadowCasters", () => {
  const m = src("./main.js");
  const body = m.slice(m.indexOf("function shadowCasters("), m.indexOf("async function boot("));
  assert.match(body, /vehicleShadowCasters\(remoteVehicles\.boats\.carts, SHADOWS\.boat, partial\)/);
  assert.match(body, /vehicleShadowCasters\(remoteVehicles\.carts\.carts, SHADOWS\.minecart, partial\)/);
});
