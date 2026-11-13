// Batch 44 (clientscreens): the multiplayer client's sign editor (S36 -> C12) and beacon window (open window, payment slot, MC|Beacon) against the
// dedicated simulation, with no sockets: the client's `send` is replaced by a queue the test delivers to the simulation the way server/server.js does.
import test from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { SignEditModel, WALL_SIGN, Signs } from "./signs.js";
import { BEACON, Beacons } from "./pyramid.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { DedicatedClient } from "./multiplayer/client.js";
import { expandChunks, IDLE_INPUT } from "./multiplayer/protocol.js";
import { applyTiles } from "./tile-sync.js";
import { ServerItems as MirrorItems } from './multiplayer/server-items.js';
MirrorItems.prototype.mirror = true; // b62: these tests seed a Creative inventory through the retired hotbar mirror

globalThis.WebSocket ??= { OPEN: 1 };
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const hot = (item, extra = {}) => ({ type: "input", controls: { ...IDLE_INPUT, ...extra }, yaw: 0, pitch: 0, current: 0, hotbar: [item, ...Array(8).fill(null)] });
function fixture() {
  const world = new World("dedicated-test");
  for (let x = 58; x <= 70; x++) for (let z = 58; z <= 70; z++) for (let y = 9; y <= 22; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return new DedicatedSimulation({}, { world });
}
const joined = (s, name = "Alice", n = 1) => { const p = s.addPlayer(name.toLowerCase(), name, key(n)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); return p; };
// A client whose sends are collected, then delivered to the simulation (server.js dispatch).
function wire(sim, id) {
  const sent = [], client = new DedicatedClient();
  client.socket = { readyState: WebSocket.OPEN, bufferedAmount: 0, send: (text) => sent.push(JSON.parse(text)) };
  const deliver = () => {
    for (const m of sent.splice(0)) {
      if (m.type === "sign") sim.updateSign(id, m);
      else if (m.type === "beacon") sim.chooseBeacon(id, m);
      else if (m.type === "beaconPayment") sim.setBeaconPayment(id, m);
      else if (m.type === "closeWindow") sim.closeWindow(id);
    }
  };
  return { client, sent, deliver };
}
// The per-player messages server.js sends after a tick.
function afterTick(p, sim) {
  const out = [];
  if (p.openSign) out.push({ type: "signEditor", x: p.openSign[0], y: p.openSign[1], z: p.openSign[2] });
  if (p.openBeacon) { const t = sim.tileEntities.beacons.get(...p.openBeacon); out.push({ type: "beaconWindow", x: p.openBeacon[0], y: p.openBeacon[1], z: p.openBeacon[2], levels: t.levels, primary: t.primary, secondary: t.secondary, payment: t.payment ? { id: t.payment.id, damage: t.payment.damage ?? 0 } : null }); }
  p.openSign = null; p.openBeacon = null;
  return out;
}
const replica = (s) => { const r = new World("dedicated-test"); for (let x = 58; x <= 70; x++) for (let z = 58; z <= 70; z++) for (let y = 9; y <= 22; y++) r.put(x, y, z, s.world.get(x, y, z), s.world.getMeta(x, y, z), false); return r; };

test("S36 opens the editor on the client, Done sends C12, and the accepted text reaches the client's tile and the other player", () => {
  const s = fixture(), alice = joined(s), bob = joined(s, "Bob", 2);
  bob.position.x += 3;
  const a = wire(s, "alice"), opened = [];
  a.client.onSignEditor = (m) => opened.push(m);
  s.world.set(64, 11, 61, 3);
  s.input("alice", hot({ id: 480 })); s.queueEdit("alice", { place: true });
  const placed = s.tick();
  const [message] = afterTick(alice, s);
  assert.deepEqual(message, { type: "signEditor", x: 64, y: 11, z: 62 });
  // before start() the message is held with the other buffered ones, then delivered in order
  a.client.buffer(message); assert.equal(opened.length, 0);
  a.client.start(); assert.deepEqual(opened, [message]);
  // the client's replica holds the S33 description; the editor edits that tile, which the S36 handler marks editable
  const stores = { world: replica(s), signs: new Signs() };
  stores.world.put(64, 11, 62, WALL_SIGN, s.world.getMeta(64, 11, 62), false);
  assert.equal(applyTiles(expandChunks(placed).tiles, stores), 1);
  const tile = stores.signs.tile(64, 11, 62);
  assert.equal(tile.editable, false);
  tile.editable = true;
  // GuiEditSign: typed characters are filtered (no control characters or section signs) and cut at 15 per line
  const model = new SignEditModel(tile.text);
  for (const ch of "Hello\u0007 world, this is long") model.type(ch);
  model.keyCode(28); model.type("§"); model.type("x");
  assert.deepEqual(model.lines, ["Hello world, th", "x", "", ""]);
  assert.ok(model.lines.every((l) => l.length <= 15));
  assert.equal(stores.signs.update(64, 11, 62, model.lines), true, "the local tile takes the lines while editable");
  tile.editable = false;
  a.client.updateSign(64, 11, 62, model.lines);
  assert.deepEqual(a.sent, [{ type: "sign", x: 64, y: 11, z: 62, text: ["Hello world, th", "x", "", ""] }]);
  a.deliver();
  const edit = s.tick();
  assert.deepEqual(edit.tiles, [{ kind: "sign", x: 64, y: 11, z: 62, text: ["Hello world, th", "x", "", ""] }]);
  // another client's replica gets the text by the S33 description alone
  const other = { world: replica(s), signs: new Signs() };
  other.world.put(64, 11, 62, WALL_SIGN, s.world.getMeta(64, 11, 62), false);
  assert.equal(applyTiles(edit.tiles, other), 1);
  assert.deepEqual(other.signs.tile(64, 11, 62).text, ["Hello world, th", "x", "", ""]);
});

test("a beacon right-click opens a server window; the payment slot and MC|Beacon go through it and the S35 lands on the client", () => {
  const s = fixture(), alice = joined(s);
  // a level 1 pyramid under a beacon in the floor cell the player looks at
  for (let x = 63; x <= 65; x++) for (let z = 63; z <= 65; z++) s.world.put(x, 8, z, 26, 0, false);
  s.world.put(64, 9, 64, BEACON, 0, false);
  s.tick();
  const a = wire(s, "alice"), windows = [];
  a.client.onBeaconWindow = (m) => windows.push(m);
  // a sneaking click does not open it
  s.input("alice", { ...hot({ id: 302 }, { sneak: true }), pitch: -Math.PI / 2 });
  s.queueEdit("alice", { place: true }); s.tick();
  assert.equal(alice.openBeacon ?? null, null);
  s.input("alice", { ...hot({ id: 302 }), pitch: -Math.PI / 2 });
  s.queueEdit("alice", { place: true }); s.tick();
  const [open] = afterTick(alice, s);
  assert.deepEqual(open, { type: "beaconWindow", x: 64, y: 9, z: 64, levels: 1, primary: 0, secondary: 0, payment: null }, "levels and effects come from the server tile");
  a.client.start(); a.client.apply(open); assert.deepEqual(windows, [open]);
  // the client's tile is filled from the message
  const beacons = new Beacons(), tile = beacons.ensure(open.x, open.y, open.z);
  Object.assign(tile, { levels: open.levels, primary: open.primary, secondary: open.secondary, payment: null });
  // no payment: MC|Beacon is ignored
  a.client.chooseBeacon(64, 9, 64, 1, 0); a.deliver();
  assert.equal(s.tick().tiles, undefined);
  // a non-payment item is refused by the slot; a payment item fits
  a.client.setBeaconPayment({ id: 4, damage: 0 }); a.deliver();
  assert.equal(s.tileEntities.beacons.get(64, 9, 64).payment, null);
  a.client.setBeaconPayment({ id: 367, damage: 0 }); a.deliver();
  assert.equal(s.tileEntities.beacons.get(64, 9, 64).payment.id, 367);
  a.client.setBeaconPayment(null); a.deliver();
  assert.equal(s.tileEntities.beacons.get(64, 9, 64).payment, null, "taking it out empties the slot");
  a.client.setBeaconPayment({ id: 302 }); a.client.chooseBeacon(64, 9, 64, 1, 0); a.deliver();
  const tick = s.tick();
  assert.deepEqual(tick.tiles, [{ kind: "beacon", action: 3, x: 64, y: 9, z: 64, primary: 1, secondary: 0, levels: 1 }]);
  assert.equal(s.tileEntities.beacons.get(64, 9, 64).payment, null, "one item consumed");
  const stores = { world: replica(s), beacons };
  assert.equal(applyTiles(tick.tiles, stores), 1);
  assert.equal(tile.primary, 1);
  // a window for another cell, a closed window and a player out of reach are all refused
  a.client.setBeaconPayment({ id: 302 }); a.client.chooseBeacon(1, 9, 1, 1, 0); a.deliver();
  assert.equal(s.tick().tiles, undefined, "wrong cell");
  a.client.closeWindow(); a.deliver();
  a.client.chooseBeacon(64, 9, 64, 1, 0); a.deliver();
  assert.equal(s.setBeaconPayment("alice", { item: { id: 302 } }), false, "no window: the slot is not reachable");
  s.openBeacon(alice, 64, 9, 64); alice.position.x = 80;
  assert.equal(s.setBeaconPayment("alice", { item: { id: 302 } }), false, "more than 8 blocks away closes the window");
  assert.equal(alice.beaconWindow, null);
});
