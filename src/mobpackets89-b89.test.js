// Batch 89 mobpackets89: the mob tracker's S20 (entity properties) and S1D (entity effect) packets, the entry made at the spawn, and a skeleton's arrow updating in the pass it
// was shot in. See .shared-memory/notes/mobpackets89-b89-track.md.
// Bytecode-read (javap -c -p, 1.7.10 jar): EntityTrackerEntry.tryStartWachingThis (my.b(mw)): S0F, S1C, S20 il(id, tq.c()), S1B, S04, S1D in(id, rw) per sv.aQ() effect;
// sendLocationToAllClients (my.a(List)) calls func_111190_b (my.b()) inside its gated branch: S1C, then S20 of tq.b() (the dirty set), cleared after; SharedMonsterAttributes (yj):
// only maxHealth and movementSpeed are watched (horse.jumpStrength in wi); EntityLivingBase's potion callbacks (sv.a(rw), sv.a(rw, Z), sv.b(rw)) send nothing (EntityPlayerMP's
// overrides send S1D / S1E to the player itself). Executed: public/research/mobpackets89-reference.json (tools/probes/MobPackets89Probe.java).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { encodeAxis, sizeClass } from "./entity-tracker.js";
import { RemoteMobs } from "./multiplayer/remote-mobs.js";
import { EntityWorld } from "./entities.js";
import { EntityIds } from "./entity-ids.js";
import { addMobEffect, isInvisible } from "./mob-effects.js";
import { watchedAttributes, firstDirty } from "./mob-tracked-attributes.js";
import { effectPacket } from "./multiplayer/server-mob-entries.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/mobpackets89-reference.json", import.meta.url), "utf8"));
const wire = (rows) => JSON.parse(JSON.stringify(rows ?? []));
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function flat() {
  const w = new World("mobpackets89");
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) w.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  w.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return w;
}
const join = (s, id, n, x, z) => { const p = s.addPlayer(id, id + "x", key(n)); p.position.copy({ x, y: 10, z }); p.previous.copy(p.position); s.input(id, input()); return p; };
const take = (pl) => { const o = wire(pl.mobPackets); pl.mobPackets = null; return o; };
const server = () => {
  const s = new DedicatedSimulation({}, { world: flat(), gameMode: "creative", mobs: true });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  return s;
};
const wid = (m) => Number(String(m.id).replace("mob-", ""));
const mine = (list, i) => list.filter((x) => x.i === i);
const moves = (list) => list.filter((x) => x.type === "move" || x.type === "moveLook" || x.type === "teleport");
const names = (rows) => rows.map((r) => r.name).sort();
const PORT = { Bat: "bat", Blaze: "blaze", CaveSpider: "cave_spider", Chicken: "chicken", Cow: "cow", Creeper: "creeper", EnderDragon: "ender_dragon", Enderman: "enderman", EntityHorse: "horse",
  Ghast: "ghast", Giant: "giant", LavaSlime: "magma_cube", MushroomCow: "mooshroom", Ozelot: "ocelot", Pig: "pig", PigZombie: "pigman", Sheep: "sheep", Silverfish: "silverfish", Skeleton: "skeleton",
  Slime: "slime", SnowMan: "snow_golem", Spider: "spider", Squid: "squid", Villager: "villager", VillagerGolem: "iron_golem", Witch: "witch", WitherBoss: "wither", Wolf: "wolf", Zombie: "zombie" };
const factory = () => new EntityWorld(new World("mobpackets89f"), [], Math.random, new EntityIds());

// --- the reference: which attributes are watched, and what the first pass carries ---
test("reference: every living class watches maxHealth and movementSpeed (a horse also jumpStrength); none watches follow range, knockback, attack damage or reinforcements", () => {
  const dirty = ref.records.filter((r) => r.case === "dirty");
  assert.equal(dirty.length, 29);
  for (const r of dirty) {
    const watched = r.watched.map((w) => w.name).sort();
    assert.deepEqual(watched, r.id === "EntityHorse" ? ["generic.maxHealth", "generic.movementSpeed", "horse.jumpStrength"] : ["generic.maxHealth", "generic.movementSpeed"], r.id);
  }
});

test("the first pass's rows (firstDirty) are the native dirty set after the constructor and onSpawnWithEgg, for every probed class the port has", () => {
  const w = factory();
  for (const r of ref.records.filter((x) => x.case === "dirty")) {
    const type = PORT[r.id];
    assert.ok(type, r.id);
    const e = w.create(type, 0.5, 10, 0.5);
    const want = [...new Set([...r.made, ...(Array.isArray(r.egg) ? r.egg : [])])].sort();
    if (type === "zombie" && !(e.growingAge < 0)) assert.deepEqual(names(firstDirty(e, watchedAttributes(e))), r.made, "an adult zombie: its speed only");
    else assert.deepEqual(names(firstDirty(e, watchedAttributes(e))), want, r.id);
  }
});

test("the rows' values match the probed instances (classes with a fixed base); the effects' modifiers give the probed values", () => {
  const w = factory();
  const skip = new Set(["EntityHorse", "Slime", "LavaSlime", "Zombie", "WitherBoss"]); // random stats, sizes or a baby roll; the wither: see the note (the port's 0.6 is not (double)0.6F)
  for (const r of ref.records.filter((x) => x.case === "dirty" && !skip.has(x.id))) {
    const rows = watchedAttributes(w.create(PORT[r.id], 0.5, 10, 0.5));
    for (const n of r.watched) assert.equal(rows.find((x) => x.name === n.name)?.value, n.value, `${r.id} ${n.name}`);
  }
  const pig = ref.records.find((x) => x.case === "effect" && x.id === "Pig");
  const e = w.create("pig", 0.5, 10, 0.5);
  addMobEffect(e, 1, 900, 1); addMobEffect(e, 2, 600, 0); addMobEffect(e, 21, 600, 0);
  const rows = watchedAttributes(e);
  for (const n of pig.withEffects) {
    const row = rows.find((x) => x.name === n.name);
    assert.equal(row.value, n.value, n.name);
    assert.equal(row.base, n.base, n.name);
    assert.equal(row.mods.length, n.mods, n.name);
  }
  assert.deepEqual(pig.regen, [], "an effect without modifiers dirties nothing");
  assert.deepEqual(pig.again, ["generic.movementSpeed"], "native: the same Speed again re-applies the modifier (the port's change test does not see it: the note's follow-up)");
});

// --- S20 / S1D on the server ---
test("S20 at the spawn (every watched row, after the S1C), the first pass's dirty rows, then a Speed effect's row at the next gated pass; no S1D or S1E for a tracked mob", { timeout: 180000 }, () => {
  const s = server(), p = join(s, "p", 1, 64.5, 64.5);
  const m = s.mobs.mobs.create("pig", 66.5, 10, 70.5); s.mobs.mobs.entities.push(m);
  let first = null;
  for (let k = 0; k < 10 && !first; k++) { s.tick(); const b = mine(take(p), wid(m)); if (b.some((x) => x.type === "spawn")) first = b; }
  assert.ok(first);
  const types = first.map((x) => x.type);
  assert.deepEqual(types.slice(0, 3), ["spawn", "meta", "attributes"]);
  assert.deepEqual(names(first[2].list), ["generic.maxHealth", "generic.movementSpeed"]);
  assert.equal(first[2].list.find((r) => r.name === "generic.maxHealth").value, 10);
  const later = first.slice(3).filter((x) => x.type === "attributes");
  assert.equal(later.length, 1, "the first gated pass sends the construction's dirty set");
  assert.deepEqual(names(later[0].list), ["generic.maxHealth", "generic.movementSpeed"]);
  for (let k = 0; k < 6; k++) { s.tick(); assert.equal(mine(take(p), wid(m)).filter((x) => x.type === "attributes").length, 0, "no change, no S20"); }
  addMobEffect(m, 1, 600, 0);
  const got = [];
  for (let k = 0; k < 4; k++) { s.tick(); got.push(...mine(take(p), wid(m))); }
  const s20 = got.filter((x) => x.type === "attributes");
  assert.equal(s20.length, 1);
  assert.deepEqual(names(s20[0].list), ["generic.movementSpeed"]);
  assert.equal(s20[0].list[0].value, watchedAttributes(m).find((r) => r.name === "generic.movementSpeed").value);
  assert.ok(s20[0].list[0].value > 0.25);
  assert.equal(got.filter((x) => x.type === "effect").length, 0, "EntityLivingBase sends no S1D when an effect is added");
  assert.ok(got.some((x) => x.type === "meta" && x.potion > 0), "the colour (watcher 7) goes out as S1C");
});

test("a late viewer: S1D for each effect after the S04, in HashMap order; S20 with the modified value after the S1C", { timeout: 180000 }, () => {
  const s = server(), p = join(s, "p", 1, 64.5, 64.5);
  const m = s.mobs.mobs.create("skeleton", 66.5, 10, 70.5); s.mobs.mobs.entities.push(m);
  addMobEffect(m, 21, 600, 1); addMobEffect(m, 1, 40000, 0); addMobEffect(m, 14, 600, 0);
  for (let k = 0; k < 5; k++) { s.tick(); take(p); }
  const q = join(s, "q", 2, 66.5, 64.5);
  let first = null;
  for (let k = 0; k < 10 && !first; k++) { s.tick(); const b = mine(take(q), wid(m)); if (b.some((x) => x.type === "spawn")) first = b; }
  assert.ok(first);
  const types = first.map((x) => x.type), lastEq = types.lastIndexOf("equipment"), effects = first.filter((x) => x.type === "effect");
  assert.ok(types.indexOf("attributes") === 2 && types.indexOf("effect") > lastEq, types.join(","));
  assert.deepEqual(effects.map((x) => x.effect), [1, 21, 14], "HashMap<Integer> order: buckets id & 15 (21 sits in bucket 5)");
  assert.equal(effects[0].duration, 32767, "a duration above 32767 is clamped");
  const hp = first[2].list.find((r) => r.name === "generic.maxHealth");
  assert.equal(hp.value, 28, "20 + 4 x (amplifier + 1)");
  assert.deepEqual(effectPacket({ id: 1, amplifier: 255, duration: 40000 }), { type: "effect", effect: 1, amplifier: -1, duration: 32767 }, "bytes and a short as in(int, rw) writes them");
});

// --- the entry made at the spawn ---
test("a mob spawned before the pass: the S0F carries its spawn state, the first pass absorbs the first update's move (as my.a does), and its held slots go out again (the first update's equipment check)", { timeout: 180000 }, () => {
  const s = server(), p = join(s, "p", 1, 64.5, 64.5);
  for (let k = 0; k < 5; k++) { s.tick(); take(p); }
  const m = s.mobs.mobs.create("skeleton", 66.5, 10, 70.5); s.mobs.mobs.entities.push(m);
  const spawnX = m.x, tracker = s.mobs.tracker, bp = tracker.beforePass.bind(tracker), enc = (v) => encodeAxis(sizeClass(0.6), v);
  tracker.beforePass = () => { bp(); m.x += 2; tracker.beforePass = bp; }; // the mob's first update moves it (2 blocks: far over its own walk in these ticks)
  s.tick();
  const rows = mine(take(p), wid(m)), types = rows.map((x) => x.type);
  assert.deepEqual(types.slice(0, 3), ["spawn", "meta", "attributes"]);
  assert.equal(rows[0].x, enc(spawnX), "the spawn state (World.spawnEntityInWorld makes the entry before the update)");
  assert.equal(moves(rows).length, 0, "the entry's first pass (ticks 0) sends no position packet");
  // bytecode-read, my.a(List) 977..995: the last sent position is stored whenever `flag` holds (ticks % 60 == 0 at the first pass), outside the `ticks > 0` test of the packets,
  // so the first update's move is absorbed: the copy stays at the spawn position until the next move of 4 units or the 60-tick resend
  assert.equal(tracker.entries.get(m).entry.lastX, enc(m.x), "the first pass stores the live position without a packet");
  const eq = rows.filter((x) => x.type === "equipment").map((x) => [x.slot, x.item?.id ?? null]);
  assert.deepEqual(eq, [[0, m.equipment[0].id], [0, m.equipment[0].id]], "S04 of the spawn try, then the first update's check (EntityLivingBase.g starts empty)");
  const later = [];
  for (let k = 0; k < 4; k++) { s.tick(); later.push(...mine(take(p), wid(m))); }
  assert.ok(moves(later).every((x) => x.type !== "teleport" && Math.abs(x.dx ?? 0) < 24), `later moves are deltas from the stored live position: ${JSON.stringify(moves(later))}`);
  assert.equal(later.filter((x) => x.type === "equipment").length, 0);
});

test("a mob spawned during the pass (not updated yet in the port): its live state is the spawn state, and its first update's check sends the held slots at the next tick", { timeout: 180000 }, () => {
  const s = server(), p = join(s, "p", 1, 64.5, 64.5);
  for (let k = 0; k < 5; k++) { s.tick(); take(p); }
  let m = null;
  const mobs = s.mobs.mobs, tick = mobs.tick.bind(mobs);
  mobs.tick = (...a) => { const r = tick(...a); m = mobs.create("skeleton", 66.5, 10, 70.5); mobs.entities.push(m); mobs.tick = tick; return r; };
  s.tick();
  const rows = mine(take(p), wid(m));
  assert.equal(rows[0].type, "spawn");
  assert.equal(rows[0].x, encodeAxis(sizeClass(0.6), m.x));
  assert.equal(rows.filter((x) => x.type === "equipment").length, 1, "the spawn try's S04 only");
  s.tick();
  const next = mine(take(p), wid(m)).filter((x) => x.type === "equipment");
  assert.deepEqual(next.map((x) => [x.slot, x.item?.id ?? null]), [[0, m.equipment[0].id]], "the first update's check");
});

test("server-mobs gives the tracker the mob list for the births (one new line)", () => {
  const src = readFileSync(new URL("./multiplayer/server-mobs.js", import.meta.url), "utf8");
  assert.match(src, /\n\s*this\.tracker\.birthList = \(\) => this\.mobs\.entities;/);
});

// --- skeleton arrows ---
test("a skeleton's arrow has its first update in the pass it was shot in; its S0E carries the state at the shot, then the update's move", { timeout: 180000 }, () => {
  const s = server(), p = join(s, "p", 1, 64.5, 64.5);
  for (let k = 0; k < 5; k++) { s.tick(); take(p); p.dispOut = null; }
  const sk = s.mobs.mobs.create("skeleton", 66.5, 10, 70.5); s.mobs.mobs.entities.push(sk);
  s.tick(); take(p); p.dispOut = null;
  let arrow = null, shotAt = null;
  const mobs = s.mobs.mobs, tick = mobs.tick.bind(mobs);
  mobs.tick = (...a) => { const r = tick(...a); arrow = mobs.shoot(sk, { x: 64.5, y: 10, z: 60.5, height: 1.8 }, 1); shotAt = { x: arrow.x, y: arrow.y, z: arrow.z }; mobs.tick = tick; return r; };
  s.tick();
  assert.ok(arrow);
  assert.ok(Math.abs(arrow.z - shotAt.z) > 0.5, "the arrow moved in the pass it was shot in");
  const msgs = (p.dispOut ?? []).filter((x) => x.type === "dispEnts" && x.trk), row = msgs.flatMap((x) => x.trk).find((r) => r.k === "arrow");
  assert.ok(row, "the tracker row of the arrow");
  assert.equal(row.p[0].type, "spawn");
  assert.equal(row.p[0].z, Math.floor(shotAt.z * 32), "the S0E is the state at the shot (the entry is made at the spawn)");
  assert.ok(row.p.some((x) => x.type === "move" || x.type === "moveLook" || x.type === "teleport"), `then the update's move: ${JSON.stringify(row.p)}`);
});

// --- the client copy ---
test("the copy keeps the S20 rows and the S1D effects (counted down, never removed), draws the swirl of watcher 7, and hides on the invisible flag", () => {
  const world = flat(), parts = [], remote = new RemoteMobs(world, { particle: (...a) => parts.push(a) });
  remote.apply([{ type: "spawn", i: 7, mob: "pig", x: 64 * 32, y: 10 * 32, z: 64 * 32, yaw: 0, pitch: 0, head: 0, vx: 0, vy: 0, vz: 0, potion: 0x7cafc6 }]);
  remote.apply([{ type: "attributes", i: 7, list: [{ name: "generic.movementSpeed", base: 0.25, mods: [[0.2, 2]], value: 0.30000000298023224 }] }, { type: "effect", i: 7, effect: 1, amplifier: 0, duration: 3 }]);
  const c = remote.copies.get(7);
  assert.equal(c.client.attributes.get("generic.movementSpeed").value, 0.30000000298023224);
  for (let k = 0; k < 40; k++) remote.tick();
  assert.equal(c.client.effects.get(1).duration, 0, "counted down to 0 and kept");
  assert.ok(parts.length > 0 && parts.every((x) => x[0] === "mobSpell"), "the swirl reaches the game's particles");
  const [, , , , r, g, b] = parts[0];
  assert.deepEqual([r, g, b], [0x7c / 255, 0xaf / 255, 0xc6 / 255]);
  assert.equal(isInvisible(c.mob), false);
  remote.apply([{ type: "meta", i: 7, invisible: true }]);
  remote.tick();
  assert.equal(isInvisible(c.mob), true, "the renderer's test follows the watched flag");
});
