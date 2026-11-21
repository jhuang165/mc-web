// Batch 91 entnbt91: arrows and firework rockets cross portals in the away run, and the dedicated server walks them between its dimensions (zc.h / zf.h / sa.b(I), bytecode-read
// in entnbt89 and entnbt90), plus the per-kind NBT round-trip audit. See .shared-memory/notes/entnbt91-b91-track.md.
import test from "node:test";
import assert from "node:assert/strict";
import { populationBlockMapperReady } from "./population-world.js";
import { runAway, stateColumns, awayPlan } from "./away-world.js";
import { FireworkRockets } from "./fireworks-live.js";
import { Arrows } from "./bow.js";

await populationBlockMapperReady;
const STONE = 3;
const floorChunks = (cols) => cols.map(([x, z]) => {
  const blocks = new Uint8Array(65536), meta = new Uint8Array(65536);
  for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y <= 10; y++) blocks[(lx * 16 + lz) * 256 + y] = STONE;
  return { x, z, blocks, meta };
});
const setBlock = (chunks, x, y, z, b, m = 0) => {
  const c = chunks.find((k) => k.x === x >> 4 && k.z === z >> 4), i = ((x & 15) * 16 + (z & 15)) * 256 + y;
  c.blocks[i] = b; c.meta[i] = m;
};
const base = { seed: "away", biome: "javaStreamed", worldType: "flat", worldSpawn: [0, 64, 0] };
const run = (root, ticks, edit = () => {}) => {
  const cols = stateColumns(root), plan = { ...awayPlan(root, cols, ticks), chunks: floorChunks(cols), records: [] };
  edit(plan.chunks);
  return runAway(plan);
};
const portal = (chunks) => { for (let y = 11; y <= 14; y++) { setBlock(chunks, 3, y, 5, 164); setBlock(chunks, 4, y, 5, 164); } }; // 164: the internal id of original block 90
const arrowRec = (x, extra = {}) => { const a = new Arrows(); const e = a.make({ x, y: 12, z: 5.5, mx: 0, my: 0, mz: 0, yaw: 0, pitch: 0 }, () => 0.5, { damage: 3.5, pickup: 2, ...extra }); return a.serializeOne(e); };

test("away run: an arrow resting in a portal leaves as a traveller with its NBT; one elsewhere stays", async () => {
  const root = { ...base, arrows: [arrowRec(3.5), arrowRec(20.5)] };
  const r = await run(root, 10, portal);
  const t = r.entities.portalTravel.filter((x) => x.kind === "arrow");
  assert.equal(t.length, 1);
  assert.equal(t[0].arg, -1);
  assert.equal(t[0].rec.portalCooldown, 300);
  assert.deepEqual([t[0].rec.damage, t[0].rec.pickup], [3.5, 2]);
  assert.equal(r.entities.arrows.length, 1, "only the far arrow stays");
  assert.equal(r.entities.arrows[0].x, 20.5);
});

test("away run: a rocket flying through a portal travels", async () => {
  const src = new FireworkRockets(); src.launch(3.5, 11, 5.5, null);
  const rec = src.serialize();
  Object.assign(rec.rockets[0], { lifetime: 400 });
  const r = await run({ ...base, rockets: rec }, 6, portal);
  const t = r.entities.portalTravel.filter((x) => x.kind === "rocket");
  assert.equal(t.length, 1);
  assert.equal(t[0].rec.portalCooldown, 300);
  assert.equal(r.entities.rockets.rockets.length, 0);
});

// --- the dedicated server ---
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { PORTAL } from "./nether-portal.js";
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function flat() {
  const w = new World("entnbt91");
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

test("server: an arrow in an Overworld portal reaches the Nether lane with its NBT and the 300-tick cooldown; no shooter", { timeout: 120000 }, () => {
  const { s, n } = fixture();
  frame(s.world, 64, 64, 10);
  const lane = s.dispense, a = lane.arrows.make({ x: 64.9, y: 11, z: 64.5, mx: 0, my: 0, mz: 0, yaw: 20, pitch: 5 }, lane.arrows.rng(), { shooter: { name: "x" }, pickup: 2, damage: 3.5, inTile: 5 });
  lane.arrows.list.push(a);
  for (let i = 0; i < 4; i++) s.tick();
  assert.equal(lane.arrows.list.includes(a), false, "the arrow left the Overworld lane");
  assert.equal(n.dispense.arrows.list.length, 1, "and joined the Nether's");
  const b = n.dispense.arrows.list[0];
  assert.deepEqual([b.damage, b.pickup, b.inTile], [3.5, 2, 5]);
  assert.ok(b.portalCooldown > 290 && b.portalCooldown <= 300);
  assert.ok(!b.shooter || b.shooter === "player" || !b.shooter.name, "the shooter is not saved natively");
  assert.ok(b.x >= 24 && b.x <= 104, "placed inside the finite Nether");
});

test("server: a rocket in a Nether portal reaches the Overworld instance with its fireworks item", { timeout: 120000 }, () => {
  const { s, n } = fixture();
  frame(n.world, 64, 64, 60);
  n.dispense.rockets.launch(64.9, 61, 64.5, null);
  const r0 = n.dispense.rockets.rockets[0]; Object.assign(r0, { lifetime: 400, mx: 0, my: 0, mz: 0 });
  const before = s.dispense.rockets.rockets.length;
  for (let i = 0; i < 4; i++) s.tick();
  assert.equal(n.dispense.rockets.rockets.includes(r0), false, "left the Nether");
  assert.equal(s.dispense.rockets.rockets.length, before + 1, "joined the Overworld's rockets");
  const r = s.dispense.rockets.rockets.at(-1);
  assert.ok(r.lifetime >= 1 && r.portalCooldown > 290);
});
