// Batch 63 (mpwither): the wither on the dedicated server. A player's skull completes the T of soul sand, the wither is a tracked server mob with Invul and health in S1C, its spawn
// blast breaks blocks, hurts players and plays the broadcast level event 1013, its skulls are server projectiles the client draws, its death drops a nether star and awards killWither to
// every player in range, spawnWither goes to the players within 50 blocks. No sockets.
import test from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { makeStack } from "./inventory.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { RemoteMobs } from "./multiplayer/remote-mobs.js";
import { RemoteDispense } from "./multiplayer/client-dispense.js";
import { dispenserAux, witherSpawnAt } from "./multiplayer/client-containers.js";
import { SUPPORTED, MOB_LIMIT, mobState } from "./multiplayer/server-mobs.js";
import { playersAround } from "./multiplayer/server-wither.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { SKULL, ITEM_SKULL } from "./skull.js";
import { SOUL_SAND } from "./nether-blocks.js";
import { NETHER_STAR } from "./wither-boss-mobs.js";

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function fixture(gameMode = "survival", options = {}) {
  const world = new World("mp-wither-b63");
  for (let x = 14; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 40; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode, mobs: true, ...options });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  return s;
}
const join = (s, id, n, x = 64.5, z = 64.5, y = 10) => { const p = s.addPlayer(id, id + "x", key(n)); p.position.copy({ x, y, z }); p.previous.copy(p.position); s.input(id, input()); s.tick(); p.survival.protection = 0; p.dispOut = null; p.itemsOut = null; p.mobPackets = null; return p; };
const packets = p => { const out = p.mobPackets ?? []; p.mobPackets = null; return JSON.parse(JSON.stringify(out)); };
const awards = (s, id) => (s.events ?? []).filter(e => e.type === "award" && e.achievement === id);
const withers = s => s.mobs.mobs.entities.filter(e => e.type === "wither");
// The T along x: skulls at (60..62, 12, 64) on soul sand (60..62, 11, 64) with one more below the middle; the first two skulls stand, the third is placed by `p` from above.
function buildT(s, p, x0 = 60) {
  for (const x of [x0, x0 + 1, x0 + 2]) s.world.put(x, 11, 64, SOUL_SAND, 0, false);
  s.world.put(x0 + 1, 10, 64, SOUL_SAND, 0, false);
  for (const x of [x0, x0 + 1]) { s.world.put(x, 12, 64, SKULL, 0, false); s.tileEntities.skulls.create(x, 12, 64, 1, 0); }
  p.position.copy({ x: x0 + 2.5, y: 14, z: 64.5 }); p.previous.copy(p.position);
  p.survival.inventory.main[0] = makeStack(ITEM_SKULL, 1, 1); p.survival.inventory.current = 0;
  p.yaw = 0; p.pitch = -Math.PI / 2;
  s.queueEdit(p.id, { place: true });
  s.tick();
}

test("the wither is a supported server kind", () => { assert.ok(SUPPORTED.has("wither")); });

test("the third skull of the T builds a wither: the seven cells clear, the entity has Invul 220 and a third of its health", () => {
  const s = fixture(), p = join(s, "a", 1);
  buildT(s, p);
  const [w] = withers(s);
  assert.ok(w, "a wither is in the server's world");
  assert.ok(w.invul >= 215 && w.invul <= 220);
  assert.ok(Math.abs(w.health - 100) < 3, `a third of 300 (${w.health})`);
  for (const x of [60, 61, 62]) { assert.equal(s.world.get(x, 12, 64), 0, "skull gone"); assert.equal(s.world.get(x, 11, 64), 0, "soul sand gone"); }
  assert.equal(s.world.get(61, 10, 64), 0);
  assert.equal(s.tileEntities.skulls.tile(60, 12, 64), null);
  assert.equal(p.survival.inventory.main[0], null, "the skull was used up");
  assert.ok(Math.abs(w.x - 61.5) < 0.1 && Math.abs(w.z - 64.5) < 0.1 && Math.abs(w.y - 10.55) < 0.1, `at the row's middle, 1.45 below the skull (${w.x}, ${w.y}, ${w.z})`);
});

test("on Peaceful no wither is built, and a Nether player never builds one", () => {
  const s = fixture(); s.difficulty = 0;
  const p = join(s, "a", 1);
  buildT(s, p);
  assert.equal(withers(s).length, 0);
  assert.equal(s.world.get(62, 12, 64), SKULL, "the skulls stay");
  // b64: a Nether player builds one too (mpwither-b64.test.js); the hook carries the server difficulty in every dimension
  assert.equal(s.wither.hooks({ dimension: -1 }).difficulty, 0);
});

test("spawnWither goes to the players within 50 blocks of the box, not to a farther one", () => {
  const s = fixture(), p = join(s, "a", 1), near = join(s, "b", 2, 66.5, 64.5), far = join(s, "c", 3, 100.5, 64.5);
  buildT(s, p, 16);
  const got = awards(s, "spawnWither").map(e => e.id);
  assert.ok(got.includes(p.id) && got.includes(near.id), `builder and the player 49 blocks away (${got})`);
  assert.ok(!got.includes(far.id), "a player 83 blocks away does not");
  // the box helper: strict intersection of the box grown by 50
  const e = { x: 0, y: 0, z: 0 };
  assert.equal(playersAround([{ player: { position: { x: 50.7, y: 0, z: 0 } } }], e, 50, 50, 50).length, 1, "0.45 + 50 + 0.3 = 50.75: 50.7 is inside");
  assert.equal(playersAround([{ player: { position: { x: 50.8, y: 0, z: 0 } } }], e, 50, 50, 50).length, 0, "50.8 is outside");
});

test("the copy gets the wither with Invul and health in S0F / S1C, and the boss bar can read them", () => {
  const s = fixture(), a = join(s, "a", 1), remote = new RemoteMobs(s.world);
  buildT(s, a);
  const [w] = withers(s);
  const id = Number(w.id.slice(4));
  for (let i = 0; i < 6; i++) { remote.apply(packets(a)); remote.tick(); s.tick(); }
  remote.apply(packets(a));
  const c = remote.copies.get(id);
  assert.ok(c, "the wither has a client copy");
  assert.equal(c.mob.type, "wither");
  assert.ok(c.mob.invul > 0 && c.mob.invul <= 220, `Invul (${c.mob.invul})`);
  assert.ok(Math.abs(c.mob.health - w.health) <= 1, `health follows the watcher (${c.mob.health} vs ${w.health})`);
  w.health = 60; w.invul = 0; // armoured below half health
  for (let i = 0; i < 4; i++) { s.tick(); remote.apply(packets(a)); remote.tick(); }
  assert.ok(c.mob.health <= 61 && c.mob.health > 55, `the bar's health after a hit (${c.mob.health})`);
  assert.equal(c.mob.invul, 0);
  w.headYaw = [20, -30]; w.headPitch = [5, 10];
  assert.deepEqual(mobState(w).hy, [20, -30]);
  assert.deepEqual(mobState(w).hpi, [5, 10]);
  s.tick(); remote.apply(packets(a));
  assert.deepEqual(c.mob.headYaw, mobState(w).hy, "the side heads turn on the copy");
});

test("the end of the spawn charge: an explosion breaks blocks, hurts a player, and level event 1013 reaches every player", () => {
  const s = fixture(), a = join(s, "a", 1, 64.5, 62.5), far = join(s, "b", 2, 100.5, 100.5);
  const w = s.mobs.mobs.create("wither", 64.5, 10, 70.5); w.invul = 2; w.health = 100; s.mobs.mobs.entities.push(w);
  for (let x = 62; x <= 66; x++) for (let z = 68; z <= 72; z++) for (let y = 10; y <= 14; y++) s.world.put(x, y, z, 1, 0, false); // stone around it
  w.y = 9.5; s.world.put(64, 9, 70, 3, 0, false);
  const hp = a.survival.health;
  let aux = [], fx = [];
  for (let i = 0; i < 8; i++) { s.tick(); for (const p of [far]) for (const m of p.itemsOut ?? []) if (m.type === "aux") aux.push(...m.events); fx.push(...(a.dispOut ?? []).filter(m => m.type === "dispFx").flatMap(m => m.events)); a.dispOut = null; far.dispOut = null; far.itemsOut = null; a.itemsOut = null; }
  const gone = [];
  for (let x = 62; x <= 66; x++) for (let z = 68; z <= 72; z++) for (let y = 10; y <= 14; y++) if (s.world.get(x, y, z) === 0) gone.push(1);
  assert.ok(gone.length > 20, `the blast cleared stone (${gone.length} cells)`);
  assert.ok(a.survival.health < hp, `the player 8 blocks away was hurt (${hp} -> ${a.survival.health})`);
  assert.ok(aux.some(e => e.id === 1013), "the far player got the broadcast level event");
  assert.ok(fx.some(e => e.k === "explode"), "and the near one the burst");
});

test("the client plays the wither spawn sound two blocks from the listener towards the origin", () => {
  const at = witherSpawnAt({ x: 0, y: 0, z: 0 }, 30, 0, 40);
  assert.ok(Math.abs(at.x - 1.2) < 1e-9 && Math.abs(at.z - 1.6) < 1e-9 && at.y === 0);
  const played = [];
  assert.equal(dispenserAux({ id: 1013, x: 30, y: 0, z: 40, data: 0 }, { play: (...a) => played.push(a), smoke() {}, listener: () => ({ x: 0, y: 0, z: 0 }) }), true);
  assert.equal(played[0][0], "mob.wither.spawn");
  assert.equal(played[0][5], 1);
});

test("a wither skull is a server projectile: it flies, the client row is blue and turns to its flight, it hits the player", () => {
  const s = fixture(), a = join(s, "a", 1, 64.5, 66.5), remote = new RemoteDispense();
  const w = s.mobs.mobs.create("wither", 64.5, 10, 80.5); w.invul = 0; w.health = 300; s.mobs.mobs.entities.push(w);
  const sm = s.mobs.mobs;
  sm.skulls.launch({ owner: w, x: 64.5, y: 12, z: 74, dx: 0, dy: -0.1, dz: -8, blue: true });
  const hp = a.survival.health;
  let row = null, blocks0 = s.world.get(64, 12, 64);
  for (let i = 0; i < 40 && !(a.survival.health < hp); i++) {
    s.tick();
    for (const m of a.dispOut ?? []) if (m.type === "dispEnts") { remote.apply(m); row = remote.balls.find(b => b.kind === "witherSkull" && b.blue) ?? row; }
    a.dispOut = null; a.itemsOut = null;
  }
  assert.ok(row, "the client saw the skull");
  assert.equal(row.blue, true);
  assert.ok(row.vz < 0, "the model can turn to the flight");
  assert.ok(a.survival.health < hp, `the skull hit for 8 (${hp} -> ${a.survival.health})`);
});

test("a wither the server runs fires skulls at a player in sight", () => {
  const s = fixture(), a = join(s, "a", 1, 64.5, 66.5);
  const w = s.mobs.mobs.create("wither", 64.5, 12, 80.5); w.invul = 0; w.health = 300; s.mobs.mobs.entities.push(w);
  let seen = 0;
  for (let i = 0; i < 500 && !seen; i++) { s.tick(); seen = Math.max(seen, s.mobs.mobs._skulls?.list.length ?? 0); a.dispOut = null; a.itemsOut = null; a.mobPackets = null; a.survival.health = 20; }
  assert.ok(seen > 0, "a skull was launched");
});

test("a dying wither drops a nether star and awards killWither to every player in range, whoever struck", () => {
  const s = fixture(), a = join(s, "a", 1, 64.5, 66.5), b = join(s, "b", 2, 90.5, 70.5), far = join(s, "c", 3, 14.5, 110.5);
  const w = s.mobs.mobs.create("wither", 75.5, 10, 80.5); w.invul = 0; w.health = 5; s.mobs.mobs.entities.push(w);
  s.mobs.mobs.attackEntityFrom(w, 50, { name: "generic" }); // no player struck
  for (let i = 0; i < 30; i++) { s.tick(); a.itemsOut = null; }
  const got = awards(s, "killWither").map(e => e.id);
  assert.ok(got.includes(a.id) && got.includes(b.id), `both near players (${got})`);
  assert.ok(!got.includes(far.id));
  assert.ok(s.items.items.some(e => e.stack.id === NETHER_STAR), "a nether star lies where it died");
});

test("only the Overworld lane sends wither skulls", () => {
  const s = fixture(), a = join(s, "a", 1);
  const w = s.mobs.mobs.create("wither", 64.5, 10, 80.5); s.mobs.mobs.entities.push(w);
  s.mobs.mobs.skulls.launch({ owner: w, x: 64.5, y: 12, z: 70, dx: 0, dy: 0, dz: -1 });
  assert.ok(s.dispense.snapshot({ position: a.position, dimension: 0 }).some(r => r.kind === "witherSkull"));
  assert.equal(s.dispense.snapshot({ position: a.position, dimension: -1 }).some(r => r.kind === "witherSkull"), false);
});

test("a full world keeps a wither just built (the cap trims other mobs from the end)", () => {
  const s = fixture(); s.mobs.spawning = true;
  const p = join(s, "a", 1);
  for (let i = 0; i < MOB_LIMIT + 10; i++) { const m = s.mobs.mobs.create("pig", 40.5 + (i % 20), 10, 90.5 + Math.floor(i / 20)); s.mobs.mobs.entities.push(m); }
  const w = s.mobs.mobs.create("wither", 64.5, 10, 100.5); w.invul = 100; s.mobs.mobs.entities.push(w);
  s.tick();
  assert.ok(s.mobs.mobs.entities.includes(w));
  assert.ok(s.mobs.mobs.entities.length <= MOB_LIMIT + 2);
  void p;
});
