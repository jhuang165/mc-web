// Batch 92 portals92: mobs, items, orbs, carts and boats cross portals on the dedicated server (server-portal-travel.js). See .shared-memory/notes/portals92-b92-track.md.
import test from "node:test";
import assert from "node:assert/strict";
import { populationBlockMapperReady } from "./population-world.js";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { PORTAL } from "./nether-portal.js";

await populationBlockMapperReady;
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function flat() {
  const w = new World("portals92");
  for (let x = 40; x <= 110; x++) for (let z = 40; z <= 90; z++) for (let y = 9; y <= 30; y++) w.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  w.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return w;
}
function fixture() {
  const s = new DedicatedSimulation({}, { world: flat(), gameMode: "survival", mobs: false });
  const a = s.addPlayer("a", "Alice", key(1)); a.position.copy({ x: 45.5, y: 10, z: 45.5 }); a.previous.copy(a.position); s.input("a", input());
  s.dimensions.ensureNether();
  for (let i = 0; i < 20; i++) s.tick();
  return { s, n: s.dimensions.nether };
}
const frame = (w, x0, z0, y0) => { for (let y = y0; y < y0 + 4; y++) for (const dx of [0, 1]) w.put(x0 + dx, y, z0, PORTAL, 0, false); };
const run = (s, ticks) => { for (let i = 0; i < ticks; i++) s.tick(); };
// A player standing in the Nether keeps its tick running (the Nether only ticks with somebody in it); these tests walk the Nether through its own message instead.
const nether = (s, n) => s.dimensions.netherMessage({ tick: s.ticks, time: s.time }, n);

test("server: a pig in an Overworld portal reaches the Nether with a 300-tick cooldown, its name and health; the old one is gone", { timeout: 120000 }, () => {
  const { s, n } = fixture();
  frame(s.world, 64, 64, 10);
  const pig = s.mobs.mobs.create("pig", 64.9, 10, 64.5); pig.health = 7; pig.customName = "Piggy"; s.mobs.mobs.entities.push(pig);
  const before = n.mobs.mobs.entities.length;
  run(s, 3);
  assert.equal(s.mobs.mobs.entities.includes(pig), false, "left the Overworld list");
  assert.equal(s.mobs.tracker.entries.has(pig), false, "the Overworld tracker dropped its entry (S13)");
  const got = n.mobs.mobs.entities.filter((m) => m.customName === "Piggy");
  assert.equal(got.length, 1);
  assert.equal(n.mobs.mobs.entities.length, before + 1);
  const m = got[0];
  assert.equal(m.health, 7);
  assert.equal(m.customName, "Piggy");
  assert.ok(m.portalCooldown > 290 && m.portalCooldown <= 300, "PortalCooldown " + m.portalCooldown);
  assert.ok(m.x >= 24 && m.x <= 104 && m.z >= 24 && m.z <= 104, "placed inside the finite Nether");
});

test("server: the arrived mob does not travel back while its cooldown runs, even standing in the portal", { timeout: 120000 }, () => {
  const { s, n } = fixture();
  frame(s.world, 64, 64, 10);
  const pig = s.mobs.mobs.create("pig", 64.9, 10, 64.5); pig.customName = "Probe"; s.mobs.mobs.entities.push(pig);
  run(s, 3);
  const m = n.mobs.mobs.entities.find((x) => x.customName === "Probe");
  assert.ok(m);
  // stand the copy inside a Nether portal frame and walk the Nether again and again: the cooldown (300) holds it
  frame(n.world, Math.floor(m.x) - 1, Math.floor(m.z), Math.floor(m.y));
  m.x = Math.floor(m.x) - 0.1;
  for (let i = 0; i < 10; i++) s.dimensions.travel.step(-1);
  assert.ok(m.portalCooldown > 280, "still counting " + m.portalCooldown);
  assert.ok(n.mobs.mobs.entities.includes(m), "still in the Nether");
  assert.equal(s.mobs.mobs.entities.filter((x) => x.customName === "Probe").length, 0, "not back in the Overworld");
});

test("server: a leashed mob arrives unleashed and the lead drops as an item", { timeout: 120000 }, () => {
  const { s, n } = fixture();
  frame(s.world, 64, 64, 10);
  const cow = s.mobs.mobs.create("cow", 64.9, 10, 64.5); cow.customName = "Probe"; cow.leash = { holder: "player", holderId: "a" }; s.mobs.mobs.entities.push(cow);
  const before = n.items.items.length;
  run(s, 3);
  const m = n.mobs.mobs.entities.find((x) => x.customName === "Probe");
  assert.ok(m, "the cow arrived");
  assert.ok(!m.leash, "no lead on the copy");
  assert.equal(n.items.items.length, before + 1, "the lead item");
  assert.equal(n.items.items.at(-1).stack.id, 2020);
});

test("server: a mob a player rides or that rides another never starts the portal", { timeout: 120000 }, () => {
  const { s, n } = fixture();
  frame(s.world, 64, 64, 10);
  const pig = s.mobs.mobs.create("pig", 64.9, 10, 64.5); pig.customName = "Probe"; pig.rider = { player: true }; s.mobs.mobs.entities.push(pig);
  run(s, 6);
  assert.ok(s.mobs.mobs.entities.includes(pig), "a ridden pig stays");
  assert.equal(n.mobs.mobs.entities.filter((x) => x.customName === "Probe").length, 0);
});

test("server: a dropped item in a portal reaches the Nether with its stack, age and the cooldown; a new entity id", { timeout: 120000 }, () => {
  const { s, n } = fixture();
  frame(s.world, 64, 64, 10);
  const it = s.items.spawn({ id: 3, count: 9, damage: 0 }, 64.9, 10.3, 64.5, { delay: 0, motion: [0, 0, 0] });
  it.age = 120;
  const eid = it.eid;
  run(s, 2);
  const message = s.tick();
  assert.ok(!(message.items ?? []).some((r) => r.i === eid), "the item is not in the Overworld's next list: the client removes it");
  assert.equal(s.items.items.includes(it), false, "left the Overworld");
  const got = n.items.items.filter((x) => x.stack.id === 3 && x.stack.count === 9);
  assert.equal(got.length, 1);
  assert.ok(got[0].age >= 120, "age kept");
  assert.ok(got[0].portalCooldown > 290, "cooldown " + got[0].portalCooldown);
  assert.ok(got[0].eid && got[0].eid !== eid, "a new id in the destination");
});

test("server: an experience orb in a portal reaches the Nether's orbs", { timeout: 120000 }, () => {
  const { s, n } = fixture();
  frame(s.world, 64, 64, 10);
  s.serverItems.xp.spawn(3, { x: 64.9, y: 10.3, z: 64.5 });
  const o = s.serverItems.xp.orbs[0];
  assert.ok(o);
  const value = o.value;
  run(s, 3);
  assert.equal(s.serverItems.xp.orbs.includes(o), false, "left the Overworld");
  assert.equal(n.xp.orbs.length, 1);
  assert.equal(n.xp.orbs[0].value, value);
  assert.ok(n.xp.orbs[0].portalCooldown > 290, "cooldown");
});

test("server: a minecart and a boat in a portal reach the Nether's vehicles, the cart with its type; the boat's id is new", { timeout: 120000 }, () => {
  const { s, n } = fixture();
  frame(s.world, 62, 64, 10);
  frame(s.world, 68, 64, 10);
  const cart = s.vehicles.carts.spawnCart(0, { x: 62.9, y: 10, z: 64.5 });
  const boat = s.vehicles.boats.spawnBoat({ x: 68.9, y: 10, z: 64.5 });
  for (const v of [cart, boat]) { v.vx = v.vy = v.vz = 0; }
  run(s, 3);
  assert.equal(s.vehicles.carts.carts.includes(cart), false, "the cart left");
  assert.equal(s.vehicles.boats.carts.includes(boat), false, "the boat left");
  assert.equal(n.vehicles.carts.carts.length, 1);
  assert.equal(n.vehicles.boats.carts.length, 1);
  assert.equal(n.vehicles.carts.carts[0].type, 0);
  assert.ok(n.vehicles.carts.carts[0].portalCooldown > 290 && n.vehicles.boats.carts[0].portalCooldown > 290);
});

test("server: a mob in a Nether portal walks to the Overworld after the Nether's own tick", { timeout: 120000 }, () => {
  const { s, n } = fixture();
  frame(n.world, 64, 64, 60);
  const hog = n.mobs.mobs.create("pigman", 64.9, 60, 64.5); n.mobs.mobs.entities.push(hog);
  hog.health = 20;
  // the Nether ticks only while a player is in it: move the player there
  s.dimensions.arrive(s.players.get("a"), -1, { at: { x: 90, y: 62, z: 90 } });
  const before = s.mobs.mobs.entities.length;
  run(s, 4);
  assert.equal(n.mobs.mobs.entities.includes(hog), false, "left the Nether");
  assert.equal(s.mobs.mobs.entities.filter((m) => m.type === "pigman").length >= 1, true);
  assert.ok(s.mobs.mobs.entities.length >= before);
});

test("server: the Ender Dragon and a crystal are never walked", () => {
  const { s } = fixture();
  const t = s.dimensions.travel;
  frame(s.world, 64, 64, 10);
  const dragon = s.mobs.mobs.create("ender_dragon", 64.9, 10, 64.5); s.mobs.mobs.entities.push(dragon);
  const crystal = s.mobs.mobs.create("ender_crystal", 64.9, 10, 64.5); s.mobs.mobs.entities.push(crystal);
  for (let i = 0; i < 6; i++) t.step(0);
  assert.ok(s.mobs.mobs.entities.includes(dragon) && s.mobs.mobs.entities.includes(crystal));
});
