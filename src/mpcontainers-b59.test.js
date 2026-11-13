// Batch 59 (mpcontainers): container windows over the dedicated simulation, with no sockets. The client side (client-containers.js) runs against a
// second Survival; its sends are delivered to the simulation the way server/server.js dispatches them.
import test from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { Survival } from "./survival.js";
import { makeStack } from "./inventory.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { DedicatedClient } from "./multiplayer/client.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { buildWindow, wireClicks, applyWindow, applyBlockActions, inventoryWire } from "./multiplayer/client-containers.js";

globalThis.WebSocket ??= { OPEN: 1 };
const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const hot = (extra = {}) => ({ type: "input", controls: { ...IDLE_INPUT, ...extra }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function fixture() {
  const world = new World("dedicated-test");
  for (let x = 58; x <= 70; x++) for (let z = 58; z <= 70; z++) for (let y = 9; y <= 22; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return new DedicatedSimulation({}, { world });
}
const joined = (s, name = "Alice", n = 1) => { const p = s.addPlayer(name.toLowerCase(), name, key(n)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); return p; };
// One connected client: opens windows from the server's windowOut and delivers its own sends.
function session(s, p) {
  const sent = [], client = new DedicatedClient(), survival = new Survival({}, "creative"), seen = [];
  client.socket = { readyState: WebSocket.OPEN, bufferedAmount: 0, send: t => sent.push(JSON.parse(t)) };
  const st = { client, survival, sent, seen, win: null };
  st.deliver = () => {
    for (const m of sent.splice(0)) {
      if (m.type === "clickWindow") s.clickWindow(p.id, m);
      else if (m.type === "windowInventory") s.windowInventory(p.id, m);
      else if (m.type === "confirmTransaction") s.confirmTransaction(p.id, m);
      else if (m.type === "closeWindow") s.closeWindow(p.id);
    }
  };
  st.pump = () => {
    for (const m of (p.windowOut ?? []).splice(0)) {
      seen.push(m);
      if (m.type === "openWindow") {
        const built = buildWindow(m, { survival, world: s.world });
        assert.ok(built, "client builds the window");
        wireClicks(built.container, client, m.windowId);
        st.win = { ...built, windowId: m.windowId, survival, client };
        client.windowInventory(m.windowId, inventoryWire(survival.inventory));
      } else if (st.win) applyWindow(m, st.win);
    }
  };
  return st;
}
function open(s, p, st, x, y, z) {
  s.input(p.id, hot()); s.queueEdit(p.id, { place: true }); s.tick();
  st.pump(); st.deliver(); st.pump();
}
const tick = (s, p, st) => { s.tick(); st.pump(); st.deliver(); st.pump(); };
const chestAt = (s, x = 64, y = 11, z = 62, block = 41) => { s.world.set(x, y, z, block); };

test("right-click opens a chest window; server runs the click, confirms it and the contents persist", () => {
  const s = fixture(), p = joined(s), st = session(s, p);
  st.survival.inventory.main[0] = makeStack(4, 10);
  chestAt(s);
  open(s, p, st);
  const [opened, items] = st.seen;
  assert.equal(opened.type, "openWindow"); assert.equal(opened.kind, "chest"); assert.equal(opened.size, 27 + 36); assert.equal(opened.title, "Chest");
  assert.equal(items.type, "windowItems"); assert.equal(items.slots[27 + 27]?.id, 4, "hotbar slot 0 reaches the server inventory");
  // pick up the hotbar stack and drop it in chest slot 0
  const c = st.win.container;
  c.click(27 + 27, 0, 0); c.click(0, 0, 0);
  st.deliver(); st.pump();
  assert.equal(st.seen.filter(m => m.type === "confirmTransaction").every(m => m.accepted), true);
  const chest = s.tiles.chests["64,11,62"];
  assert.deepEqual([chest.items[0].id, chest.items[0].count], [4, 10]);
  assert.equal(p.survival.inventory.main[0], null);
  // closing: the lid users drop and the server inventory is mirrored from the client again
  st.client.closeWindow(); st.deliver();
  assert.equal(p.window, null);
  assert.equal(chest.users, 0);
});

test("a click the client predicted wrongly is refused with S32 false and the window is resent", () => {
  const s = fixture(), p = joined(s), st = session(s, p);
  chestAt(s);
  s.tiles.chests["64,11,62"] = undefined; delete s.tiles.chests["64,11,62"];
  open(s, p, st);
  st.seen.length = 0;
  // the client claims it took a stack from an empty slot
  st.client.clickWindow(st.win.windowId, 0, 0, 0, 1, { id: 4, count: 5, damage: 0 }); st.deliver(); st.pump();
  const confirm = st.seen.find(m => m.type === "confirmTransaction");
  assert.equal(confirm.accepted, false);
  assert.ok(st.seen.some(m => m.type === "windowItems"));
  assert.equal(p.survival.inventory.cursor, null);
  // while the refusal is unacknowledged further clicks are ignored; the client's C0F (sent by applyWindow) releases it
  st.deliver();
  assert.equal(p.window.pending, 0);
});

test("double chest opens as Large Chest with 54 slots and other chests are refused under a solid block", () => {
  const s = fixture(), p = joined(s), st = session(s, p);
  chestAt(s, 64, 11, 62); chestAt(s, 63, 11, 62);
  open(s, p, st);
  assert.equal(st.seen[0].title, "Large Chest"); assert.equal(st.seen[0].size, 54 + 36);
  st.client.closeWindow(); st.deliver();
  s.world.set(64, 12, 62, 1);
  st.seen.length = 0; open(s, p, st);
  assert.equal(st.seen.length, 0, "a normal cube above blocks the lid");
});

test("lid counts reach every player as block actions (S24) and fall back on close", () => {
  const s = fixture(), p = joined(s), st = session(s, p);
  chestAt(s);
  open(s, p, st);
  const t1 = s.tick();
  assert.deepEqual(t1.blockActions?.map(a => [a.key, a.users, a.ender]), [["64,11,62", 1, false]]);
  const watcher = new Survival({}, "creative");
  applyBlockActions(t1.blockActions, watcher); assert.equal(watcher.chests["64,11,62"].users, 1);
  st.client.closeWindow(); st.deliver();
  const t2 = s.tick();
  assert.equal(t2.blockActions[0].users, 0);
});

test("furnace: S31 properties follow the server smelting, items come back by S2F", () => {
  const s = fixture(), p = joined(s), st = session(s, p);
  s.world.set(64, 11, 62, 14);
  open(s, p, st);
  assert.equal(st.seen[0].kind, "furnace");
  const f = s.tiles.furnaces["64,11,62"];
  f.items[0] = makeStack(12, 1); f.items[1] = makeStack(4, 1); // sand and a 300-tick fuel (survival.js FUELS)
  tick(s, p, st);
  tick(s, p, st);
  assert.ok(f.burn > 0);
  assert.equal(st.survival.furnace("64,11,62").burn, f.burn, "client furnace mirrors the server's burn time");
  assert.ok(st.seen.some(m => m.type === "windowProperty" && m.id === 1));
  assert.equal(st.win.container.slots[0].stack?.id, 12);
});

test("dispenser, hopper, brewing stand and ender chest open; an ender chest is the player's own inventory", () => {
  for (const [block, kind, size] of [[115, "dispenser", 9 + 36], [132, "dispenser", 9 + 36], [133, "hopper", 5 + 36], [134, "brewing", 4 + 36], [163, "chest", 27 + 36]]) {
    const s = fixture(), p = joined(s), st = session(s, p);
    s.world.set(64, 11, 62, block);
    open(s, p, st);
    assert.equal(st.seen[0].kind, kind, String(block)); assert.equal(st.seen[0].size, size, String(block));
  }
  const s = fixture(), a = joined(s), b = joined(s, "Bob", 2), sa = session(s, a), sb = session(s, b);
  b.position.x += 2;
  s.world.set(64, 11, 62, 163);
  open(s, a, sa);
  const c = sa.win.container; sa.survival.inventory.cursor = null;
  a.survival.inventory.main[0] = makeStack(4, 3); // the client mirror
  sa.survival.inventory.main[0] = makeStack(4, 3);
  c.click(27 + 27, 0, 0); c.click(0, 0, 0); sa.deliver();
  assert.equal(a.survival.enderItems[0]?.id, 4);
  assert.equal(b.survival.enderItems[0], null, "ender contents are per player");
  assert.equal(sb.seen.length, 0);
});

test("shift-click and a container block that is broken: contents spill and the window closes", () => {
  const s = fixture(), p = joined(s), st = session(s, p);
  st.survival.inventory.main[0] = makeStack(4, 7);
  chestAt(s);
  open(s, p, st);
  st.win.container.click(27 + 27, 0, 1); // shift-click the hotbar stack into the chest
  st.deliver();
  const chest = s.tiles.chests["64,11,62"];
  assert.equal(chest.items[0]?.count, 7);
  s.world.set(64, 11, 62, 0);
  s.tick();
  assert.equal(p.window, null);
  assert.equal(s.tiles.chests["64,11,62"], undefined);
  assert.ok(s.items.items.reduce((n, e) => n + e.stack.count, 0) >= 7);
  assert.ok(p.windowOut?.some(m => m.type === "windowClose") || st.seen.some(m => m.type === "windowClose"));
});

test("the hotbar mirror is ignored while a window is open and a far-away player is closed", () => {
  const s = fixture(), p = joined(s), st = session(s, p);
  st.survival.inventory.main[0] = makeStack(4, 7);
  chestAt(s);
  open(s, p, st);
  s.input(p.id, { ...hot(), hotbar: [{ id: 1 }, null, null, null, null, null, null, null, null] });
  assert.equal(p.survival.inventory.main[0].id, 4);
  p.position.x += 20;
  s.tick();
  assert.equal(p.window, null);
});
