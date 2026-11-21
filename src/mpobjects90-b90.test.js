// Batch 90 mpobjects90: falling blocks tick before the tracker pass (their S0E leaves in the tick they spawn), a summoned or loaded falling block has its join state, a crystal a
// piston pushes into a cactus or fire explodes (Entity.moveEntity's block tail), and the multiplayer client's falling copies cast a shadow.
// See .shared-memory/notes/mpobjects90-b90-track.md.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World, GRAVEL, CACTUS } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { EntityWorld } from "./entities.js";
import { summonEntity } from "./entity-summon.js";
import { crystalPushHooks } from "./ender-crystal.js";

const src = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
const rowsOf = (p) => (p.dispOut ?? []).filter((m) => m.type === "dispEnts" && m.trk).flatMap((m) => m.trk).filter((r) => r.k === "falling");
function shaft() {
  const w = new World("b90-falling");
  for (let x = 40; x <= 110; x++) for (let z = 40; z <= 90; z++) for (let y = 9; y <= 60; y++) w.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  w.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world: w, gameMode: "survival", mobs: false });
  const p = s.addPlayer("a", "ax", key(1)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position); s.input("a", input());
  for (let i = 0; i < 20; i++) s.tick();
  return { w, s, p };
}
const spawnOf = (p) => rowsOf(p).flatMap((r) => r.p).find((x) => x.type === "spawn");

test("bytecode-read tick order: a falling block's S0E goes out in the tick WorldServer.tickUpdates spawned it, with the join position", () => {
  const { w, s, p } = shaft();
  w.put(66, 40, 66, GRAVEL, 0, false); s.falling.schedule(66, 40, 66);
  let at = -1;
  for (let i = 0; i < 6 && at < 0; i++) {
    p.dispOut = null; s.tick();
    if (s.falling.entities.length) { assert.ok(spawnOf(p), "the spawn packet is in the tick the entity appeared"); at = i; }
    else assert.equal(spawnOf(p), undefined);
  }
  assert.ok(at >= 0);
  const sp = spawnOf(p);
  assert.deepEqual([sp.objectType, sp.data, sp.y], [70, 13, Math.floor(40.5 * 32)], "S0E type 70, the gravel id, posY at the join (not after the entity's first fall)");
  assert.equal(w.get(66, 40, 66), 0, "the source cell was cleared in the same tick");
});

test("a block placed by falling.tick before the flush also holds in the Nether tick order (source pin)", () => {
  const sim = src("./multiplayer/simulation.js"), nether = src("./multiplayer/server-nether.js");
  assert.ok(sim.indexOf("this.falling.tick();") < sim.indexOf("this.dispense.flush();"));
  assert.ok(nether.indexOf("n.falling.tick();") < nether.indexOf("n.dispense.flush();"));
});

test("a loaded or summoned falling block has its join state the moment it is spawned (World.spawnEntityInWorld), whatever tick that is", () => {
  const { s } = shaft();
  s.dispense.thrownList(); // the first lane pass installs the hooks
  const tracks = s.dispense.thrownTracks;
  s.falling.restoreEntity({ block: GRAVEL, meta: 0, x: 70.5, y: 40, z: 70.5, vx: 0.1, vy: -0.5, vz: 0, ticks: 5 });
  const loaded = s.falling.entities.at(-1);
  assert.ok(tracks.births.has(loaded), "restoreEntity");
  assert.equal(tracks.births.get(loaded).vx, 0.1);
  const hosts = { falling: s.falling, primed: [], items: s.items, mobs: null, dimension: 0 };
  const before = s.falling.entities.length;
  const made = summonEntity(hosts, "FallingSand", 72.5, 41, 72.5, null, {});
  assert.notEqual(made, false);
  assert.equal(s.falling.entities.length, before + 1);
  const summoned = s.falling.entities.at(-1);
  assert.ok(tracks.births.has(summoned), "summonEntity FallingSand");
  assert.equal(tracks.births.get(summoned).x, 72.5);
});

test("bytecode-read sa.d / wz.a: a crystal pushed into a cactus or fire explodes once, at its posY; a clear push does nothing", () => {
  for (const [name, put, power] of [["cactus", CACTUS, 1], ["fire", 45, 1], ["clear", 0, 0]]) {
    const world = new World("b90-crystal-" + name);
    for (let x = 15; x <= 26; x++) for (let z = 15; z <= 26; z++) for (let y = 5; y <= 16; y++) world.put(x, y, z, 0, 0, false);
    world.put(22, 10, 20, put, 0, false);
    const w = new EntityWorld(world, [], () => 0.5), blasts = [];
    w.explodeInline = (ev) => blasts.push(ev.explode);
    const c = { type: "ender_crystal", x: 20.5, y: 10, z: 20.5, health: 5, vx: 0, vy: 0, vz: 0 };
    w.entities.push(c);
    w.pushMove(c, 1.0, 0, 0);
    assert.equal(blasts.length, power, name);
    assert.equal(c.y, 10, name + ": posY restored after the move");
    if (power) { assert.equal(blasts[0].y, 10, "explodes at posY, not the box bottom"); assert.equal(blasts[0].size, 6); assert.equal(c.crystalGone, true); }
    else assert.equal(c.crystalGone, undefined);
  }
  // an Invulnerable crystal is not hurt (wz.a: isEntityInvulnerable)
  const world = new World("b90-crystal-inv");
  for (let x = 15; x <= 26; x++) for (let z = 15; z <= 26; z++) for (let y = 5; y <= 16; y++) world.put(x, y, z, 0, 0, false);
  world.put(22, 10, 20, CACTUS, 0, false);
  const w = new EntityWorld(world, [], () => 0.5), blasts = [];
  w.explodeInline = (ev) => blasts.push(ev);
  const c = { type: "ender_crystal", x: 20.5, y: 10, z: 20.5, health: 5, vx: 0, vy: 0, vz: 0, invulnerable: true };
  w.entities.push(c); w.pushMove(c, 1.0, 0, 0);
  assert.equal(blasts.length, 0);
  // the helper: wet false, hurt shows posY
  const seen = []; const e = { y: 3 }; crystalPushHooks(e, (x) => seen.push(x.y)).hurt("cactus", 1);
  assert.deepEqual(seen, [4]); assert.equal(e.y, 3);
});

test("the multiplayer client's falling copies cast the falling-block shadow (main.js pin)", () => {
  assert.match(src("./main.js"), /for \(const e of remoteDispense\?\.falling \?\? \[\]\) list\.push\(\{ \.\.\.SHADOWS\.falling_block,/);
});
