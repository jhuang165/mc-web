// Batch 81 mpcopies81: client copies. A revived wolf's copy (bone tame of a dying wolf), the dying dragon's frozen parts after the body rises
// (getMouseOver lists the parts only with the body: dragon-part-query.js), and the wither skull copy's angles (the tracker's S0E / S16 / S17 /
// S18 bytes and the copy's own EntityFireball turn: multiplayer/skull-look.js). No sockets, no browser.
import test from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { makeStack } from "./inventory.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { RemoteMobs } from "./multiplayer/remote-mobs.js";
import { RemoteDispense } from "./multiplayer/client-dispense.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { EntityWorld, entityHit, entityRandom, setEntityRandom } from "./entities.js";
import { Survival } from "./survival.js";
import { JavaRandom } from "./java-random.js";
import { spawnDragonIfAbsent, setDragonRandom } from "./dragon-mobs.js";
import { mouseOverBox, dragonListed } from "./dragon-part-query.js";
import { skullEntry, skullEntryTick, skullCopyLook, angleOfByte } from "./multiplayer/skull-look.js";
import { fireballTurn } from "./fireball-turn.js";

const BONE = 311, PORKCHOP = 319;
const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function fixture(name) {
  const world = new World(name);
  for (let x = 14; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 40; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: "survival", mobs: true });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  return s;
}
const join = (s, x = 64.5, z = 64.5) => { const p = s.addPlayer("a", "ax", key(1)); p.position.copy({ x, y: 10, z }); p.previous.copy(p.position); s.input("a", input()); s.tick(); p.dispOut = null; p.mobPackets = null; return p; };
const take = p => { const out = JSON.parse(JSON.stringify(p.mobPackets ?? [])); p.mobPackets = null; return out; };

// A dying wolf (health 0, deathTime counting) is clicked with a bone and the roll tames it: wv.a(yz) has no health test, setTamed then
// setHealth(20) revives it on the server (sv.g, bytecode-read), and the client copy follows its watcher 6 (S1C): EntityLivingBase.onEntityUpdate
// runs onDeathUpdate only while getHealth() <= 0, so the copy's deathTime stops where it was and the copy stays (it is never setDead:
// the 20-tick removal is inside onDeathUpdate). RendererLivingEntity tips a mob by its deathTime > 0, so the revived copy stays tipped.
test("revived wolf: the copy takes health 20 from S1C, keeps its frozen deathTime, stays in the world and draws the 7 hearts", () => {
  const s = fixture("mpcopies81-wolf"), p = join(s);
  const w = s.mobs.mobs.create("wolf", 66.5, 10, 64.5); s.mobs.mobs.entities.push(w);
  const fx = [], remote = new RemoteMobs(s.world, { particle: n => fx.push(n), sound: () => {} });
  const tick = () => { s.input("a", input()); s.tick(); const out = take(p); remote.apply(out); remote.tick(); return out; };
  for (let i = 0; i < 4; i++) tick();
  const id = Number(String(w.id).replace(/^mob-/, ""));
  assert.ok(remote.copies.has(id), "the copy is there");
  w.health = 0; w.death = 0;
  for (let i = 0; i < 6; i++) tick();
  const copy = remote.copies.get(id);
  assert.equal(copy.mob.health, 0);
  const dying = copy.mob.death;
  assert.ok(dying > 0 && dying < 20, `the copy is dying (${dying})`);
  p.survival.inventory.main[0] = makeStack(BONE, 4); p.survival.inventory.current = 0;
  const real = entityRandom(w);
  setEntityRandom(w, Object.assign(Object.create(real), { nextInt: n => (n === 3 ? 0 : real.nextInt(n)) })); // the 1 in 3 roll succeeds
  assert.ok(s.mobs.interact(p, id, false), "interact returns true on the corpse");
  setEntityRandom(w, real);
  assert.equal(w.health, 20, "setHealth(20) on the server");
  fx.length = 0;
  const sent = tick();
  const mine = sent.filter(m => m.i === id);
  assert.ok(mine.some(m => m.type === "state" && m.hp === 20 && m.tamed), `S1C with the health (${JSON.stringify(mine)})`);
  assert.ok(mine.some(m => m.type === "mobStatus" && m.status === 7), "S19 7");
  assert.equal(copy.mob.health, 20, "the copy's getHealth is the watcher's 20");
  assert.equal(fx.filter(n => (n.name ?? n.particle ?? n) === "heart" || JSON.stringify(n).includes("heart")).length, 7, "seven hearts on the copy");
  const frozen = copy.mob.death;
  for (let i = 0; i < 30; i++) tick();
  assert.ok(remote.copies.has(id), "the copy is never removed (no setDead at deathTime 20)");
  assert.equal(copy.mob.death, frozen, "onDeathUpdate stops: the deathTime stays");
  assert.ok(frozen > 0 && frozen < 20);
  assert.equal(copy.mob.health, 20);
});

// Feeding a tamed dying wolf: the meat is used (wv.a(yz)) but sv.f(F) heals nothing at health <= 0, so nothing new reaches the copy's
// watcher 6 and the copy goes on dying and leaves.
test("tamed wolf corpse fed meat: no health reaches the copy, which dies on and is removed", () => {
  const s = fixture("mpcopies81-feed"), p = join(s);
  const w = s.mobs.mobs.create("wolf", 66.5, 10, 64.5); s.mobs.mobs.entities.push(w);
  w.owner = "ax"; w.health = 8;
  const remote = new RemoteMobs(s.world, { particle: () => {}, sound: () => {} });
  const tick = () => { s.input("a", input()); s.tick(); const out = take(p); remote.apply(out); remote.tick(); return out; };
  for (let i = 0; i < 4; i++) tick();
  const id = Number(String(w.id).replace(/^mob-/, ""));
  w.health = 0; w.death = 0;
  for (let i = 0; i < 4; i++) tick();
  p.survival.inventory.main[0] = makeStack(PORKCHOP, 2); p.survival.inventory.current = 0;
  assert.ok(s.mobs.interact(p, id, false), "the click is used");
  assert.equal(p.survival.inventory.main[0]?.count, 1, "the meat is used");
  assert.equal(w.health, 0, "no heal");
  const sent = tick();
  assert.equal(sent.some(m => m.i === id && m.type === "state" && m.hp > 0), false, "no health on the wire");
  assert.equal(remote.copies.get(id)?.mob.health, 0);
  for (let i = 0; i < 25; i++) tick();
  assert.equal(remote.copies.has(id), false, "the corpse leaves (S13 after the server's deathTime 20)");
});

// ---- the dragon's parts and getMouseOver's query (blt.a(F), ahb.a(sa, azt, sj), apx.a(sa, azt, List, sj); bytecode-read)
const dragonAt = (x, y, z, part) => ({ type: "ender_dragon", x, y, z, health: 0, dragon: { bb: [x - 8, y, z - 8, x + 8, y + 8, z + 8], parts: [{ name: "head", box: part }] } });

test("query box: the player box from the eye, addCoord(look * reach), expand(1, 1, 1)", () => {
  const q = mouseOverBox({ x: 0.5, y: 11.62, z: 0.5 }, { x: 0, y: -1, z: 0 }, 3);
  assert.deepEqual(q.map(v => Math.round(v * 1e6) / 1e6), [-0.8, 6, -0.8, 1.8, 12.8, 1.8]);
});

test("parts are listed only with the body: its box must meet the query, in a listed chunk column and section", () => {
  const q = mouseOverBox({ x: 4.5, y: 21.62, z: 4.5 }, { x: 0, y: -1, z: 0 }, 3); // y 16..22.8, sections 0..1, columns -1..0
  assert.equal(dragonListed(dragonAt(4.5, 15, 4.5), q), true, "body y 15..23 in section 0");
  assert.equal(dragonListed(dragonAt(4.5, 23, 4.5), q), false, "the body risen above the query box");
  assert.equal(dragonListed(dragonAt(-12.5, 15, 4.5), q), false, "the body's box ends at -4.5: no overlap");
  const high = mouseOverBox({ x: 4.5, y: 37.62, z: 4.5 }, { x: 0, y: 1, z: 0 }, 3); // y 35..42.8: sections 2..2
  assert.equal(dragonListed(dragonAt(4.5, 31, 4.5), high), false, "the body (31..39) meets the box, but stands in section 1, which the query skips");
  assert.equal(dragonListed(dragonAt(4.5, 32, 4.5), high), true, "section 2");
  const west = mouseOverBox({ x: 1.5, y: 21.62, z: 4.5 }, { x: 1, y: 0, z: 0 }, 3); // x 0.2..5.8, y 19..22.8: columns -1..0, section 1
  assert.equal(dragonListed(dragonAt(-1, 17, 4.5), west), true, "column -1 is walked (minX - 2 < 0)");
  const far = mouseOverBox({ x: 6.5, y: 21.62, z: 4.5 }, { x: 1, y: 0, z: 0 }, 3); // x 5.2..10.8: columns 0..0
  assert.equal(dragonListed(dragonAt(-1, 17, 4.5), far), false, "the body (x -9..7) meets the box but stands in column -1, which the query skips");
  assert.equal(dragonListed({ type: "ender_dragon", dragon: { parts: [] } }, q), true, "no body box: not gated");
});

test("multiplayer: the dying dragon copy's frozen head is picked until the risen body leaves the query (full reach 3 or 6)", () => {
  const remote = new RemoteMobs({ get: () => 0 }, {});
  const mob = dragonAt(4.5, 15, 4.5, [4, 18, 4, 5, 19, 5]);
  remote.copies.set(9, { mob });
  const eye = { x: 4.5, y: 21.62, z: 4.5 }, down = { x: 0, y: -1, z: 0 };
  assert.equal(remote.pick(eye, down, 3, 3)?.entity, mob, "picked while the body meets the box");
  for (let i = 0; i < 80; i++) { const b = mob.dragon.bb; b[1] += 0.1; b[4] += 0.1; } // the death's moveEntity(0, 0.1, 0), parts frozen
  assert.ok(entityHit(eye, down, mob, 3) > 0, "the ray still reaches the frozen head");
  assert.equal(remote.pick(eye, down, 3, 3), null, "the body (23..31) is above the query: the parts are not listed");
  assert.equal(remote.pick(eye, down, 3, 6), null, "creative's reach 6 stretches the query down, not up: the body is still above");
  const up = { x: 0, y: 1, z: 0 }, under = { x: 4.5, y: 16.62, z: 4.5 }; // looking up at the head from below: the query reaches 3 or 6 up
  mob.dragon.parts[0].box = [4, 19, 4, 5, 20, 5]; mob.dragon.bb = [-3.5, 22.5, -3.5, 12.5, 30.5, 12.5];
  assert.equal(remote.pick(under, up, 3, 3), null, "reach 3: the query tops out at 21.8, under the body");
  assert.equal(remote.pick(under, up, 3, 6)?.entity, mob, "reach 6 (the 4th argument main.js passes, not the block-cut reach): the query meets the body");
});

test("single player: a dying dragon's parts stop being aimed at once its body rises out of getMouseOver's query", () => {
  const cells = new Map();
  const world = { numericSeed: 1, solid: () => false, surface: () => 0, spawn: () => ({ x: 0, y: 64, z: 0 }), get: (x, y, z) => cells.get(`${x},${y},${z}`) ?? 0, getMeta: () => 0,
    set(x, y, z, id) { cells.set(`${x},${y},${z}`, id); return true; }, inside: () => true, streaming: true, isTicking: () => true, height: 256 };
  const w = new EntityWorld(world, [], () => 0.5), d = spawnDragonIfAbsent(world, w), s = new Survival({}), player = { x: 200, y: 70, z: 200, alive: true, width: 0.6, height: 1.8, eyeHeight: 1.62 };
  setDragonRandom(d, new JavaRandom(7));
  w.tick(player, s);
  d.health = 0;
  w.tick(player, s);
  const head = d.dragon.parts[0], box = [...head.box];
  const c = { x: (box[0] + box[3]) / 2, y: box[4], z: (box[2] + box[5]) / 2 };
  const eye = { x: c.x, y: c.y + 2, z: c.z }, down = { x: 0, y: -1, z: 0 }, q = mouseOverBox(eye, down, 3);
  let seen = 0, lost = -1;
  for (let i = 0; i < 190 && lost < 0; i++) {
    const listed = dragonListed(d, q), hit = w.pick(eye, down, 3)?.entity === d;
    assert.deepEqual([...head.box], box, "the parts stay put");
    assert.ok(entityHit(eye, down, d, 3) > 0);
    assert.equal(hit, listed, `tick ${i}: picked exactly while the body is listed`);
    if (hit) seen++; else lost = i;
    w.tick(player, s);
  }
  assert.ok(seen > 0, "the frozen head is picked at first");
  assert.ok(lost > 0, "and lost once the body has risen");
  assert.ok(d.dragon.bb[1] >= q[4] || !dragonListed(d, q));
});

// ---- the wither skull copy's angles
test("skull tracker entry: frequency 10, no packet at its first update, look at 4 byte steps, a teleport with the angles after 400 updates", () => {
  const b = { x: 10, y: 20, z: 30, yaw: 30, pitch: 10 }, t = skullEntry(b);
  assert.deepEqual([t.yaw, t.pitch, t.spawn.yb, t.spawn.pb], [21, 7, 21, 7], "floor(angle * 256 / 360)");
  b.yaw = 90;
  assert.equal(skullEntryTick(t, b), false, "m = 0: no packet (the last look moves though)");
  assert.equal(t.yaw, 64);
  b.yaw = 100; // byte 71: |71 - 64| >= 4
  for (let i = 1; i < 10; i++) assert.equal(skullEntryTick(t, b), false, `tick ${i}: off the beat`);
  assert.equal(skullEntryTick(t, b), true, "tick 10: S16 / S17");
  b.yaw = 102; // byte 72: under 4
  for (let i = 11; i < 20; i++) skullEntryTick(t, b);
  assert.equal(skullEntryTick(t, b), false, "a 1 byte change sends no look (S15 or nothing)");
  assert.equal(t.yaw, 71, "the last yaw moves only with a look");
  const u = skullEntry({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }), still = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
  let sent = [];
  for (let i = 0; i <= 4020; i++) if (skullEntryTick(u, still)) sent.push(i);
  assert.deepEqual(sent, [4000], "the 401st update (v > 400): an S18, which always carries the angles");
  const jump = skullEntry({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }), far = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
  skullEntryTick(jump, far);
  far.x = 5; // 160 units: out of a byte
  sent = [];
  for (let i = 1; i <= 10; i++) if (skullEntryTick(jump, far)) sent.push(i);
  assert.deepEqual(sent, [10], "a long move: S18 with the angles");
});

test("skull copy: S0E bytes with prev 0, its own turn from motion 0, then the look packet's angles", () => {
  const row = { x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0, blue: false };
  skullCopyLook(row, { yb: 21, pb: 7, a8: [0, 0, -800] }, true);
  assert.deepEqual([row.prevYaw, row.prevPitch], [0, 0], "handleSpawnObject sets only rotationYaw / rotationPitch");
  assert.equal(row.yaw, angleOfByte(21));
  assert.equal(row.pitch, angleOfByte(7));
  const spawnYaw = row.yaw, spawnPitch = row.pitch;
  skullCopyLook(row, { yb: 21, pb: 7 }, false);
  const ref = fireballTurn({ prevYaw: spawnYaw, prevPitch: spawnPitch }, 0, 0, 0);
  assert.deepEqual([row.yaw, row.pitch], [ref.yaw, ref.pitch], "the first client tick turns toward motion 0 (data 0: no setVelocity)");
  const m1 = row.look.m.slice();
  assert.ok(Math.abs(m1[2] + 0.095) < 1e-7 && m1[0] === 0 && m1[1] === 0, "then motion = (0 + acceleration) * 0.95");
  const before = [row.yaw, row.pitch];
  skullCopyLook(row, { yb: 0, pb: 0, look: 1, lyb: -14, lpb: 4 }, false);
  assert.deepEqual([row.prevYaw, row.prevPitch], before, "prev is the angles before this tick");
  assert.equal(row.yaw, Math.fround(angleOfByte(-14) % 360), "S17's yaw replaces the turned value (packets after the entities)");
  assert.equal(row.pitch, angleOfByte(4));
});

test("server to client: the first skull row carries the spawn angles, look only on the 10-tick beat, and the copy follows", () => {
  const s = fixture("mpcopies81-skull"), p = join(s, 40.5, 40.5);
  const wither = s.mobs.mobs.create("wither", 64.5, 10, 100.5); s.mobs.mobs.entities.push(wither);
  wither.rotationYaw = 30; wither.rotationPitch = 10;
  const b = s.mobs.mobs.skulls.launch({ owner: wither, x: 64.5, y: 20, z: 90, dx: -10, dy: -3, dz: -20 });
  const remote = new RemoteDispense({});
  const rows = [], copies = [];
  for (let i = 0; i < 25; i++) {
    s.input("a", input()); s.tick();
    const ents = (p.dispOut ?? []).splice(0).find(m => m.type === "dispEnts")?.ents ?? [];
    remote.ents(JSON.parse(JSON.stringify(ents)));
    const d = ents.find(e => e.kind === "witherSkull" && !b.dead);
    if (!d) break;
    rows.push(d);
    const row = [...remote.rows.values()].find(r => r.kind === "witherSkull");
    copies.push({ yaw: row.yaw, pitch: row.pitch, prevYaw: row.prevYaw });
  }
  assert.ok(rows.length >= 21, `the skull flew (${rows.length})`);
  assert.deepEqual([rows[0].yb, rows[0].pb], [21, 7], "the S0E of trackEntity: the shooter's angles before the first turn");
  assert.deepEqual([copies[0].prevYaw, copies[0].yaw], [0, angleOfByte(21)]);
  // b82 mpball82: the burning flag (watched flag 0) turns on in the skull's second update, so the entry's ticks 1 runs the location block off the beat as well
  // (DataWatcher.hasObjectChanged; executed, tools/probes/BallFlagProbe.java). Batch 81 expected [10, 20] (it took the skull's watcher as constant).
  assert.deepEqual(rows.map((r, i) => (r.look ? i : -1)).filter(i => i >= 0), [1, 10, 20], "the entry's ticks 1 (the flag's S1C), 10 and 20 (it was made in the launch tick)");
  assert.deepEqual(rows[1].t.p.filter(q => q.type === "meta"), [{ type: "meta", f: 1 }], "the S1C after the look packet");
  for (const i of [1, 10, 20]) assert.equal(copies[i].yaw, Math.fround(angleOfByte(rows[i].lyb) % 360), `tick ${i}: the copy takes the packet's yaw`);
  assert.ok(rows.every(r => r.a8?.length === 3 && r.a8.every(Number.isInteger)), "the speed fields");
});
