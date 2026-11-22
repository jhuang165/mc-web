// b96 horse96: (1) a lead pulling a ridden horse and (2) a killed player rider, pinned to executed records of the real 1.7.10 classes
// (public/research/horse96-reference.json from tools/probes/Horse96Probe.java, kill96-reference.json from Kill96Probe.java).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EntityWorld, setEntityRandom } from "./entities.js";
import { Survival } from "./survival.js";
import { JavaRandom } from "./lighting.js";
import { decayRideInput, applyRide, takeRideOrQueue } from "./multiplayer/server-vehicles.js";
import { makeSide, spawn, serverClick } from "../tools/sweep-use75.mjs";

const load = (n) => JSON.parse(readFileSync(new URL(`../public/research/${n}`, import.meta.url), "utf8"));
const lead = load("horse96-reference.json"), kill = load("kill96-reference.json");
const sc = (name) => lead.scenarios.find((s) => s.name === name);
const KNOT = { knotWalkAway: 58, knotIdleStart8: 56, knotIdleStart11: 53, knotWalkTowards: 78 };
const T = 0.002;

// ---- 1. the leash pull of a ridden horse (td.bL) ----
const blocks = new Map();
const flat = () => { const solid = (x, y, z) => y < 0; return { numericSeed: 1, solid, get: (x, y, z) => (solid(x, y, z) ? 1 : blocks.get(x + "," + y + "," + z) ?? 0), getMeta: () => 0, surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) }; };
function single(name) {
  const ref = sc(name); blocks.clear();
  const kz = KNOT[name]; if (kz != null) blocks.set(`64,0,${kz}`, 85);
  const w = new EntityWorld(flat(), [{ id: "mob-1", type: "horse", x: 64, y: 0, z: 64, health: 53, horse: { type: 0, tame: true, saddled: true, owner: "player", speed: ref.speed, jump: ref.jumpAttr, maxHealth: 53 } }], () => 0.5);
  const h = w.entities[0]; setEntityRandom(h, new JavaRandom(1));
  Object.assign(h, { vx: 0, vy: 0, vz: 0, onGround: true, aiMoveSpeed: 0, rotationYaw: 0 });
  const p = { player: true, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, moveForward: 0, moveStrafing: 0, fallDistance: 0, vehicle: null };
  w.horseSeats.mount(h, p);
  if (kz != null) { w.knotCreate(64, 0, kz); w.setLeash(h, { knot: { x: 64, y: 0, z: kz } }); }
  if (name === "riderHolds") w.setLeash(h, { holder: "player" });
  const surv = new Survival({}), rows = [];
  for (let i = 0; i < ref.ticks.length; i++) {
    const fw = ref.ticks[i].readForward, pp = { mount: { rider: p } };
    takeRideOrQueue({ actions: [] }, pp, "a", fw ? { s: 0, f: fw, j: false, k: false } : null);
    if (pp.ride) applyRide(p, pp.ride);
    w.tick(name === "riderHolds" ? { x: h.x, y: h.y + 2.32, z: h.z } : { x: 64, y: 0, z: 90 }, surv);
    rows.push({ leashed: !!h.leash, z: h.z, linked: !!h.rider });
  }
  return { ref, rows };
}
for (const name of ["noLeashControl", "knotWalkAway", "knotWalkTowards", "knotIdleStart8", "knotIdleStart11", "riderHolds"]) {
  test(`single player: ${name} matches the executed td.bL record tick by tick (leash state, rider kept, z)`, () => {
    const { ref, rows } = single(name);
    ref.ticks.forEach((t, i) => {
      assert.equal(rows[i].leashed, t.leashed, `leashed tick ${i}`);
      assert.equal(rows[i].linked, t.linked, `rider kept tick ${i}`);
      assert.ok(Math.abs(rows[i].z - t.horse[2]) < T, `z tick ${i}: ${rows[i].z} vs ${t.horse[2]}`);
    });
  });
}
test("the reference itself: a knot 11 blocks away breaks at once, 8 blocks pulls without breaking, the rider stays on either way", () => {
  assert.equal(sc("knotIdleStart11").ticks[0].leashed, false);
  assert.equal(sc("knotIdleStart8").ticks.at(-1).leashed, true);
  for (const s of lead.scenarios) assert.ok(s.ticks.every((t) => t.linked), `${s.name} keeps its rider`);
});

const horseSide = (name) => {
  const side = makeSide(), e = spawn(side, "horse"), sp = sc(name);
  e.horse.tame = true; e.horse.saddled = true; e.horse.speed = sp.speed; e.horse.jump = sp.jumpAttr; e.health = 30; e.growingAge = 0; e.onGround = true;
  e.x = 64; e.z = 64; e.y = 10;
  side.p.survival.inventory.main[0] = null;
  serverClick(side, e);
  return { side, e, sp };
};
for (const name of ["knotIdleStart8", "knotIdleStart11"]) {
  test(`dedicated server: ${name} matches the executed record (leash state, z, rider kept)`, () => {
    const { side, e, sp } = horseSide(name), m = side.s.mobs.mobs, kz = KNOT[name];
    m.knotCreate(64, 10, kz); m.setLeash(e, { knot: { x: 64, y: 10, z: kz } });
    sp.ticks.forEach((t, i) => {
      side.s.tick();
      assert.equal(!!e.leash, t.leashed, `leashed tick ${i}`);
      assert.ok(side.p.mount && e.rider, `rider kept tick ${i}`);
      assert.ok(Math.abs(e.z - 64 - (t.horse[2] - 64)) < T, `z tick ${i}`);
    });
  });
}
test("dedicated server: the break (knot 11 blocks away) sends S1B(1, horse, null) in the tick it breaks and the rider keeps the seat", () => {
  const { side, e } = horseSide("knotIdleStart11"), m = side.s.mobs.mobs;
  m.knotCreate(64, 10, 53); m.setLeash(e, { knot: { x: 64, y: 10, z: 53 } });
  side.p.mobPackets = null;
  side.s.tick();
  const out = JSON.parse(JSON.stringify(side.p.mobPackets ?? []));
  const off = out.filter((x) => x.type === "attach" && x.mode === 1).at(-1); // the first S1B is the leash being tied (setLeash), the last one the break
  assert.ok(off && off.holder === null, "lead off on the wire");
  assert.ok(side.p.mount && e.rider);
});

// ---- 2. /kill on a riding player: native keeps the link until deathTime 20 (+1 tick), no dismount teleport ----
const killSide = () => {
  const { side, e } = horseSide("noLeashControl");
  assert.ok(side.p.mount && e.rider);
  return { side, e };
};
const kc = (mount, variant) => kill.cases.find((c) => c.mount === mount && c.variant === variant);
test("the kill reference: the rider stays linked at deathTime 20 and is unlinked the tick after, without moving", () => {
  for (const mount of ["horse", "pig"]) {
    const rows = kc(mount, 0).rows.filter((r) => r.t != null);
    const at20 = rows.find((r) => r.deathTime === 20), i = rows.indexOf(at20);
    assert.ok(at20.riding && at20.playerDead, "still riding when deathTime reaches 20");
    assert.ok(!rows[i + 1].riding, "unlinked the next tick");
    assert.equal(rows[i + 1].player[1], at20.player[1], "no teleport");
    assert.ok(rows.slice(0, i + 1).every((r) => r.riding), "linked through the whole animation");
  }
});
test("dedicated server: a killed rider stays on the horse through the 20-tick death animation, is released the tick after, and does not move", () => {
  const { side, e } = killSide();
  side.s.damagePlayer(side.p, 50, { name: "/kill" });
  const ys = [];
  for (let i = 0; i < 40; i++) {
    side.s.tick();
    const dt = side.p.deathTime ?? 0;
    if (dt <= 20) assert.ok(side.p.mount && e.rider, `linked at deathTime ${dt} (tick ${i})`);
    ys.push(side.p.position.y);
  }
  assert.equal(side.p.mount, null, "released after the animation");
  assert.equal(e.rider, null);
  assert.equal(side.p.position.y, ys[ys.length - 1]);
});
test("dedicated server: the respawn unlinks a dead rider at once; the new player is at the spawn, not on the mount", () => {
  const { side, e } = killSide();
  side.s.damagePlayer(side.p, 50, { name: "/kill" });
  for (let i = 0; i < 5; i++) side.s.tick();
  assert.ok(side.p.mount, "still seated mid animation");
  side.s.serverSurvival.settle(side.p); side.s.serverSurvival.respawn(side.p);
  assert.equal(side.p.mount, null);
  assert.equal(e.rider, null);
  side.s.tick();
  assert.equal(side.p.mount, null);
});

// ---- 3. a player on a saddled pig with the eyes in water (Port-read: sv.C's water branch has no EntityHorse test, `ridingEntity instanceof EntityLivingBase`) ----
import { WATER } from "./world.js";
test("dedicated server: a player on a saddled pig is let go in water (4 cells deep) and stays on it in 1 cell (the pig seat eye is about 11.8)", () => {
  for (const [top, stays] of [[13, false], [10, true]]) {
    const side = makeSide(), e = spawn(side, "pig");
    e.saddled = true; e.growingAge = 0; e.onGround = true; e.health = 10; e.x = 64.5; e.z = 64.5; e.y = 10;
    for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 10; y <= top; y++) side.s.world.put(x, y, z, WATER, 0, false);
    side.p.survival.inventory.main[0] = null;
    serverClick(side, e);
    assert.ok(side.p.mount, "mounted");
    for (let i = 0; i < 4; i++) side.s.tick();
    assert.equal(!!side.p.mount, stays, `top ${top}`);
  }
});
