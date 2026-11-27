// b101 horse101: S08 of the dismount carries the player's yaw and pitch (nh.a(x, y, z, mw.y, mw.z), bytecode-read), the client applies them and answers each S08 with a C06
// (bjb.a(fu), bytecode-read), /netstat counts the reply as C06; messages queued around a dismount keep packet order.
import test from "node:test";
import assert from "node:assert/strict";
import { DedicatedClient } from "./multiplayer/client.js";
import { applyDismount } from "./multiplayer/client-dismount.js";
import { readPackets } from "./multiplayer/net-packet-ids.js";
import { makeSide } from "../tools/sweep-use75.mjs";

const vec = () => ({ x: 0, y: 0, z: 0, set(x, y, z) { Object.assign(this, { x, y, z }); }, copy(o) { this.set(o.x, o.y, o.z); } });

test("the server's dismount message carries the player's own yaw and pitch", () => {
  const { s, p } = makeSide();
  const cart = s.vehicles.spawnVehicle("minecart", p.position.x, p.position.y, p.position.z);
  s.tick(); s.vehicles.queue("a", { v: `c${cart.id}`, hit: false }); s.tick();
  p.yaw = 1.25; p.pitch = -0.4;
  s.vehicles.dismount(p, true);
  const m = p.dimOut.find((q) => q.type === "dismount");
  assert.equal(m.yaw, 1.25); assert.equal(m.pitch, -0.4);
});

test("applyDismount sets the look from the message, ignores a message without one", () => {
  const look = [];
  const st = () => ({ position: vec(), previous: vec(), velocity: vec(), motion: {}, setRiding() {}, setLook: (y, p) => look.push([y, p]) });
  applyDismount({ x: 1, y: 2, z: 3, yaw: 0.5, pitch: 0.1 }, st());
  assert.deepEqual(look, [[0.5, 0.1], [0.5, 0.1]]);
  applyDismount({ x: 1, y: 2, z: 3 }, st());
  assert.equal(look.length, 2);
});

test("the client answers each S08 of a dismount with a C06, counted as id 6", () => {
  const sent = [];
  const c = new DedicatedClient({});
  c.send = (m) => sent.push(m); c.socket = {}; c.ready = true;
  c.apply({ type: "dismount", x: 1, y: 2, z: 3, yaw: 0.5, pitch: 0.1 });
  assert.equal(sent.length, 2);
  assert.ok(sent.every((m) => m.type === "posLookAck" && m.yaw === 0.5));
  const rec = readPackets(sent[0]);
  assert.equal(rec.length, 1); assert.equal(rec[0][0], 6);
  assert.equal(rec[0][1], readPackets({ type: "input" })[0][1]);
});

test("ordered messages buffered around a dismount keep packet order at start()", () => {
  const log = [];
  const c = new DedicatedClient({ onDismount: () => log.push("dismount"), onHealth: () => log.push("health"), onChat: () => log.push("chat") });
  c.send = () => {};
  c.buffer({ type: "health", health: 5, food: 20, saturation: 0 });
  c.buffer({ type: "dismount", x: 1, y: 2, z: 3 });
  c.buffer({ type: "chat", name: "", text: "x" });
  c.start();
  assert.deepEqual(log, ["health", "dismount", "chat"]);
});
