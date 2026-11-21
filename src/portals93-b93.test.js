// Batch 93 portals93: a lead and the non-NBT mob state across the dedicated server's portals (server-portal-travel.js). See .shared-memory/notes/portals93-b93-track.md.
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
  const w = new World("portals93");
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
const nether = (s, n) => s.dimensions.netherMessage({ tick: s.ticks, time: s.time }, n);
// Bob stands in the Nether, which makes it tick (and gives its mobs a view).
function bob(s, n, at) {
  const b = s.addPlayer("b", "Bob", key(2)); b.dimension = -1; b.world = n.world; b.position.copy(at); b.previous.copy(b.position); s.input("b", input());
  s.mobs.removePlayer("b"); n.mobs.addPlayer(b);
  return b;
}
// The Nether side has its own portal by the Overworld one, so the copy lands near the cell the Overworld mob was by (a knot there is within 10 blocks in both worlds).
// The lead items spawned in the Nether's item list (an item that lands in lava is gone by the time the list is read).
const spyLeads = (n) => { const seen = [], spawn = n.items.spawn.bind(n.items); n.items.spawn = (st, ...rest) => { if (st?.id === 2020) seen.push(st); return spawn(st, ...rest); }; return seen; };
function cross(s, n, mods, { netherPortal = true, direct = false } = {}) {
  frame(s.world, 64, 64, 10); if (netherPortal) frame(n.world, 64, 64, 10);
  if (netherPortal) for (let x = 58; x <= 70; x++) for (let z = 58; z <= 70; z++) for (let y = 9; y <= 14; y++) if (!(z === 64 && (x === 64 || x === 65) && y >= 10 && y <= 13)) n.world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  const cow = s.mobs.mobs.create("cow", 64.9, 10, 64.5); cow.customName = "Probe"; Object.assign(cow, mods); s.mobs.mobs.entities.push(cow);
  if (direct) for (let i = 0; i < 3; i++) s.dimensions.travel.step(0); // walk the portal without ticking the Overworld's mobs (the holder is not in the Overworld in these tests)
  else run(s, 3);
  return n.mobs.mobs.entities.find((x) => x.customName === "Probe");
}

test("server: a lead held by a fence knot comes back on the copy: the knot is made at the saved X/Y/Z of the new world and the lead holds", { timeout: 120000 }, () => {
  const { s, n } = fixture();
  bob(s, n, { x: 60.5, y: 10, z: 66.5 });
  const m = cross(s, n, { leash: { knot: { x: 66, y: 10, z: 64 } } });
  assert.deepEqual(m.leash, { knot: { x: 66, y: 10, z: 64 } }, "the record keeps the knot cell, as Leash X/Y/Z");
  const drops = n.items.items.length;
  assert.ok(Math.hypot(m.x - 66.5, m.z - 64.5) < 5, "landed by the knot " + m.x + " " + m.z);
  for (let i = 0; i < 3; i++) nether(s, n);
  assert.deepEqual(m.leash, { knot: { x: 66, y: 10, z: 64 } }, "still tied after its first updateLeashedState");
  assert.equal(n.items.items.length, drops, "no lead item");
  assert.deepEqual(n.mobs.mobs.leashKnots().map((k) => [k.x, k.y, k.z]), [[66, 10, 64]], "the knot exists in the Nether");
});

test("server: the saved knot cell is not scaled: out of the lead's 10 blocks the lead drops at the destination (the knot is still made), as natively", { timeout: 120000 }, () => {
  const { s, n } = fixture();
  bob(s, n, { x: 60.5, y: 10, z: 66.5 });
  const seen = spyLeads(n);
  const m = cross(s, n, { leash: { knot: { x: 66, y: 10, z: 64 } } }, { netherPortal: false }); // it lands by the generated Nether's own portal, far from the cell
  assert.ok(Math.hypot(m.x - 66.5, m.z - 64.5) > 10, "landed far from the cell");
  nether(s, n); // the drop event reaches the item list on the next mob pass
  assert.equal(m.leash, undefined);
  assert.equal(seen.length, 1, "the lead item");
  assert.equal(n.mobs.mobs.leashKnots().length, 1, "sw.bP made the knot before the distance test (probed: leads3-reference.json leadDimension knot)");
});

test("server: a player holder who is in the destination within reach keeps the lead; one who is not drops it", { timeout: 120000 }, () => {
  const near = fixture();
  bob(near.s, near.n, { x: 60.5, y: 10, z: 66.5 });
  const m = cross(near.s, near.n, { leash: { holder: "player", holderId: "b" } }, { direct: true });
  assert.deepEqual(m.leash, { holder: "player", holderId: "b" }, "arrived tied to Bob");
  const far = fixture();
  bob(far.s, far.n, { x: 100.5, y: 10, z: 66.5 });
  const seen = spyLeads(far.n);
  const f = cross(far.s, far.n, { leash: { holder: "player", holderId: "b" } }, { direct: true });
  assert.equal(f.leash, undefined, "Bob is more than 10 blocks away");
  assert.equal(seen.length, 1, "the lead item");
});

test("server: the copy starts over the state writeToNBT does not carry; saved state stays", { timeout: 120000 }, () => {
  const { s, n } = fixture();
  const m = cross(s, n, { age: 500, idle: 80, revenge: 4, livingSoundTime: 33, jumpTicks: 4, moveForward: 1, limbSwing: 3, hurt: 9, love: 50 });
  assert.ok(m.age <= 3, "age " + m.age);
  assert.equal(m.idle, 0);
  assert.equal(m.revenge, 0);
  assert.ok(!(m.livingSoundTime > 3), "livingSoundTime " + m.livingSoundTime);
  assert.equal(m.jumpTicks, 0);
  assert.equal(m.limbSwing === 0 || m.limbSwing < 1, true);
  assert.ok(m.hurt > 0 && m.hurt <= 9, "HurtTime is saved");
  assert.ok(m.love > 0, "InLove is saved");
});
