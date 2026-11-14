// Batch 68 summon2: /summon on the dedicated server takes native coordinates (End window origin), ignores the mob cap, the tracker view-distance clamp, the revenge target's liveness at the
// victim's tick. Native facts: .shared-memory/notes/summon2-b68-track.md (CommandSummon, EntityTracker/oi.d/mq.b bytecode-read).
import test from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { ServerSocial, chatDisplay } from "./server-broadcast.js";
import { langReady } from "./chat-component.js";
import { KillCredit } from "./multiplayer/server-combat-tracker.js";
import { trackerLimit, clampTrackRange } from "./ring-events.js";
import { TRACKER_LIMIT } from "./entity-tracker.js";
import { MOB_LIMIT } from "./multiplayer/server-mobs.js";
import { nativeOrigin, toLocal, toNative, SUMMON_HOSTS, UNKEPT_ENTITIES } from "./multiplayer/server-summon.js";
import { sendSpawnerFx } from "./multiplayer/server-spawners.js";

await langReady;
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const OK = "Object successfully summoned", FAILED = "Unable to summon object";
function fixture() {
  const world = new World("b68-summon2");
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 9; y <= 30; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const sim = new DedicatedSimulation({}, { world, mobs: true, gameMode: "creative" }), inbox = {};
  sim.mobs.mobs.entities.length = 0;
  const social = new ServerSocial({ simulation: sim, ops: ["Alex"], deliver: (id, m) => (inbox[id] ??= []).push(m) });
  const p = sim.addPlayer("a", "Alex", key(1)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position);
  const say = (line) => { inbox.a = []; social.command("a", line); return (inbox.a ?? []).filter((m) => m.type === "chat").map((m) => chatDisplay(m).unformatted()); };
  return { sim, p, say };
}

test("coordinate helpers: native = local + origin, the Overworld and the Nether have origin 0", () => {
  const end = { originX: -128, originZ: -128 }, legacy = { originX: -25, originZ: -96 };
  assert.deepEqual(nativeOrigin({}), { x: 0, z: 0 });
  assert.deepEqual(toLocal(end, 100.5, 0.5), [228.5, 128.5]);
  assert.deepEqual(toNative(end, 228.5, 128.5), [100.5, 0.5]);
  assert.deepEqual(toLocal(legacy, 0, 0), [25, 96]);
  assert.deepEqual(toLocal({ originX: 0, originZ: 0 }, 5, 6), [5, 6]);
});

test("Nether: native coordinates are the local ones and a position past the 128 window is out of the world", () => {
  const f = fixture(); f.sim.dimensions.arrive(f.p, -1, { at: { x: 64.5, y: 70, z: 64.5 } });
  const nm = () => f.sim.dimensions.nether.mobs.mobs.entities;
  nm().length = 0;
  assert.deepEqual(f.say("/summon Pig ~2 ~ ~"), [OK]);
  const pig = nm().find((e) => e.type === "pig");
  assert.ok(pig); assert.equal(pig.x, 66.5);
  assert.match(f.say("/summon Pig 500 70 5")[0], /out of the world|Cannot summon/i);
  assert.match(f.say("/summon Pig 5 300 5")[0], /out of the world|Cannot summon/i);
});

test("End: `~` is the native position, absolute native coordinates map into the shifted window, native out-of-window is refused", () => {
  const f = fixture(); f.sim.dimensions.arrive(f.p, 1);
  const w = f.p.world, em = () => f.sim.dimensions.end.n.mobs.mobs.entities;
  em().length = 0;
  assert.deepEqual([w.originX, w.originZ], [-128, -128]);
  // standing at native (100, 0): `~` is that cell, not the local (228.5, 128.5)
  assert.deepEqual(f.say("/summon Pig ~ ~ ~"), [OK]);
  const pig = em().find((e) => e.type === "pig");
  assert.deepEqual([pig.x, pig.z], [Math.floor(f.p.position.x) + 0.5, Math.floor(f.p.position.z) + 0.5], "the cell the player stands in");
  assert.deepEqual([pig.x - 128, pig.z - 128], [100.5, 0.5]);
  assert.deepEqual(f.say("/summon Cow 0 60 0"), [OK]);
  const cow = em().find((e) => e.type === "cow");
  assert.deepEqual([cow.x, cow.z], [128.5, 128.5], "native (0, 0) is the window's local (128, 128)");
  assert.deepEqual(f.say("/summon Pig ~-3 ~ ~4"), [OK]);
  const pig2 = em().filter((e) => e.type === "pig")[1];
  assert.deepEqual([pig2.x - pig.x, pig2.z - pig.z], [-3, 4]);
  // native x -129 and 128 are outside [-128, 127]; local-looking numbers (228) are far outside too
  assert.match(f.say("/summon Pig -129 60 0")[0], /out of the world|Cannot summon/i);
  assert.match(f.say("/summon Pig 128 60 0")[0], /out of the world|Cannot summon/i);
  assert.match(f.say("/summon Pig 0 60 228")[0], /out of the world|Cannot summon/i);
  assert.deepEqual(f.say("/summon Pig -128 60 127"), [OK]);
});

test("mobs past MOB_LIMIT are created (native /summon ignores the natural cap) and the tick's cull keeps them", { timeout: 120000 }, () => {
  const f = fixture();
  const list = f.sim.mobs.mobs.entities;
  for (let i = 0; i < MOB_LIMIT + 5; i++) assert.deepEqual(f.say("/summon Pig ~ ~ ~"), [OK]);
  assert.equal(list.length, MOB_LIMIT + 5);
  assert.ok(list.every((e) => e.summonKeep));
  for (let i = 0; i < 40; i++) f.sim.tick();
  assert.ok(list.filter((e) => e.type === "pig").length >= MOB_LIMIT + 5 - 2, "still there after the spawning pass (a few may have died or merged)");
});

test("a data tag: Health, CustomName, Equipment and a two-step Riding chain are applied on the server", () => {
  const f = fixture();
  assert.deepEqual(f.say('/summon Zombie ~ ~ ~ {Health:7,CustomName:"Bob",Equipment:[{id:276,Count:1},{},{},{},{id:298,Count:1}]}'), [OK]);
  const z = f.sim.mobs.mobs.entities.find((e) => e.type === "zombie");
  assert.equal(z.health, 7); assert.equal(z.customName, "Bob");
  assert.ok(JSON.stringify(z.equipment ?? z.gear ?? z).includes("276"), "the diamond sword is held");
  assert.deepEqual(f.say("/summon Skeleton ~ ~ ~ {Riding:{id:Spider,Riding:{id:Chicken}}}"), [OK]);
  const by = (t) => f.sim.mobs.mobs.entities.find((e) => e.type === t);
  assert.equal(by("skeleton").ridingEntity, by("spider"));
  assert.equal(by("spider").ridingEntity, by("chicken"));
});

test("hanging kinds are kept since mppaintings (b68 lead); the giant is still refused", () => {
  assert.deepEqual(SUMMON_HOSTS, []);
  assert.deepEqual([...UNKEPT_ENTITIES], []);
  const f = fixture(); assert.deepEqual(f.say("/summon Giant"), [FAILED]);
});

test("tracker view-distance clamp: limit = viewDistance * 16 - 16, read once; the spawner puff's square is clamped", () => {
  assert.equal(trackerLimit(10), 144); assert.equal(trackerLimit(3), 32); assert.equal(trackerLimit(15), 224);
  assert.equal(TRACKER_LIMIT, 144);
  assert.equal(clampTrackRange(160, 10), 144); assert.equal(clampTrackRange(80, 10), 80); assert.equal(clampTrackRange(80, 4), 48);
  assert.equal(clampTrackRange(256, 10), 144);
});

test("the revenge target is dropped by the victim's tick: an attacker that died before the victim's last tick gives no credit, one that dies after still does", () => {
  let dead = false; const player = { isPlayer: true, living: true, p: { id: "alex" }, alive: () => !dead };
  const k1 = new KillCredit(); k1.hit(player, 0, 10, true); dead = true; k1.tick(20); // victim ticked after the attacker died
  assert.equal(k1.killer(50, 0, false), null);
  dead = false; const k2 = new KillCredit(); k2.hit(player, 0, 10, true); k2.tick(20); dead = true; // attacker dies after the victim's last tick
  assert.equal(k2.killer(21, 0, false), player);
  const k3 = new KillCredit(); k3.hit(player, 0, 10, true); k3.tick(111); // older than 100 ticks
  assert.equal(k3.killer(112, 0, false), null);
  void sendSpawnerFx;
});
