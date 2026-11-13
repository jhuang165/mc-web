// Batch 60 (mpcontainers2): hoppers, dispensers, lit furnaces, trapped chests and chest descriptions on the dedicated simulation (no sockets).
import test from "node:test";
import assert from "node:assert/strict";
import { World, WATER } from "./world.js";
import { Survival } from "./survival.js";
import { makeStack } from "./inventory.js";
import { newChest } from "./chest.js";
import { newHopperTile } from "./hopper.js";
import { lightEmission } from "./lighting.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { DedicatedClient } from "./multiplayer/client.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { buildWindow, wireClicks, applyWindow, inventoryWire, litFurnaceData, dispenserAux } from "./multiplayer/client-containers.js";
import { applyTiles } from "./tile-sync.js";

globalThis.WebSocket ??= { OPEN: 1 };
const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const hot = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function fixture(options = {}) {
  const world = new World("dedicated-test");
  for (let x = 58; x <= 70; x++) for (let z = 58; z <= 70; z++) for (let y = 9; y <= 22; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return new DedicatedSimulation({}, { world, mobs: false, ...options });
}
const joined = (s, name = "Alice", n = 1) => { const p = s.addPlayer(name.toLowerCase(), name, key(n)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); return p; };
function session(s, p) {
  const sent = [], client = new DedicatedClient(), survival = new Survival({}, "creative"), seen = [];
  client.socket = { readyState: WebSocket.OPEN, bufferedAmount: 0, send: t => sent.push(JSON.parse(t)) };
  const st = { client, survival, sent, seen, win: null };
  st.deliver = () => {
    for (const m of sent.splice(0)) {
      if (m.type === "clickWindow") s.clickWindow(p.id, m); else if (m.type === "windowInventory") s.windowInventory(p.id, m);
      else if (m.type === "confirmTransaction") s.confirmTransaction(p.id, m); else if (m.type === "closeWindow") s.closeWindow(p.id);
    }
  };
  st.pump = () => {
    for (const m of (p.windowOut ?? []).splice(0)) {
      seen.push(m);
      if (m.type === "openWindow") {
        const built = buildWindow(m, { survival, world: s.world });
        wireClicks(built.container, client, m.windowId);
        st.win = { ...built, windowId: m.windowId, survival, client };
        client.windowInventory(m.windowId, inventoryWire(survival.inventory));
      } else if (st.win) applyWindow(m, st.win);
    }
  };
  return st;
}
const openAt = (s, p, st) => { s.input(p.id, hot()); s.queueEdit(p.id, { place: true }); const t = s.tick(); st.pump(); st.deliver(); st.pump(); return t; };
const ticks = (s, p, st, n) => { for (let i = 0; i < n; i++) { s.tick(); st.pump(); st.deliver(); st.pump(); } };

test("a hopper pulls from the chest above and pushes into the chest below every 8 ticks; an open window sees each item arrive", () => {
  const s = fixture(), p = joined(s), st = session(s, p);
  s.world.set(64, 11, 62, 41); s.world.set(63, 11, 62, 133, true, 5); s.world.set(63, 12, 62, 41); // chest, hopper beside it facing east (into the chest), source chest above the hopper
  s.tiles.chests["63,12,62"] = newChest(); s.tiles.chests["63,12,62"].items[0] = makeStack(4, 3);
  s.tiles.hoppers["63,11,62"] = newHopperTile();
  openAt(s, p, st); // the window on the lower chest
  assert.equal(st.win.kind, "chest");
  const hopper = s.tiles.hoppers["63,11,62"], lower = s.tiles.chests["64,11,62"], upper = s.tiles.chests["63,12,62"];
  st.seen.length = 0;
  assert.equal(hopper.items[0]?.count, 1, "the open tick already pulled one cobblestone"); assert.equal(upper.items[0].count, 2); assert.equal(hopper.cooldown, 8, "cooldown 8 after the transfer");
  const log = [];
  for (let i = 0; i < 40; i++) { s.tick(); st.pump(); log.push([i, lower.items[0]?.count ?? 0, upper.items[0]?.count ?? 0]); }
  assert.equal(lower.items[0].count, 3, "all three arrive");
  const firstPush = log.find(l => l[1] === 1)[0], secondPush = log.find(l => l[1] === 2)[0];
  assert.equal(secondPush - firstPush, 8, "one transfer per 8 ticks");
  assert.ok(st.seen.filter(m => m.type === "setSlot" && m.slot === 0 && m.item?.id === 4).length >= 3, "the window gets a setSlot for each arrival");
  assert.equal(st.win.container.slots[0].stack.count, 3, "the client's copy follows");
});

test("a hopper picks up an item entity above it and power switches the hopper off", () => {
  const s = fixture(), p = joined(s);
  s.world.set(64, 11, 62, 133, true, 0); s.tiles.hoppers["64,11,62"] = newHopperTile();
  s.items.spawn(makeStack(4, 2), 64.5, 12.1, 62.5, { motion: [0, 0, 0] });
  s.tick();
  assert.equal(s.tiles.hoppers["64,11,62"].items[0]?.count, 2);
  assert.equal(s.items.items.filter(e => !e.dead).length, 0);
  s.world.set(63, 11, 62, 123); // redstone block beside it: metadata bit 8 (disabled)
  s.tick();
  assert.equal(s.world.getMeta(64, 11, 62) & 8, 8);
});

test("a dispenser fires on redstone power: an item entity flies and S28 1000 and 2000 reach players in range", () => {
  const s = fixture(), p = joined(s);
  s.world.set(64, 11, 62, 115); // onBlockAdded settles the default facing, south (3)
  s.tiles.dispensers["64,11,62"] = { items: [makeStack(4, 2), null, null, null, null, null, null, null, null] };
  s.world.set(65, 11, 62, 123); // redstone block beside it
  const aux = [];
  for (let i = 0; i < 8; i++) { s.tick(); for (const m of p.itemsOut ?? []) if (m.type === "aux") aux.push(...m.events); p.itemsOut = null; }
  assert.equal(s.tiles.dispensers["64,11,62"].items[0].count, 1);
  const live = s.items.items.filter(e => !e.dead);
  assert.equal(live.length, 1); assert.equal(live[0].stack.id, 4);
  assert.deepEqual(aux.map(e => e.id).sort(), [1000, 2000]);
  const smoke = aux.find(e => e.id === 2000); assert.equal(smoke.data, 1 + 0 + (1 + 1) * 3); // facing south: dx 0, dz +1 -> data 7
  assert.deepEqual([aux[0].x, aux[0].y, aux[0].z], [64, 11, 62]);
});

test("a dropper's effects go only to players within 64 blocks; a boat dispense with no vehicle track leaves the stack (b61: arrows now fly, see mpdispense-b61.test.js)", () => {
  const s = fixture(), p = joined(s), far = joined(s, "Bob", 2);
  far.position.copy({ x: 0.5, y: 10, z: 64.5 });
  s.dispense.vehicles = null; // b61 lead: the vehicle track is wired in the simulation; drop it to keep this test's fallback
  s.world.set(70, 11, 62, 115, true, 2);
  s.tiles.dispensers["70,11,62"] = { items: [makeStack(495, 4), null, null, null, null, null, null, null, null] }; // boats onto water in front: the vehicle track's hook is absent
  s.world.set(69, 11, 62, WATER); // the dispenser settles facing west (x = 71 is the world's solid edge), so the water goes there
  s.world.set(70, 11, 63, 123);
  for (let i = 0; i < 8; i++) s.tick();
  assert.equal(s.tiles.dispensers["70,11,62"].items[0].count, 4, "unsupported dispense puts the stack back");
  assert.equal((p.itemsOut ?? []).filter(m => m.type === "aux").length, 0);
  s.tiles.dispensers["70,11,62"].items[0] = makeStack(4, 1);
  s.world.set(70, 11, 63, 0); for (let i = 0; i < 4; i++) s.tick(); s.world.set(70, 11, 63, 123); p.itemsOut = null;
  for (let i = 0; i < 8; i++) s.tick();
  assert.ok((p.itemsOut ?? []).some(m => m.type === "aux")); assert.equal((far.itemsOut ?? []).filter(m => m.type === "aux").length, 0);
});

test("a lit furnace flips its cell, glows with light 13 and reaches clients as contFurnaceLit", () => {
  const s = fixture(), p = joined(s);
  s.world.set(64, 11, 62, 14);
  const f = s.tiles.furnace("64,11,62"); f.items[0] = makeStack(12, 1); f.items[1] = makeStack(4, 1);
  assert.equal(s.light.blockAt(64, 11, 62), 0);
  const t1 = s.tick();
  assert.ok(f.burn > 0);
  assert.deepEqual(t1.contFurnaceLit, ["64,11,62"]);
  assert.ok(t1.changes.some(c => c[0] === 64 && c[1] === 11 && c[2] === 62), "the cell is resent like the native 61 -> 62 swap");
  assert.equal(s.light.blockAt(64, 11, 62), lightEmission(14, true));
  assert.deepEqual(litFurnaceData(t1.contFurnaceLit), { "64,11,62": { lit: true } });
  f.burn = 1; f.items[0] = null; // runs out
  s.tick(); const t3 = s.tick();
  assert.deepEqual(t3.contFurnaceLit ?? [], []);
  assert.equal(s.light.blockAt(64, 11, 62), 0);
  assert.equal(s.tick().contFurnaceLit, undefined, "nothing is sent once the empty set went out");
});

test("taking a stack from a furnace output calls onFurnaceTake and spawns the smelting experience", () => {
  const s = fixture({ gameMode: "survival" }), p = joined(s), st = session(s, p), took = [];
  s.containers.onFurnaceTake = (pl, stack, amount) => took.push([pl.name, stack.id, amount]);
  s.world.set(64, 11, 62, 14);
  s.tiles.furnace("64,11,62").items[2] = makeStack(367, 2);
  openAt(s, p, st);
  st.win.container.click(2, 0, 0); st.deliver(); st.pump();
  assert.deepEqual(took, [["Alice", 367, 2]]);
  assert.equal(s.serverItems.xp.orbs.reduce((n, o) => n + o.value, 0), 2);
});

test("a trapped chest gives power while viewed and the neighbours are told (lamp lights, then goes out)", () => {
  const s = fixture(), p = joined(s), st = session(s, p);
  s.world.set(64, 11, 62, 162); s.world.set(64, 10, 62, 121); // trapped chest, a redstone lamp beneath it (strong power downward)
  assert.equal(s.world.get(64, 10, 62), 121);
  openAt(s, p, st);
  assert.equal(s.tiles.chests["64,11,62"].users, 1);
  for (let i = 0; i < 6; i++) s.tick();
  assert.equal(s.world.get(64, 10, 62), 122, "lit lamp");
  st.client.closeWindow(); st.deliver();
  for (let i = 0; i < 8; i++) s.tick();
  assert.equal(s.world.get(64, 10, 62), 121, "unlit again (the lamp turns off after its 4-tick delay)");
});

test("chest blocks are described with their facing: placement tick, snapshot, and the replica draws a record before any block action", () => {
  const s = fixture(), p = joined(s);
  s.world.set(64, 11, 62, 41); s.world.set(66, 11, 62, 163);
  const t = s.tick();
  const mine = t.tiles.filter(x => x.kind === "contChest");
  assert.ok(mine.some(x => x.x === 64 && Number.isInteger(x.facing)), "the chest's facing rides in tiles");
  assert.ok(mine.some(x => x.x === 66 && x.ender));
  const snap = s.snapshot();
  assert.ok(snap.contTiles.some(x => x.x === 64 && x.facing >= 2) && snap.contTiles.some(x => x.ender));
  const client = new Survival({}, "creative"), cw = new World("dedicated-test");
  cw.put(64, 11, 62, 41, 0, false); cw.put(66, 11, 62, 163, 0, false);
  assert.equal(applyTiles(snap.contTiles, { world: cw, chests: client.chests, enders: client.enderTiles }), 2);
  assert.equal(client.chests["64,11,62"].facing, s.tiles.chests["64,11,62"].facing);
  assert.ok(client.enderTiles["66,11,62"]);
  assert.equal(applyTiles([{ kind: "contChest", x: 1, y: 1, z: 1, facing: 9 }], { world: cw, chests: client.chests, enders: client.enderTiles }), 0);
});

test("dispenserAux: click and bow sounds at the block corner, ten smoke puffs on the named face", () => {
  const plays = [], puffs = []; let seed = 12345;
  const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const fx = { play: (...a) => plays.push(a), smoke: (...a) => puffs.push(a), random };
  assert.equal(dispenserAux({ id: 1000, x: 3, y: 4, z: 5, data: 0 }, fx), true);
  dispenserAux({ id: 1001, x: 3, y: 4, z: 5, data: 0 }, fx); dispenserAux({ id: 1002, x: 3, y: 4, z: 5, data: 0 }, fx);
  assert.deepEqual(plays, [["random.click", 3, 4, 5, 1, 1], ["random.click", 3, 4, 5, 1, 1.2], ["random.bow", 3, 4, 5, 1, 1.2]]);
  dispenserAux({ id: 2000, x: 10, y: 20, z: 30, data: 2 + 0 * 3 + 0 }, fx); // dx +1, dz -1
  assert.equal(puffs.length, 10);
  for (const [px, py, pz, vx, vy, vz] of puffs) { assert.ok(px > 10.9 && px < 12.2); assert.ok(py > 20.2 && py < 20.8); assert.ok(pz > 29.5 && pz < 30.8); assert.ok(vx > 0 && vz < 0 && vy < 0.03); }
  assert.equal(dispenserAux({ id: 1004, x: 0, y: 0, z: 0, data: 0 }, fx), false);
});
