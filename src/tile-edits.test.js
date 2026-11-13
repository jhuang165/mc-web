// Batch 43 (tileedits): tile entity descriptions for cell-change resends and for tile edits (sign text, skull placement, beacon picks, spawner mob).
// PlayerInstance.sendChunkUpdate sends the changed cell's description packet (S33 sign, S35 skull/spawner/beacon/pot with action 4/1/3/5) for a
// 1 to 63 cell resend, and markBlockForUpdate after a tile edit does the same. Unit level: the dedicated simulation and client, no sockets.
import test from "node:test";
import assert from "node:assert/strict";
import { World, MOB_SPAWNER, FLOWER_POT } from "./world.js";
import { SIGN_POST, WALL_SIGN } from "./signs.js";
import { SKULL } from "./skull.js";
import { BEACON } from "./pyramid.js";
import { setPotContents } from "./stone-utility.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { DedicatedClient } from "./multiplayer/client.js";
import { expandChunks, IDLE_INPUT } from "./multiplayer/protocol.js";
import { describeCell, describeTiles, applyTiles } from "./tile-sync.js";
import { ServerItems as MirrorItems } from './multiplayer/server-items.js';
MirrorItems.prototype.mirror = true; // b62: these tests seed a Creative inventory through the retired hotbar mirror

const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const hot = (item) => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: [item, ...Array(8).fill(null)] });
function fixture() {
  const world = new World("dedicated-test");
  for (let x = 58; x <= 70; x++) for (let z = 58; z <= 70; z++) for (let y = 9; y <= 22; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return new DedicatedSimulation({}, { world });
}
const joined = (s, name = "Alice", n = 1) => { const p = s.addPlayer(name.toLowerCase(), name, key(n)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); return p; };

// A replica world holding the same blocks as the server, to apply a tick's cells and tiles to.
function replicaOf(s) {
  const r = new World("dedicated-test");
  for (let x = 58; x <= 70; x++) for (let z = 58; z <= 70; z++) for (let y = 9; y <= 22; y++) r.put(x, y, z, s.world.get(x, y, z), s.world.getMeta(x, y, z), false);
  return r;
}
function apply(replica, stores, tick) {
  const m = expandChunks(tick);
  for (const [x, y, z, b, meta] of m.changes) replica.put(x, y, z, b, meta, false);
  return applyTiles(m.tiles ?? [], { world: replica, ...stores });
}
const freshStores = () => ({ signs: new (s0.signs.constructor)(), skulls: new (s0.skulls.constructor)(), beacons: new (s0.beacons.constructor)(), spawners: new (s0.spawners.constructor)() });
let s0;

test("a sign placed by one player arrives with its description, and its text edit (C12) arrives as an S33 on its own", () => {
  const s = fixture(), alice = joined(s), bob = joined(s, "Bob", 2);
  bob.position.x += 3;
  s0 = s.tileEntities;
  s.world.set(64, 11, 61, 3);
  assert.equal(s.input("alice", hot({ id: 480 })), true);
  s.queueEdit("alice", { place: true });
  const placed = s.tick();
  assert.equal(s.world.get(64, 11, 62), WALL_SIGN);
  assert.deepEqual(placed.tiles, [{ kind: "sign", x: 64, y: 11, z: 62, text: ["", "", "", ""] }], "the 1-cell resend carries the (still empty) sign");
  assert.deepEqual(alice.openSign, [64, 11, 62], "the placer gets the S36 open-editor message");
  assert.equal(s.tileEntities.signs.tile(64, 11, 62).editor, "alice");
  const text = ["Hello", "a really long line over fifteen", "", "x\u0007y"];
  assert.equal(s.updateSign("bob", { x: 64, y: 11, z: 62, text }), false, "only the editor edits");
  assert.equal(s.updateSign("alice", { x: 64, y: 11, z: 62, text: ["a", "b"] }), false, "four lines");
  assert.equal(s.updateSign("alice", { x: 64, y: 11, z: 62, text: ["a", "b", 3, "d"] }), false, "strings only");
  assert.equal(s.updateSign("alice", { x: 1, y: 2, z: 3, text: ["", "", "", ""] }), false, "no sign there");
  assert.equal(s.tick().tiles, undefined, "refused edits send nothing");
  assert.equal(s.updateSign("alice", { x: 64, y: 11, z: 62, text }), true);
  const edit = s.tick();
  assert.deepEqual(edit.changes, [], "no block changed");
  assert.deepEqual(edit.tiles, [{ kind: "sign", x: 64, y: 11, z: 62, text: ["Hello", "!?", "", "!?"] }], "acceptLine: over 15 characters or a control character becomes !?");
  // a replica applies both and ends with the same sign, not editable
  const replica = replicaOf(s), stores = freshStores();
  replica.put(64, 11, 62, WALL_SIGN, s.world.getMeta(64, 11, 62), false);
  assert.equal(apply(replica, stores, edit), 1);
  assert.deepEqual(stores.signs.tile(64, 11, 62).text, ["Hello", "!?", "", "!?"]);
  assert.equal(stores.signs.tile(64, 11, 62).editable, false);
  s.removePlayer("alice"); s.removePlayer("bob");
});

test("a skull placed with its rotation, and the sign of a placed standing post, arrive with their descriptions; breaking them drops the tile", () => {
  const s = fixture(), p = joined(s);
  s0 = s.tileEntities;
  p.yaw = 1.2; p.pitch = -Math.PI / 2;
  assert.equal(s.input("alice", { ...hot({ id: 2050, damage: 3 }), yaw: 1.2, pitch: -Math.PI / 2 }), true);
  s.queueEdit("alice", { place: true });
  const tick = s.tick();
  assert.equal(s.world.get(64, 10, 64), SKULL);
  const tile = s.tileEntities.skulls.tile(64, 10, 64);
  assert.equal(tile.type, 3);
  assert.equal(tick.tiles.length, 1);
  assert.deepEqual(tick.tiles[0], { kind: "skull", action: 4, x: 64, y: 10, z: 64, type: 3, rot: tile.rot, owner: "" });
  assert.equal(describeCell(s.tileEntities, 64, 10, 64).rot, tile.rot);
  const replica = replicaOf(s), stores = freshStores();
  replica.put(64, 10, 64, SKULL, 1, false);
  assert.equal(apply(replica, stores, tick), 1);
  assert.deepEqual([stores.skulls.tile(64, 10, 64).type, stores.skulls.tile(64, 10, 64).rot], [3, tile.rot]);
  // dig it (look at it from where it was placed): the tile goes with the block
  s.input("alice", { ...hot(null), yaw: 1.2, pitch: -Math.PI / 2 });
  s.queueEdit("alice", { place: false });
  s.tick();
  assert.equal(s.world.get(64, 10, 64), 0);
  assert.equal(s.tileEntities.skulls.tile(64, 10, 64), null);
});

test("a beacon's effects (MC|Beacon) and a spawner's mob arrive as S35 descriptions with the native action ids; a flower pot change arrives with its cell", () => {
  const s = fixture(), p = joined(s);
  s0 = s.tileEntities;
  // a full level 1 pyramid under a beacon with open sky
  for (let x = 63; x <= 65; x++) for (let z = 63; z <= 65; z++) s.world.put(x, 10, z, 26, 0, false);
  s.world.put(64, 11, 64, BEACON, 0, false); s.world.put(70, 11, 70, MOB_SPAWNER, 0, false);
  const placed = s.tick();
  assert.deepEqual(placed.tiles.map((t) => [t.kind, t.action ?? null]), [["beacon", 3], ["spawner", 1]], "S35 actions 3 (beacon) and 1 (spawner) for placed blocks");
  assert.equal(s.chooseBeacon("alice", { x: 64, y: 11, z: 64, primary: 1, secondary: 0 }), false, "no window open: ignored");
  s.openBeacon(p, 64, 11, 64);
  assert.equal(s.chooseBeacon("alice", { x: 64, y: 11, z: 64, primary: 1, secondary: 0 }), false, "no payment in the slot: ignored");
  assert.equal(s.setBeaconPayment("alice", { item: { id: 302, damage: 0 } }), true);
  assert.equal(s.chooseBeacon("alice", { x: 64, y: 11, z: 64, primary: 1, secondary: 0 }), true, "an iron ingot pays");
  const tick = s.tick();
  assert.deepEqual(tick.tiles, [{ kind: "beacon", action: 3, x: 64, y: 11, z: 64, primary: 1, secondary: 0, levels: 1 }]);
  assert.equal(s.chooseBeacon("alice", { x: 64, y: 11, z: 64, primary: 10, secondary: 0 }), false, "the one ingot was consumed");
  s.setBeaconPayment("alice", { item: { id: 302 } });
  assert.equal(s.chooseBeacon("alice", { x: 64, y: 11, z: 64, primary: 10, secondary: 0 }), true);
  assert.equal(s.tileEntities.beacons.get(64, 11, 64).primary, 0, "a level 1 beacon refuses a tier 4 effect (validPrimary)");
  s.tick();
  assert.equal(s.setSpawnerEntity(70, 11, 70, "Zombie"), true);
  assert.equal(s.setSpawnerEntity(1, 1, 1, "Zombie"), false);
  const sp = s.tick();
  assert.equal(sp.tiles[0].kind, "spawner");
  assert.equal(sp.tiles[0].nbt.EntityId, "Zombie");
  const replica = replicaOf(s), stores = freshStores();
  replica.put(64, 11, 64, BEACON, 0, false); replica.put(70, 11, 70, MOB_SPAWNER, 0, false);
  apply(replica, stores, { tick: 1, changes: [], tiles: [...tick.tiles, ...sp.tiles] });
  assert.equal(stores.spawners.get(70, 11, 70).entityId, "Zombie");
  assert.equal(stores.beacons.get(64, 11, 64).primary, 1);
  // a pot filled on the server: the changed cell carries its plant
  s.world.put(60, 10, 60, FLOWER_POT, 0, false); s.tick();
  setPotContents(s.world, 60, 10, 60, { id: 37, damage: 0 }); s.tileChanged(60, 10, 60);
  assert.deepEqual(s.tick().tiles, [{ kind: "pot", action: 5, x: 60, y: 10, z: 60, id: 37, damage: 0 }]);
});

test("a dirty tile outside a resent section is its own description; inside one it rides in the chunk entry only, and a plain client gets both", () => {
  const s = fixture(); joined(s);
  s0 = s.tileEntities;
  s.world.put(60, 10, 60, SKULL, 1, false); s.tileEntities.skulls.create(60, 10, 60, 1, 5);
  s.tick();
  s.tileChanged(60, 10, 60);
  for (let i = 0; i < 64; i++) s.world.put(48 + (i % 16), 20, 48 + (i >> 4), 4, 0); // 64 cells of chunk 3,3, section 1
  const outside = s.tick();
  assert.equal(outside.chunks.length, 1);
  assert.equal(outside.chunks[0].tiles, undefined, "section 0 is not in the mask");
  assert.deepEqual(outside.tiles.map((t) => t.kind), ["skull"]);
  assert.equal(expandChunks(outside).tiles.length, 1);
  s.tileChanged(60, 10, 60);
  for (let i = 0; i < 64; i++) s.world.put(48 + (i % 16), i < 32 ? 10 : 20, 48 + (i >> 4), 5, 0); // the mask now has sections 0 and 1
  const inside = s.tick();
  assert.deepEqual(inside.chunks[0].tiles.map((t) => t.kind), ["skull"]);
  assert.equal(inside.tiles, undefined, "not sent twice");
  assert.equal(expandChunks(inside).tiles.length, 1);
});

test("the client merges buffered ticks without losing tile descriptions", () => {
  const c = new DedicatedClient({ onTick: (m) => seen.push(m) }), seen = [];
  const sign = (text) => ({ kind: "sign", x: 1, y: 2, z: 3, text });
  c.buffer({ type: "tick", tick: 1, changes: [[1, 2, 3, SIGN_POST, 0]], tiles: [sign(["a", "", "", ""])], players: [] });
  c.buffer({ type: "tick", tick: 2, changes: [], tiles: [sign(["b", "", "", ""]), { kind: "skull", x: 4, y: 5, z: 6, type: 1, rot: 2 }], players: [] });
  c.buffer({ type: "tick", tick: 3, changes: [], players: [] });
  c.start();
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0].tiles.map((t) => t.kind + (t.text?.[0] ?? "")), ["signb", "skull"], "the newest description per cell wins, earlier ones are kept");
  assert.equal(seen[0].tick, 3);
});

test("describeTiles finds flower pots through the column array, in the old scan order", () => {
  const w = new World("tilesync-pots", "java", 9), stores = { world: w };
  const cells = [[3, 70, 9], [3, 71, 2], [3, 20, 2], [15, 255, 15], [0, 0, 0], [20, 70, 5]];
  for (const [x, y, z] of cells) w.put(x, y, z, FLOWER_POT, 0, false);
  const order = (mask) => describeTiles(stores, 0, 0, mask).map((t) => [t.x, t.y, t.z]);
  assert.deepEqual(order(0xffff), [[0, 0, 0], [3, 71, 2], [3, 20, 2], [3, 70, 9], [15, 255, 15]].sort((a, b) => a[0] - b[0] || a[2] - b[2] || a[1] - b[1]));
  assert.deepEqual(order(1 << 4), [[3, 71, 2], [3, 70, 9]].sort((a, b) => a[0] - b[0] || a[2] - b[2] || a[1] - b[1]), "only the section at y 64..79");
  assert.equal(describeTiles(stores, 1, 0, 0xffff).length, 1, "chunk 1 holds the pot at x 20");
});
