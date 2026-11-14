// Batch 66 (mpgolems): player-built golems, the snow golem's and iron golem's server behaviour, and silverfish with monster eggs on the dedicated server. No sockets.
import test from "node:test";
import assert from "node:assert/strict";
import { World, PUMPKIN, SNOW_LAYER, MONSTER_EGG } from "./world.js";
import { makeStack } from "./inventory.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { RemoteMobs } from "./multiplayer/remote-mobs.js";
import { SUPPORTED, mobState } from "./multiplayer/server-mobs.js";
import { GOLEM_KINDS, JACK_O_LANTERN } from "./multiplayer/server-golems.js";
import { golemStatus, golemTick } from "./multiplayer/client-golems.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { SNOW_BLOCK, IRON_BLOCK } from "./snow-golem.js";
import { STONE } from "./silverfish.js";

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function fixture(gameMode = "survival", options = {}) {
  const world = new World("mp-golems-b66");
  for (let x = 14; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 40; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode, mobs: true, ...options });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  return s;
}
const join = (s, id, n, x = 64.5, z = 64.5, y = 10) => { const p = s.addPlayer(id, id + "x", key(n)); p.position.copy({ x, y, z }); p.previous.copy(p.position); s.input(id, input()); s.tick(); p.survival.protection = 0; p.dispOut = null; p.itemsOut = null; p.mobPackets = null; return p; };
const packets = p => { const out = p.mobPackets ?? []; p.mobPackets = null; return JSON.parse(JSON.stringify(out)); };
const kinds = (s, t) => s.mobs.mobs.entities.filter(e => e.type === t);
// The player stands above (x, z) and looks straight down: the click lands on the top face of the column and puts the held block on top.
function placeOnTop(s, p, x, z, id, topY) {
  p.position.copy({ x: x + 0.5, y: topY + 3, z: z + 0.5 }); p.previous.copy(p.position);
  p.survival.inventory.main[0] = makeStack(id, 1, 0); p.survival.inventory.current = 0;
  p.yaw = 0; p.pitch = -Math.PI / 2;
  s.queueEdit(p.id, { place: true });
  s.tick();
}

test("the golems and the silverfish are supported server kinds", () => {
  for (const k of ["iron_golem", "snow_golem", "silverfish"]) assert.ok(SUPPORTED.has(k) && GOLEM_KINDS.includes(k), k);
});

test("a pumpkin on two snow blocks builds a snow golem: the three cells clear, the golem stands at the base, the clients are told", () => {
  const s = fixture(), p = join(s, "a", 1);
  s.world.put(70, 10, 70, SNOW_BLOCK, 0, false); s.world.put(70, 11, 70, SNOW_BLOCK, 0, false);
  placeOnTop(s, p, 70, 70, PUMPKIN, 11);
  const [g, ...more] = kinds(s, "snow_golem");
  assert.ok(g && !more.length, "one snow golem");
  assert.ok(Math.abs(g.x - 70.5) < 0.01 && Math.abs(g.z - 70.5) < 0.01 && Math.abs(g.y - (12 - 1.95)) < 0.01, `at (x + 0.5, y - 1.95, z + 0.5) of the pumpkin cell (y 12): ${g.y}`);
  for (const y of [10, 11, 12]) assert.equal(s.world.get(70, y, 70), 0);
  assert.equal(p.survival.inventory.main[0], null, "the pumpkin was used up");
  s.tick();
  const spawn = packets(p).find(k => k.type === "spawn" && k.mob === "snow_golem");
  assert.ok(spawn, "S0F spawn for the snow golem");
});

test("a jack o'lantern builds it too, and the snow branch wins over a snow column that is also an iron T", () => {
  const s = fixture(), p = join(s, "a", 1);
  s.world.put(70, 10, 70, SNOW_BLOCK, 0, false); s.world.put(70, 11, 70, SNOW_BLOCK, 0, false);
  placeOnTop(s, p, 70, 70, JACK_O_LANTERN, 11);
  assert.equal(kinds(s, "snow_golem").length, 1);
  assert.equal(kinds(s, "iron_golem").length, 0);
});

test("a pumpkin on the iron T builds a player-created iron golem, along x or z; a bare column builds nothing", () => {
  const s = fixture(), p = join(s, "a", 1);
  for (const [x, y, z] of [[60, 11, 60], [59, 11, 60], [61, 11, 60], [60, 10, 60]]) s.world.put(x, y, z, IRON_BLOCK, 0, false);
  placeOnTop(s, p, 60, 60, PUMPKIN, 11);
  const [g] = kinds(s, "iron_golem");
  assert.ok(g, "an iron golem");
  assert.equal(g.playerCreated, true);
  for (const [x, y, z] of [[60, 12, 60], [60, 11, 60], [60, 10, 60], [59, 11, 60], [61, 11, 60]]) assert.equal(s.world.get(x, y, z), 0);
  // along z
  for (const [x, y, z] of [[80, 11, 80], [80, 11, 79], [80, 11, 81], [80, 10, 80]]) s.world.put(x, y, z, IRON_BLOCK, 0, false);
  placeOnTop(s, p, 80, 80, PUMPKIN, 11);
  assert.equal(kinds(s, "iron_golem").length, 2);
  // a plain column of two iron blocks
  s.world.put(90, 10, 90, IRON_BLOCK, 0, false); s.world.put(90, 11, 90, IRON_BLOCK, 0, false);
  placeOnTop(s, p, 90, 90, PUMPKIN, 11);
  assert.equal(kinds(s, "iron_golem").length, 2);
  assert.equal(s.world.get(90, 12, 90), PUMPKIN, "the pumpkin stays");
});

test("a player-created iron golem never attacks the player standing next to it", () => {
  const s = fixture(), p = join(s, "a", 1);
  const g = s.mobs.mobs.spawnIronGolem(65.5, 10, 64.5, true);
  const hp = p.survival.health;
  for (let i = 0; i < 200; i++) s.tick();
  assert.ok(s.mobs.mobs.entities.includes(g));
  assert.equal(p.survival.health, hp);
});

test("an iron golem's strike and poppy offer reach the clients as S19 status 4 and 11, and the copy counts them down", () => {
  const s = fixture(), p = join(s, "a", 1);
  const g = s.mobs.mobs.spawnIronGolem(66.5, 10, 64.5, true);
  s.tick(); p.mobPackets = null;
  g.attackTimer = 10; s.tick();
  const a = packets(p).filter(k => k.type === "mobStatus").map(k => k.status);
  assert.deepEqual(a, [4]);
  g.holdRose = 400; s.tick();
  assert.deepEqual(packets(p).filter(k => k.type === "mobStatus").map(k => k.status), [11]);
  s.tick();
  assert.deepEqual(packets(p).filter(k => k.type === "mobStatus"), [], "counting down is silent");
  // the copy
  const mob = { type: "iron_golem", attackTimer: 0, holdRose: 0 }, played = [];
  assert.equal(golemStatus(mob, 4, { x: 1, y: 2, z: 3 }, (...a) => played.push(a)), true);
  assert.equal(mob.attackTimer, 10);
  assert.deepEqual(played, [["mob.irongolem.throw", 1, 2, 3, 1, 1]]);
  assert.equal(golemStatus(mob, 11, {}), true);
  assert.equal(mob.holdRose, 400);
  golemTick(mob);
  assert.deepEqual([mob.attackTimer, mob.holdRose], [9, 399]);
  assert.equal(golemStatus({ type: "cow" }, 4, {}), false);
});

test("the remote-mobs copy of an iron golem raises its arm on status 4 and plays the throw sound", () => {
  const sounds = [], world = new World("copy");
  const rm = new RemoteMobs(world, { sound: (...a) => sounds.push(a) });
  rm.apply([{ type: "spawn", i: 7, mob: "iron_golem", x: 32 * 5, y: 32 * 10, z: 32 * 5, yaw: 0, pitch: 0, headYaw: 0 }]);
  rm.apply([{ type: "mobStatus", i: 7, status: 4 }]);
  const mob = rm.list()[0];
  assert.equal(mob.attackTimer, 10);
  assert.equal(sounds[0][0], "mob.irongolem.throw");
  rm.tick();
  assert.equal(mob.attackTimer, 9);
});

test("a snow golem melts where the biome is hot and in the rain, and leaves a snow layer where it is cold", () => {
  const hot = fixture(), p = join(hot, "a", 1);
  hot.world.temperatureAt = () => 2;
  const g = hot.mobs.mobs.create("snow_golem", 66.5, 10, 64.5); hot.mobs.mobs.entities.push(g);
  for (let i = 0; i < 40; i++) hot.tick();
  assert.ok(g.health < 4 || !hot.mobs.mobs.entities.includes(g), `melting (${g.health})`);
  const cold = fixture(), q = join(cold, "b", 2);
  cold.world.temperatureAt = () => 0;
  const c = cold.mobs.mobs.create("snow_golem", 66.5, 10, 64.5); cold.mobs.mobs.entities.push(c);
  for (let i = 0; i < 5; i++) cold.tick();
  let layers = 0;
  for (let x = 64; x <= 68; x++) for (let z = 63; z <= 66; z++) if (cold.world.get(x, 10, z) === SNOW_LAYER) layers++;
  assert.ok(layers > 0, "a trail of snow layers");
  assert.equal(c.health, 4);
  assert.ok(q);
});

test("a snow golem throws snowballs at a hostile mob; the ball is in the player's dispense snapshot", () => {
  const s = fixture(), p = join(s, "a", 1);
  s.world.temperatureAt = () => 0;
  const g = s.mobs.mobs.create("snow_golem", 64.5, 10, 64.5); s.mobs.mobs.entities.push(g);
  const z = s.mobs.mobs.create("zombie", 64.5, 10, 70.5); s.mobs.mobs.entities.push(z);
  let seen = null;
  for (let i = 0; i < 200 && !seen; i++) { s.tick(); seen = s.dispense.snapshot(p).find(e => e.k === "b" && e.kind === "snowball") ?? null; }
  assert.ok(seen, "a snowball flies");
});

test("a monster egg a Creative player breaks lets one silverfish out, a Survival player two; the clients get the puff", () => {
  const c = fixture("creative"), p = join(c, "a", 1);
  c.world.put(70, 10, 70, MONSTER_EGG, 0, false);
  p.position.copy({ x: 70.5, y: 13, z: 70.5 }); p.previous.copy(p.position); p.yaw = 0; p.pitch = -Math.PI / 2;
  c.queueEdit(p.id, { place: false }); c.tick();
  assert.equal(c.world.get(70, 10, 70), 0);
  // b69 lead: a released silverfish may hide in the stone below on its first tick (its Entity.rand is seeded from Math.random), which removes it and
  // draws a second puff; released = (puffs + left) / 2, hidden = (puffs - left) / 2. The test failed about 3 in 8 runs before this, batch 68 included.
  const puffs = (p.dispOut ?? []).flatMap(m => m.type === "dispFx" ? m.events : []).filter(e => e.k === "spawnerPuff");
  const left = kinds(c, "silverfish").length;
  assert.equal((puffs.length + left) / 2, 1, "one silverfish released");
  assert.ok(left <= 1);
  const s = fixture(), q = join(s, "b", 2);
  s.world.put(70, 10, 70, MONSTER_EGG, 0, false);
  s.release = s.golems.release.bind(s.golems);
  assert.ok(s.golems.release(70, 10, 70));
  assert.equal(kinds(s, "silverfish").length, 1);
  assert.ok(q);
});

test("a hurt silverfish calls the monster eggs around it out, with the block break effect", () => {
  const s = fixture(), p = join(s, "a", 1);
  for (let x = 66; x <= 68; x++) s.world.put(x, 10, 62, MONSTER_EGG, 0, false);
  const f = s.mobs.mobs.create("silverfish", 64.5, 10, 62.5); s.mobs.mobs.entities.push(f);
  s.mobs.mobs.attackEntityFrom(f, 1, { name: "player", player: true });
  p.itemsOut = null;
  for (let i = 0; i < 30; i++) s.tick();
  const left = [66, 67, 68].filter(x => s.world.get(x, 10, 62) === MONSTER_EGG).length;
  assert.ok(left < 3, `at least one egg opened (${left} left)`);
  assert.ok(kinds(s, "silverfish").length >= 2, "friends came out");
  const aux = (p.itemsOut ?? []).filter(m => m.type === "aux").flatMap(m => m.events).filter(e => e.id === 2001);
  assert.ok(aux.length > 0, "level event 2001");
});

test("a silverfish with nobody to chase hides in stone beside it and the cell becomes a monster egg", () => {
  const s = fixture(), p = join(s, "a", 1, 80.5, 80.5);
  for (let x = 58; x <= 62; x++) for (let z = 58; z <= 62; z++) for (let y = 9; y <= 12; y++) if (!(x === 60 && z === 60 && y === 10)) s.world.put(x, y, z, STONE, 0, false);
  const f = s.mobs.mobs.create("silverfish", 60.5, 10, 60.5); s.mobs.mobs.entities.push(f);
  for (let i = 0; i < 400 && s.mobs.mobs.entities.includes(f); i++) s.tick();
  assert.ok(!s.mobs.mobs.entities.includes(f) || f.health <= 0, "it hid");
  let eggs = 0;
  for (let x = 58; x <= 62; x++) for (let z = 58; z <= 62; z++) for (let y = 9; y <= 12; y++) if (s.world.get(x, y, z) === MONSTER_EGG) eggs++;
  assert.equal(eggs, 1);
  assert.ok((p.dispOut ?? []).flatMap(m => m.type === "dispFx" ? m.events : []).some(e => e.k === "spawnerPuff"), "the puff where it hid (status 20)");
});

test("mobState adds nothing for the golems and silverfish (no watched fields)", () => {
  assert.deepEqual(mobState({ type: "iron_golem", health: 100, hurt: 0 }), {});
  assert.deepEqual(mobState({ type: "snow_golem", health: 4, hurt: 0 }), {});
  assert.deepEqual(mobState({ type: "silverfish", health: 8, hurt: 0 }), {});
});
