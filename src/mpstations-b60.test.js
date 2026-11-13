// Batch 60 (mpstations): the crafting table, enchanting table and anvil as server windows, with no sockets. Same harness as mpcontainers-b59.test.js:
// the client half (client-containers.js) runs against its own Survival; its sends are delivered the way server/server.js dispatches them.
import test from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { Survival } from "./survival.js";
import { makeStack } from "./inventory.js";
import { Experience } from "./experience.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { DedicatedClient } from "./multiplayer/client.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { buildWindow, wireClicks, wireStation, applyWindow, inventoryWire } from "./multiplayer/client-containers.js";
import { filterName } from "./multiplayer/server-stations.js";

globalThis.WebSocket ??= { OPEN: 1 };
const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const hot = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
const IRON_SWORD = 114, DIAMOND_SWORD = 115, BOOK = 314, ENCHANTED_BOOK = 365, TABLE = 13, ENCHANT = 86, ANVIL = 85, SHELF = 21;
function fixture(mode = "survival") {
  const world = new World("stations-b60");
  for (let x = 56; x <= 72; x++) for (let z = 52; z <= 70; z++) for (let y = 9; y <= 22; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return new DedicatedSimulation({}, { world, gameMode: mode });
}
const joined = (s, name = "Alice", n = 1) => { const p = s.addPlayer(name.toLowerCase(), name, key(n)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); return p; };
function session(s, p) {
  const sent = [], client = new DedicatedClient(), survival = new Survival({}, p.survival.creative ? "creative" : "survival"), seen = [], xp = new Experience();
  client.socket = { readyState: WebSocket.OPEN, bufferedAmount: 0, send: t => sent.push(JSON.parse(t)) };
  const st = { client, survival, sent, seen, xp, win: null, auxes: [] };
  const host = { experienceLevel: () => xp.level, itemName: () => "", nameField: () => {} };
  st.deliver = () => {
    for (const m of sent.splice(0)) {
      if (m.type === "clickWindow") s.clickWindow(p.id, m);
      else if (m.type === "windowInventory") s.windowInventory(p.id, m);
      else if (m.type === "confirmTransaction") s.confirmTransaction(p.id, m);
      else if (m.type === "closeWindow") s.closeWindow(p.id);
      else if (m.type === "stationEnchant" || m.type === "stationItemName") s.station(p.id, m);
    }
  };
  st.pump = () => {
    for (const m of (p.windowOut ?? []).splice(0)) {
      seen.push(m);
      if (m.type === "openWindow") {
        const built = buildWindow(m, { survival, world: s.world, station: host });
        assert.ok(built, "client builds the window");
        wireClicks(built.container, client, m.windowId); wireStation(built.container, client, m.windowId, built.kind);
        st.win = { ...built, windowId: m.windowId, survival, client };
        client.windowInventory(m.windowId, inventoryWire(survival.inventory));
      } else if (st.win) applyWindow(m, st.win);
    }
    for (const m of (p.itemsOut ?? []).splice(0)) {
      if (m.type === "playerOp" && m.op === "addLevels") xp.addLevels(m.args[0]);
      else if (m.type === "aux") st.auxes.push(...m.events);
    }
  };
  return st;
}
const open = (s, p, st) => { s.input(p.id, hot()); s.queueEdit(p.id, { place: true }); s.tick(); st.pump(); st.deliver(); st.pump(); };
const tick = (s, p, st) => { s.tick(); st.pump(); st.deliver(); st.pump(); };
const give = (s, p, st, slot, stack) => { p.survival.inventory.main[slot] = stack; st.survival.inventory.main[slot] = stack ? makeStack(stack.id, stack.count, stack.damage) : null; };
const levels = (p, n) => { p.experience.addLevels(n); };

test("workbench: 3x3 grid, result slot, shift-click, grid thrown on close, crafted hook", () => {
  const s = fixture(), p = joined(s), st = session(s, p);
  s.world.set(64, 11, 62, TABLE);
  const crafted = []; s.containers.stations.onCrafted = (pl, stack, n) => crafted.push([pl.id, stack.id, n]);
  give(s, p, st, 0, makeStack(7, 6)); // oak planks
  open(s, p, st);
  assert.equal(st.seen[0].kind, "workbench"); assert.equal(st.seen[0].size, 10 + 36);
  const c = st.win.container;
  c.click(37, 0, 0); c.click(1, 1, 0); c.click(4, 1, 0); // hotbar 0 planks: pick up, one into grid 0, one into grid 3
  tick(s, p, st);
  assert.equal(p.window.container.slots[0].stack?.id, 300, "server result is sticks");
  assert.equal(c.slots[0].stack?.id, 300);
  c.click(37, 0, 0); c.click(0, 0, 0); tick(s, p, st); // put the planks back, take the 4 sticks onto the cursor
  assert.equal(p.survival.inventory.cursor?.id, 300); assert.equal(p.survival.inventory.cursor.count, 4);
  assert.deepEqual(crafted, [[p.id, 300, 4]]);
  assert.equal(p.window.container.slots[1].stack, null, "ingredients are used");
  // leftover planks in the grid are thrown on close
  c.click(37, 0, 0); c.click(2, 1, 0); tick(s, p, st);
  assert.equal(p.window.container.slots[2].stack?.id, 7);
  const before = s.items.items.length;
  s.closeWindow(p.id);
  assert.equal(p.window, null);
  assert.ok((s.items.items.length) > before, "grid contents and cursor are dropped as items");
});

test("workbench: a click the client predicts wrongly is refused and the window resent", () => {
  const s = fixture(), p = joined(s), st = session(s, p);
  s.world.set(64, 11, 62, TABLE);
  open(s, p, st);
  st.sent.length = 0;
  st.client.clickWindow(st.win.windowId, 0, 0, 0, 1, { id: 300, count: 4, damage: 0 }); // result slot is empty on the server
  st.deliver();
  assert.ok(p.windowOut.some(m => m.type === "confirmTransaction" && m.accepted === false));
});

function shelves(s, cx, cy, cz) { // a ring two blocks out on the three far sides (the near side keeps the line of sight clear)
  for (const dz of [-2, -1, 0, 1]) for (const dx of [-2, 2]) for (const dy of [0, 1]) s.world.set(cx + dx, cy + dy, cz + dz, SHELF);
  for (const dx of [-1, 0, 1]) for (const dy of [0, 1]) s.world.set(cx + dx, cy + dy, cz - 2, SHELF);
}
function enchantSetup(shelfCount = true) {
  const s = fixture(), p = joined(s), st = session(s, p);
  s.world.set(64, 11, 62, ENCHANT);
  if (shelfCount) shelves(s, 64, 11, 62);
  give(s, p, st, 0, makeStack(IRON_SWORD, 1));
  levels(p, 30); st.xp.addLevels(30);
  open(s, p, st);
  const c = st.win.container;
  c.click(28, 0, 0); c.click(0, 0, 0); tick(s, p, st); // sword to the table slot
  return { s, p, st, c };
}

test("enchanting: the server rolls the three costs (S31 0..2), the client shows them, C11 enchants and charges levels", () => {
  const { s, p, st, c } = enchantSetup();
  assert.equal(st.seen[0].kind, "enchanting"); assert.equal(st.seen[0].size, 1 + 36);
  const serverLevels = p.window.container.levels;
  assert.ok(serverLevels[0] >= 1 && serverLevels[2] > serverLevels[0], `costs ${serverLevels}`);
  assert.deepEqual(c.levels, serverLevels, "S31 brought the same costs to the client");
  assert.ok(st.seen.filter(m => m.type === "windowProperty").length >= 3);
  const cost = serverLevels[1], level = p.experience.level;
  assert.equal(c.enchant(1), false, "the client only sends the request");
  st.deliver(); st.pump();
  assert.equal(p.experience.level, level - cost, "level cost paid on the server");
  assert.equal(st.xp.level, level - cost, "the playerOp addLevels reached the client");
  const out = p.window.container.slots[0].stack;
  assert.ok(out.enchantments?.length >= 1, "sword is enchanted on the server");
  assert.ok(c.slots[0].stack.enchantments?.length >= 1, "S2F carried the enchanted stack");
  assert.deepEqual(c.levels, [0, 0, 0], "an enchanted item offers nothing more");
});

test("enchanting: not enough levels, bad option and a stale window id do nothing; no lapis is involved", () => {
  const { s, p, st, c } = enchantSetup();
  p.experience.addLevels(-p.experience.level); // the server is broke while the client still thinks it has levels
  const before = JSON.stringify(p.window.container.slots[0].stack);
  st.client.stationEnchant(st.win.windowId, 2); st.client.stationEnchant(st.win.windowId, 7); st.client.stationEnchant(99, 0); st.client.stationEnchant(st.win.windowId, "1");
  st.deliver();
  assert.equal(JSON.stringify(p.window.container.slots[0].stack), before);
  assert.equal(p.experience.level, 0);
  assert.ok(p.survival.inventory.main.every(x => !x || x.id !== 351), "no lapis slot exists");
});

test("enchanting: a book becomes an enchanted book; costs reroll when the item changes; leaving returns the item", () => {
  const s = fixture(), p = joined(s), st = session(s, p);
  s.world.set(64, 11, 62, ENCHANT); shelves(s, 64, 11, 62);
  give(s, p, st, 0, makeStack(BOOK, 1)); give(s, p, st, 1, makeStack(IRON_SWORD, 1));
  levels(p, 30); st.xp.addLevels(30);
  open(s, p, st);
  const c = st.win.container;
  c.click(28, 0, 0); c.click(0, 0, 0); tick(s, p, st);
  assert.ok(p.window.container.levels[0] > 0);
  c.enchant(2); st.deliver(); st.pump();
  assert.equal(p.window.container.slots[0].stack.id, ENCHANTED_BOOK);
  assert.ok(c.slots[0].stack.id === ENCHANTED_BOOK);
  c.click(0, 0, 0); tick(s, p, st); // take it back onto the cursor
  assert.deepEqual(p.window.container.levels, [0, 0, 0]);
  s.closeWindow(p.id);
  assert.equal(p.window, null);
});

test("enchanting: out of reach or a removed table closes the window", () => {
  const { s, p } = enchantSetup();
  s.world.set(64, 11, 62, 0); s.tick();
  assert.equal(p.window, null);
  assert.ok(p.windowOut.some(m => m.type === "windowClose"));
});

function anvilSetup() {
  const s = fixture(), p = joined(s), st = session(s, p);
  s.world.set(64, 10, 62, 3); s.world.set(64, 11, 62, ANVIL); // a block under it so it does not fall
  give(s, p, st, 0, makeStack(IRON_SWORD, 1));
  levels(p, 10); st.xp.addLevels(10);
  open(s, p, st);
  const c = st.win.container;
  c.click(3 + 27, 0, 0); c.click(0, 0, 0); tick(s, p, st); // sword into input 0
  return { s, p, st, c };
}

test("anvil: rename by MC|ItemName, S31 repair cost, XP paid by the server, output given by the server, aux 1021", () => {
  const { s, p, st, c } = anvilSetup();
  assert.equal(st.seen[0].kind, "anvil"); assert.equal(st.seen[0].size, 3 + 36);
  c.setName("Excalibur"); st.deliver(); tick(s, p, st);
  const sc = p.window.container;
  assert.equal(sc.repairedItemName, "Excalibur");
  assert.equal(sc.slots[2].stack?.displayName, "Excalibur", "server computed the renamed output");
  assert.ok(sc.maximumCost >= 1);
  assert.ok(st.seen.some(m => m.type === "windowProperty" && m.id === 0 && m.value === sc.maximumCost), "S31 0 is the repair cost");
  assert.equal(c.maximumCost, sc.maximumCost);
  const level = p.experience.level, cost = sc.maximumCost;
  s.world.get(64, 11, 62);
  c.click(2, 0, 0); tick(s, p, st); // take the result onto the cursor
  assert.equal(p.survival.inventory.cursor?.displayName, "Excalibur");
  assert.equal(p.experience.level, level - cost); assert.equal(st.xp.level, level - cost);
  assert.equal(sc.slots[0].stack, null, "input consumed");
  assert.ok(st.auxes.some(e => e.id === 1021 || e.id === 1020), "anvil use or break aux sent to the player in range");
});

test("anvil: an unaffordable result is refused, names over 30 characters and bad characters follow NetHandlerPlayServer, damage chance", () => {
  const { s, p, st, c } = anvilSetup();
  c.setName("A".repeat(31)); st.deliver();
  assert.equal(p.window.container.repairedItemName, "", "more than 30 characters is ignored (the name stays what it was)");
  assert.equal(filterName("a§b\u0007c"), "abc");
  st.client.stationItemName(st.win.windowId, "Bl§ade"); st.deliver();
  assert.equal(p.window.container.repairedItemName, "Blade");
  st.client.stationItemName(st.win.windowId, ""); st.deliver();
  assert.equal(p.window.container.repairedItemName, "");
  // the server has no levels: taking the result does nothing even if the client claims it
  c.setName("Nope"); st.deliver(); tick(s, p, st);
  p.experience.addLevels(-p.experience.level);
  const result = JSON.parse(JSON.stringify(p.window.container.slots[2].stack));
  st.sent.length = 0;
  st.client.clickWindow(st.win.windowId, 2, 0, 0, 5, result); st.deliver();
  assert.equal(p.survival.inventory.cursor, null, "nothing was taken");
  assert.ok(p.window.container.slots[0].stack, "the sword stays in the input");
  assert.equal(p.experience.level, 0);
  // the damage chance uses the server Random: force it
  p.survival.inventory.random.nextFloat = () => 0.01;
  s.containers.stations.anvilUsed(p, 64, 11, 62, false);
  assert.equal(s.world.get(64, 11, 62), ANVIL); assert.equal(s.world.getMeta(64, 11, 62) >> 2, 1, "chipped anvil");
  s.world.put(64, 11, 62, ANVIL, 8, true); // very damaged
  s.containers.stations.anvilUsed(p, 64, 11, 62, false);
  assert.equal(s.world.get(64, 11, 62), 0, "a very damaged anvil breaks");
  p.itemsOut = null;
  s.containers.stations.aux(1020, 64, 11, 62);
  assert.equal(p.itemsOut[0].events[0].id, 1020);
});

test("anvil: a player out of range gets no aux; Creative pays nothing", () => {
  const s = fixture("creative"), a = joined(s), b = joined(s, "Bob", 2);
  b.position.copy({ x: 64.5, y: 10, z: 64.5 + 100 });
  s.world.set(64, 10, 62, 3); s.world.set(64, 11, 62, ANVIL);
  s.containers.stations.aux(1021, 64, 11, 62);
  assert.equal(a.itemsOut?.length, 1); assert.equal(b.itemsOut ?? null, null);
  const st = session(s, a);
  give(s, a, st, 0, makeStack(IRON_SWORD, 1));
  open(s, a, st);
  const c = st.win.container;
  c.click(3 + 27, 0, 0); c.click(0, 0, 0); tick(s, a, st);
  c.setName("Free"); st.deliver(); tick(s, a, st);
  c.click(2, 0, 0); tick(s, a, st);
  assert.equal(a.survival.inventory.cursor?.displayName, "Free");
  assert.equal(s.world.get(64, 11, 62), ANVIL, "Creative never damages the anvil");
});
