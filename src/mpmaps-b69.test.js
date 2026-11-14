// Batch 69 mpmaps: maps on the dedicated server (multiplayer/server-maps.js, client-maps.js). The rules are the single-player classes (maps.js, executed in maps-clock-reference.json);
// the S34 cadence (MapInfo.getPacket) is replayed against map-packet-reference.json (tools/probes/MapPacketProbe.java run on the unchanged 1.7.10 classes). The server tests run
// DedicatedSimulation with no sockets.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { ServerMaps, mapPacket, packetInfo, drainDirty } from "./multiplayer/server-maps.js";
import { applyMapMessage, applyMapPayload, connectMaps, disconnectMaps } from "./multiplayer/client-maps.js";
import { MapStore, createMapData, ITEM_FILLED_MAP, ITEM_EMPTY_MAP, mapOnCreated, mapStore, MAP_BYTES } from "./maps.js";
import { mapsCraftingResult } from "./maps-clock-live.js";
import { FRAME_ITEM } from "./hanging.js";

const reference = JSON.parse(readFileSync(new URL("../public/research/map-packet-reference.json", import.meta.url)));
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const javaHash = (bytes) => { let h = 1; for (const b of bytes) h = (Math.imul(31, h) + b) | 0; return h; };

// ---- MapInfo.getPacket against the executed records ----
const records = (name) => reference.records.filter((r) => r.case === name);
function probeData(scale) {
  const d = createMapData(0, { scale });
  for (let i = 0; i < MAP_BYTES; i++) d.colors[i] = (i * 7 + 3) % 200; // Int8Array wraps like the probe's (byte) cast
  return d;
}
const dirty = (d, x, lo, hi) => { d.dirtyColumns = new Map([[x, [lo, hi]]]); drainDirty(d); }; // MapData.func_76194_a
const icon = (d, key, type, x, z, rot) => d.decorations.set(key, [type, x, z, rot]);
function expectCalls(name, d, info, onFrame, calls) {
  const rec = records(name);
  for (let i = calls[0]; i < calls[1]; i++) {
    const bytes = mapPacket(d, info, onFrame), want = rec[i];
    assert.equal(want.i, i);
    if (!bytes) { assert.equal(want.t, -1, `${name} call ${i}`); continue; }
    assert.deepEqual([bytes[0], bytes.length, javaHash(bytes)], [want.t, want.n, want.h], `${name} call ${i}`);
    assert.deepEqual(bytes.slice(0, want.b.length), want.b, `${name} call ${i} bytes`);
  }
}
test("a new map's packets: the scale record, the icon list, then one column per call and the icons every fifth call (executed)", () => {
  const d = probeData(2), info = packetInfo(d, "x");
  expectCalls("seq", d, info, false, [0, 170]);
  assert.equal(reference.records.filter((r) => r.case === "seq" && r.t === 0).length, 128); // every column went out exactly once in 170 calls
});
test("dirty ranges merge by min and max and only the dirty columns are sent again (executed)", () => {
  const d = probeData(2), info = packetInfo(d, "x");
  expectCalls("seq", d, info, false, [0, 170]);
  dirty(d, 5, 10, 20); dirty(d, 5, 15, 30); dirty(d, 77, 0, 3); dirty(d, 5, 2, 2);
  expectCalls("partial", d, info, false, [0, 60]);
});
test("a plain stack resends the icon list only when it changed, a stack on an item frame every fifth call (executed)", () => {
  let d = createMapData(0, { scale: 0 }); d.colors.set(probeData(0).colors);
  let info = packetInfo(d, "x");
  expectCalls("decor", d, info, false, [0, 3]);
  icon(d, "Alex", 0, 10, -20, 4); icon(d, "frame-3", 1, 120, 30, 8);
  expectCalls("decor", d, info, false, [3, 33]);
  icon(d, "Alex", 0, 11, -20, 4);
  expectCalls("decor", d, info, false, [33, 45]);
  d = createMapData(0, { scale: 1 }); d.colors.set(probeData(1).colors); info = packetInfo(d, "x");
  icon(d, "frame-3", 1, 120, 30, 8);
  expectCalls("frame", d, info, true, [0, 30]);
});

// ---- the client half ----
test("the client store takes the three payload kinds as MapData.updateMPMapData does and refuses malformed ones", () => {
  const store = new MapStore();
  assert.equal(applyMapPayload(store, 4, [2, 3]), true);
  assert.equal(store.get(4).scale, 3);
  assert.equal(applyMapPayload(store, 4, [0, 9, 5, 7, 8, 9]), true); // column 9 from row 5
  assert.deepEqual([store.get(4).colors[5 * 128 + 9], store.get(4).colors[6 * 128 + 9], store.get(4).colors[7 * 128 + 9]], [7, 8, 9]);
  assert.equal(applyMapPayload(store, 4, [1, (1 << 4) | 8, 10, -20, 6, 4, 4]), true);
  assert.deepEqual([...store.get(4).decorations], [["icon-0", [1, 10, -20, 8]], ["icon-1", [0, 4, 4, 6]]]);
  assert.equal(applyMapPayload(store, 4, [1]), true); // an empty list clears the icons
  assert.equal(store.get(4).decorations.size, 0);
  const before = store.get(4).revision;
  for (const bad of [[], [3], [0, 1], [0, 127, 0, 1.5], [2], "x", null, [0, -1, 0, 1]]) assert.equal(applyMapPayload(store, 4, bad), false);
  assert.equal(applyMapPayload(store, -1, [2, 0]), false);
  assert.equal(store.get(4).revision, before);
});
test("connecting marks the store remote: nothing takes ids on the client and leaving clears it", () => {
  const was = { remote: mapStore.remote, maps: mapStore.toJSON() };
  try {
    connectMaps(); assert.equal(mapStore.remote, true);
    const stack = { id: ITEM_FILLED_MAP, count: 1, damage: 5, mapScaling: true };
    const counter = mapStore.counter;
    mapOnCreated(mapStore, stack);
    assert.deepEqual([stack.damage, stack.mapScaling, mapStore.counter], [5, true, counter]);
    disconnectMaps(); assert.equal(mapStore.remote, false);
  } finally { mapStore.load(was.maps); mapStore.remote = was.remote; }
});

// ---- the server ----
function fixture({ gameMode = "survival", extra = {}, saved = {} } = {}) {
  const world = new World("b69-maps");
  for (let x = 0; x < 128; x++) for (let z = 0; z < 128; z++) for (let y = 0; y <= 30; y++) world.put(x, y, z, y === 9 ? ((x >> 3) % 2 ? 3 : 2) : y < 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const sim = new DedicatedSimulation(saved, { world, mobs: false, gameMode, ...extra });
  const p = sim.addPlayer("a", "Alex", key(1)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position);
  p.survival.inventory.main.fill(null); p.survival.inventory.current = 0;
  const messages = () => { const m = (p.itemsOut ?? []).filter((x) => x.type === "mapData"); p.itemsOut = null; return m; };
  return { sim, p, world, messages };
}
const give = (p, id, n = 1, damage = 0, slot = 0) => { p.survival.inventory.main[slot] = { id, count: n, damage }; };

test("an empty map on the server takes the next id, snaps the centre by scale 0 and replaces a single stack in place (executed rules)", () => {
  const { sim, p } = fixture();
  mapStore.load(null);
  p.position.copy({ x: 200.4, y: 10, z: -70.5 }); // Math.round(200.4 / 128) = 2, round(-70.5 / 128) = -1 (half rounds up: floor(x + 0.5))
  give(p, ITEM_EMPTY_MAP, 1, 0, 3); p.survival.inventory.current = 3;
  assert.equal(sim.maps.useEmpty(p), true);
  const map = p.survival.inventory.main[3];
  assert.deepEqual([map.id, map.count, map.damage], [ITEM_FILLED_MAP, 1, 0]);
  const data = sim.maps.store.get(0);
  assert.deepEqual([data.scale, data.xCenter, data.zCenter, data.dimension], [0, 256, -128, 0]);
  assert.equal(sim.maps.store.counter, 1);
  give(p, ITEM_EMPTY_MAP, 3, 0, 3);
  assert.equal(sim.maps.useEmpty(p), true);
  assert.deepEqual([p.survival.inventory.main[3].count, p.survival.inventory.main[0]?.damage ?? p.survival.inventory.main.find((s) => s?.id === ITEM_FILLED_MAP).damage], [2, 1]);
  p.survival.inventory.main[3] = { id: 1, count: 1, damage: 0 };
  assert.equal(sim.maps.useEmpty(p), false);
});
test("a full inventory drops the new map; Creative keeps the empty stack", () => {
  const { sim, p } = fixture();
  mapStore.load(null);
  p.survival.inventory.main.fill({ id: 1, count: 64, damage: 0 }); give(p, ITEM_EMPTY_MAP, 2, 0, 0);
  const dropped = sim.items.items.length;
  assert.equal(sim.maps.useEmpty(p), true);
  assert.equal(p.survival.inventory.main[0].count, 1);
  assert.equal(sim.items.items.length, dropped + 1);
  assert.equal(sim.items.items.at(-1).stack.id, ITEM_FILLED_MAP);
  const c = fixture({ gameMode: "creative" });
  give(c.p, ITEM_EMPTY_MAP, 4, 0, 0);
  c.sim.maps.useEmpty(c.p);
  assert.equal(c.p.survival.inventory.main[0].count, 4);
  assert.ok(c.p.survival.inventory.main.some((s) => s?.id === ITEM_FILLED_MAP));
});
test("the edit path uses an empty map when no block takes the click (open sky and a clicked block)", () => {
  const { sim, p } = fixture();
  mapStore.load(null);
  give(p, ITEM_EMPTY_MAP, 2); p.pitch = 1.4;
  assert.equal(sim.edit(p, true), true);
  assert.equal(p.survival.inventory.main[0].count, 1);
  p.moved = true; p.pitch = -1.4; // at the ground: a block ray, no block takes the item
  assert.equal(sim.edit(p, true), true);
  assert.equal(p.survival.inventory.main.filter((s) => s?.id === ITEM_FILLED_MAP).length, 2);
});

test("a held map is updated every tick and its S34 payloads rebuild the colours and the player marker on the client", () => {
  const { sim, p, messages } = fixture();
  mapStore.load(null);
  p.position.copy({ x: 100.5, y: 10, z: 100.5 }); p.previous.copy(p.position);
  give(p, ITEM_EMPTY_MAP, 1); sim.maps.useEmpty(p);
  const client = new MapStore(), id = p.survival.inventory.main[0].damage, data = sim.maps.store.get(id);
  let payloads = 0, first = null;
  for (let t = 0; t < 400; t++) {
    sim.tick();
    for (const m of messages()) { first ??= m; payloads += applyMapMessage(m, client); }
  }
  assert.deepEqual(first.maps[0].b, [2, 0]); // the first payload is the scale record
  assert.ok(payloads > 100);
  const mine = client.get(id);
  assert.equal(mine.scale, 0);
  assert.ok(mine.colors.some((c) => c !== 0), "the terrain is painted");
  assert.deepEqual([...mine.colors], [...data.colors]); // nothing dirty is left: the client's copy equals the server's
  assert.deepEqual([...mine.decorations.values()], [[0, -54, -54, 8]]); // the white marker at (100.5 - 128) * 2 + 0.5 truncated, game yaw 0 = MC degrees 180: (180 + 8) * 16 / 360 = 8
  assert.equal(data.xCenter, 128); // Math.round(100.5 / 128) = 1
});

// ---- item frames ----
function frameFixture() {
  const f = fixture({ gameMode: "creative" });
  for (let x = 60; x <= 66; x++) for (let y = 10; y <= 14; y++) f.world.put(x, y, 60, 1, 0, false); // a wall facing +z
  const b = f.sim.addPlayer("b", "Bea", key(2)); b.position.copy({ x: 70.5, y: 10, z: 70.5 }); b.previous.copy(b.position);
  b.survival.inventory.main.fill(null);
  f.b = b;
  give(f.p, FRAME_ITEM); f.p.survival.inventory.current = 0;
  f.sim.vehicles.hanging.useHeld(f.p, { block: [61, 11, 60], adjacent: [61, 11, 61] });
  f.frame = f.sim.vehicles.hanging.entities[0];
  return f;
}
test("a map in an item frame is sent to every player of the dimension every tenth tick with the frame marker, and the holder's marker is dropped", () => {
  const f = frameFixture(), { sim, p, b } = f;
  mapStore.load(null);
  p.position.copy({ x: 30.5, y: 10, z: 30.5 }); // centre (0, 0): the frame at (61, 60) lies on the map
  give(p, ITEM_EMPTY_MAP, 1); sim.maps.useEmpty(p);
  const stack = p.survival.inventory.main[0], id = stack.damage;
  p.survival.inventory.main[0] = null;
  assert.equal(sim.vehicles.hanging.h.interact(f.frame, stack).action, "insert");
  const seen = new MapStore();
  for (let t = 0; t < 60; t++) { sim.tick(); for (const player of [p, b]) { const mine = (player.itemsOut ?? []).filter((m) => m.type === "mapData"); player.itemsOut = null; if (player === b) for (const m of mine) applyMapMessage(m, seen); } }
  const data = seen.get(id);
  assert.ok(data, "Bea, who holds nothing, receives the framed map");
  assert.equal(data.scale, 0);
  // The wire carries no ids: the client keys the icon list icon-<i>. One icon, the frame marker (type 1), and nothing for Alex or Bea.
  assert.equal(data.decorations.size, 1);
  assert.equal([...data.decorations.values()][0][0], 1);
});
test("a player in the Nether does not get the Overworld frame's map", () => {
  const f = frameFixture();
  mapStore.load(null);
  const stack = { id: ITEM_FILLED_MAP, count: 1, damage: 0 };
  f.sim.vehicles.hanging.h.interact(f.frame, stack);
  f.b.dimension = -1; // the dimension test of EntityTrackerEntry's list: the frame's world players only
  f.sim.maps.tickFrames(new Map());
  assert.equal(f.sim.maps.store.get(0).infos.has("Bea"), false);
});

// ---- saving, crafting, leaving, dimensions ----
test("map ids and data are saved with the server world and come back", () => {
  const { sim, p } = fixture();
  mapStore.load(null);
  give(p, ITEM_EMPTY_MAP, 2); sim.maps.useEmpty(p); sim.maps.useEmpty(p);
  const data = sim.maps.store.get(0); data.colors[100] = 33; data.colors[16383] = -5;
  const saved = JSON.parse(JSON.stringify(sim.save()));
  assert.equal(saved.maps.counter, 2);
  mapStore.load(null);
  const again = fixture({ saved });
  assert.equal(again.sim.maps.store.counter, 2);
  assert.deepEqual([again.sim.maps.store.get(0).colors[100], again.sim.maps.store.get(0).colors[16383], again.sim.maps.store.get(1).scale], [33, -5, 0]);
  mapStore.load(null);
  assert.equal(fixture().sim.save().maps, undefined); // a world with no maps saves no field
});
test("the server's crafting clones a map and zooms it out through the one id counter", () => {
  const { sim, p } = fixture();
  mapStore.load(null);
  give(p, ITEM_EMPTY_MAP, 1); sim.maps.useEmpty(p);
  const map = p.survival.inventory.main[0];
  const clone = mapsCraftingResult([map, { id: ITEM_EMPTY_MAP, count: 1, damage: 0 }, null, null], 2);
  assert.deepEqual([clone.id, clone.damage, clone.count], [ITEM_FILLED_MAP, map.damage, 2]); // RecipesMapCloning: the same id, two maps
  const paper = { id: 328, count: 1, damage: 0 }, cells = [paper, paper, paper, paper, map, paper, paper, paper, paper];
  const zoom = mapsCraftingResult(cells, 3);
  assert.equal(zoom.mapScaling, true);
  mapOnCreated(sim.maps.store, zoom); // SlotCrafting.onCrafting -> ItemMap.onCreated on the server
  assert.deepEqual([zoom.damage, sim.maps.store.get(zoom.damage).scale, sim.maps.store.get(zoom.damage).xCenter], [1, 1, sim.maps.store.get(map.damage).xCenter]);
});
test("a player who leaves gets a new MapInfo on the next login: the scale record comes first again", () => {
  const { sim, p, messages } = fixture();
  mapStore.load(null);
  give(p, ITEM_EMPTY_MAP, 1); sim.maps.useEmpty(p);
  for (let t = 0; t < 8; t++) sim.tick();
  messages();
  const id = p.survival.inventory.main[0].damage;
  assert.equal(sim.maps.store.get(id).infos.has("Alex"), true);
  const saved = sim.savePlayer(p);
  sim.removePlayer("a");
  assert.equal(sim.maps.store.get(id).infos.has("Alex"), false);
  sim.savedPlayers.set(key(1), saved);
  const q = sim.addPlayer("a2", "Alex", key(1));
  sim.tick();
  const first = (q.itemsOut ?? []).find((m) => m.type === "mapData");
  assert.deepEqual(first.maps[0], { id, b: [2, 0] });
});
test("positions are native: the End window's origin is added to the player and to the frame tile", () => {
  const { sim, p } = fixture();
  p.world = { originX: -100, originZ: -50, get: () => 0, getMeta: () => 0, isLoaded: () => false, height: 128 };
  p.dimension = 1; p.position.copy({ x: 10.5, y: 60, z: 20.5 });
  const rec = sim.maps.record(p);
  assert.deepEqual([rec.x, rec.z, rec.dimension, Math.round(rec.yaw)], [-89.5, -29.5, 1, 180]);
  mapStore.load(null);
  give(p, ITEM_EMPTY_MAP, 1); sim.maps.useEmpty(p);
  const data = sim.maps.store.get(0);
  assert.deepEqual([data.xCenter, data.zCenter, data.dimension], [-128, 0, 1]); // floor(-89.5 / 128 + 0.5) = -1, floor(-29.5 / 128 + 0.5) = 0
});
test("the Nether map keeps the native noSky pass: half radius, nothing from the Overworld, nothing for a data of another dimension", () => {
  const { sim, p, messages } = fixture();
  mapStore.load(null);
  const nether = sim.dimensions.ensureNether();
  p.world = nether.world; p.dimension = -1; p.position.copy({ x: 64.5, y: 70, z: 64.5 }); p.previous.copy(p.position);
  give(p, ITEM_EMPTY_MAP, 1); sim.maps.useEmpty(p);
  const data = sim.maps.store.get(0);
  assert.equal(data.dimension, -1);
  for (let t = 0; t < 200; t++) sim.maps.tick();
  messages();
  // updateMapData in a no-sky world: radius 128 / 2 = 64 / scale 1 -> a disc of 32 around the player's map cell (x 64 - 128 centre... centre 128: cell 64 - 63.5); every painted cell lies inside it
  const px = Math.trunc(Math.floor(64.5 - data.xCenter) / 1) + 64, pz = Math.trunc(Math.floor(64.5 - data.zCenter) / 1) + 64;
  let painted = 0;
  for (let i = 0; i < MAP_BYTES; i++) if (data.colors[i] !== 0) { painted++; const dx = (i % 128) - px, dz = Math.floor(i / 128) - pz; assert.ok(dx * dx + dz * dz < 64 * 64, "inside the half radius"); }
  assert.ok(painted > 0, "the Nether is painted");
  // the same map held in the Overworld changes nothing (ItemMap.updateMapData tests the dimension)
  const before = data.colors.slice();
  p.world = sim.dimensions.overworld; p.dimension = 0;
  for (let t = 0; t < 40; t++) sim.maps.tick();
  assert.deepEqual([...data.colors], [...before]);
});
