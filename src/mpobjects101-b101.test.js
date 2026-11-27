// Batch 101 mpobjects101: (1) the ghost-disc item's tracker re-test follows EntityTrackerEntry's cadence (a standing item is not re-listed every tick; executed record `cadence`),
// (2) the disconnect end to end through server/server.js, (3) villager S19 12 / 13 / 14 against the executed records (the birth's 12 is the CHILD's).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";
import { populationBlockMapperReady } from "./population-world.js";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { musicOf, JUKEBOX } from "./multiplayer/server-music.js";
import { GHOST_DROP_REASON } from "./multiplayer/server-ghost-items.js";
import { IDLE_INPUT, PROTOCOL } from "./multiplayer/protocol.js";
import { villageTasks } from "./village-ai.js";
import { Task } from "./ai.js";
import { JavaRandom } from "./java-random.js";
import { tickVillagerRestock } from "./villager.js";
import { createDedicatedServer } from "../server/server.js";

await populationBlockMapperReady;
const ref = JSON.parse(readFileSync(new URL("../public/research/mpobjects101-reference.json", import.meta.url), "utf8"));
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function flat(name) {
  const w = new World(name);
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) w.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  w.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return w;
}
function sim(name) {
  const s = new DedicatedSimulation({}, { world: flat(name), gameMode: "survival", mobs: true });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  return s;
}
function ghostJukebox(s) {
  const m = musicOf(s.redstone);
  s.world.set(66, 11, 62, JUKEBOX, true, 1);
  m.jukeboxes.restore([{ x: 66, y: 11, z: 62, record: { id: 0, ghost: true, count: 1, damage: 0 } }]);
  return m;
}
function fixture(name) {
  const s = sim(name);
  const p = s.addPlayer("a", "Alice", key(1));
  p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position); s.input("a", input());
  const drops = [];
  s.admin.host = { drop: (pid, reason) => drops.push([pid, reason]), kick() {} };
  const m = ghostJukebox(s);
  s.redstone.use(66, 11, 62);
  assert.equal(m.inert.list.length, 1);
  return { s, p, m, drops };
}

test("executed record: a standing item's entry sends nothing on later list calls and the S0E only from the first list pass or updatePlayerEntity", () => {
  const rows = ref.cadence[0].rows;
  assert.deepEqual(rows[0][1], [], "created with the player 300 blocks away");
  assert.deepEqual(rows[1][1], [], "the first pass finds nobody in range");
  for (const r of rows.slice(2, -1)) assert.deepEqual(r[1], [], r[0]);
  assert.equal(rows.at(-1)[0], "updatePlayerEntity");
  assert.equal(rows.at(-1)[1][0][0], "S0E");
});

test("cadence: a player standing in range is tested once (new item), not every tick; a walk to a spot 4+ blocks away re-lists", () => {
  const { s, p, drops } = fixture("b101-cadence");
  p.position.copy({ x: 64.5 + 80, y: 10, z: 64.5 }); // out of range at the item's first pass
  s.redstone.beginTick();
  assert.equal(drops.length, 0);
  // walks 3 blocks per tick toward the item but stays in range of it only after leaving the tracker's 4-block step rule
  p.position.copy({ x: 66.5 + 60, y: 10, z: 62.5 }); // 20 blocks of travel: the player's own entry moved over 4 blocks: tested, in range (60 < 64)
  s.redstone.beginTick();
  assert.equal(drops.length, 1, "dropped on the tick the player's own entry moved");
});

test("cadence: a small step into range is not tested until the player's entry has moved more than 4 blocks (distance squared 16)", () => {
  const { s, p, drops } = fixture("b101-small-step");
  p.position.copy({ x: 66.5 + 64.5, y: 10, z: 62.5 }); // 64.5 blocks away: just out of range
  s.redstone.beginTick(); // first pass for the player: tested, out of range
  assert.equal(drops.length, 0);
  p.position.copy({ x: 66.5 + 63.5, y: 10, z: 62.5 }); // 1 block closer: now in range, but the entry moved 1 block only
  for (let i = 0; i < 5; i++) s.redstone.beginTick();
  assert.equal(drops.length, 0, "no re-list: the item is standing and the player's step is under 4 blocks");
  p.position.copy({ x: 66.5 + 59.0, y: 10, z: 62.5 }); // 5.5 blocks from the last list position
  s.redstone.beginTick();
  assert.equal(drops.length, 1);
});

test("cadence: the chunk send (the column becomes watched) triggers the test without a 4-block move", () => {
  const { s, p, drops } = fixture("b101-chunk-send");
  let watching = false;
  s.chunkViews = { sees: () => watching };
  s.redstone.beginTick();
  s.redstone.beginTick();
  assert.equal(drops.length, 0);
  watching = true;
  s.redstone.beginTick();
  assert.deepEqual(drops, [["a", GHOST_DROP_REASON]]);
  assert.ok(p);
});

test("end to end through server/server.js: a tracking player gets the S0E counted, then the connection closes with the netty text and no S40 is written", { timeout: 60000 }, async (t) => {
  const s = sim("b101-e2e");
  s.rules.chunkStream = false;
  const token = "test-only-not-a-deployed-server-key";
  const dir = await mkdtemp(path.join(os.tmpdir(), "mc-web-mpobjects101-"));
  const app = await createDedicatedServer({ port: 0, token, dataFile: path.join(dir, "world.json"), simulation: s, tickMs: 10, saveMs: 600000 });
  t.after(async () => { await app.close(); await rm(dir, { recursive: true, force: true }); });
  const session = (await app.accounts.register({ invite: token, name: "Alice", password: "correct horse" }, token)).session;
  const ws = new WebSocket(`ws://127.0.0.1:${app.port}/multiplayer`, { origin: "http://localhost:5179" }), log = [];
  ws.on("message", (d) => log.push(JSON.parse(d)));
  await once(ws, "open");
  const closed = new Promise((res) => ws.on("close", (code, reason) => res({ code, reason: reason.toString() })));
  ws.send(JSON.stringify({ type: "join", protocol: PROTOCOL, chunks: false, session }));
  for (let i = 0; i < 2000 && !log.some((m) => m.type === "welcome"); i++) await new Promise((r) => setTimeout(r, 5));
  const welcome = log.find((m) => m.type === "welcome");
  assert.ok(welcome, "joined");
  const stats = s.admin.netStats.writes, p = s.players.get(welcome.id);
  p.position.copy({ x: 64.5, y: 10, z: 64.5 });
  const s0e = stats.counts[14] | 0, s40 = stats.counts[64] | 0;
  const m = ghostJukebox(s);
  s.redstone.use(66, 11, 62); // the disc is ejected: the inert item exists
  assert.equal(m.inert.list.length, 1);
  const end = await Promise.race([closed, new Promise((_, rej) => setTimeout(() => rej(new Error("not disconnected")), 20000))]);
  assert.equal(end.code, 1008);
  assert.equal(end.reason, GHOST_DROP_REASON);
  assert.equal(stats.counts[14], s0e + 1, "one S0E counted");
  assert.equal(stats.counts[64] | 0, s40, "netty's exception closes the channel: no S40 kick packet");
  for (let i = 0; i < 400 && s.players.has(welcome.id); i++) await new Promise((r) => setTimeout(r, 5));
  assert.equal(s.players.has(welcome.id), false, "the socket close removed the player");
  assert.equal(m.inert.list.length, 1, "the item stays for the next player");
});

test("villager statuses: the executed records show 12 on the tracked mating villager and the CHILD at birth, 14 at the restock, 13 only for a player hit that leaves it alive in a village", () => {
  const by = Object.fromEntries(ref.records.map((r) => [r.name, r.statuses]));
  const birth = by["b100-m101-breed-birth-9902"];
  assert.equal(birth.at(-1)[2], 12); assert.equal(birth.at(-1)[3], -24000, "the last 12 is the newborn's");
  assert.ok(birth.slice(0, -1).every((q) => q[2] === 12 && q[3] === 0), "the others are the adults' rolls");
  assert.deepEqual(by["b100-m101-restock-9833"].map((q) => q[2]), [14]);
  assert.deepEqual(by["b100-m101-trade-nobuy-9830"], []);
  assert.deepEqual(by["b100-m101-hit-player-10101"].map((q) => q[2]), [13, 2], "13 goes out before the hurt status");
  for (const n of ["hit-mob-10102", "hit-player-no-village-10103", "hit-player-lethal-10104"]) assert.ok(!by["b100-m101-" + n].some((q) => q[2] === 13), n);
});

test("port: giveBirth bursts hearts on the child (the executed 12 of the newborn); updateTask's 1-in-35 roll stays on the mating villager", () => {
  const V = villageTasks({ Task, TargetBase: class extends Task {} });
  const calls = [], child = { type: "villager", growingAge: -24000 };
  const m = { e: { type: "villager", growingAge: 0 }, x: 1, z: 1, width: 0.6, height: 1.8, rand: { nextInt: () => 1 },
    ai: { ew: { spawnVillagerChild: () => child, villageBurst: (name, e, size) => calls.push([name, e, size]) }, size: () => ({ width: 0.3, height: 0.9 }) },
    lookHelper: { setLookPositionWithEntity() {} }, navigator: { tryMoveToEntityLiving() {} }, distSq: () => 0 };
  const task = new V.VillagerMate(m);
  task.mate = { e: { mating: true, growingAge: 0 } }; task.timer = 1;
  task.updateTask(); // timer 0 and the mate is mating: giveBirth; the roll nextInt(35) = 1 is not a heart
  assert.deepEqual(calls.map((c) => [c[0], c[1]]), [["heart", child]]);
  assert.deepEqual(calls[0][2], { width: 0.3, height: 0.9 }, "the child's own size");
  assert.deepEqual([m.e.growingAge, task.mate.e.growingAge], [6000, 6000]);
  m.rand = { nextInt: () => 0 }; task.timer = 50; calls.length = 0;
  task.updateTask();
  assert.deepEqual(calls.map((c) => [c[0], c[1]]), [["heart", m.e]], "the adult's roll");
});

test("port: 13 only for a player hit that leaves the villager alive in a village; 14 at the restock with a remembered buyer in a village (statuses reach S19)", () => {
  const s = sim("b101-villager");
  const ew = s.mobs.mobs, v = ew.create("villager", 66.5, 10, 64.5);
  ew.entities.push(v);
  s.tick();
  const brain = ew.ai.brain(v);
  const got = () => s.mobs.statuses.splice(0).map((q) => q.status);
  got();
  const noVillage = brain.village;
  ew.villagerHurtBy(v, { player: true });
  assert.deepEqual(got(), [], noVillage ? "has a village" : "no village: no 13");
  brain.village = { addOrRenewAggressor() {}, changeReputation() {} };
  ew.ai.player = ew.ai.player ?? { x: 64.5, y: 10, z: 64.5 };
  ew.villagerHurtBy(v, { shooter: null, attacker: null, player: false });
  assert.deepEqual(got(), [], "a mob or arrow: no 13");
  ew.villagerHurtBy(v, { player: true });
  assert.deepEqual(got(), [13]);
  v.health = 0;
  ew.villagerHurtBy(v, { player: true });
  assert.deepEqual(got(), [], "lethal: no 13 (executed hit-player-lethal)");
  const m = { e: v, village: { changeReputation() {} }, rand: new JavaRandom(1), ai: { ew, size: () => ({ width: 0.6, height: 1.8 }) } };
  v.health = 20; v.timeUntilReset = 1; v.needsInit = true; v.lastBuyer = "x"; v.offers ??= [];
  tickVillagerRestock(m);
  assert.deepEqual(got().filter((x) => x === 14), [14]);
});
