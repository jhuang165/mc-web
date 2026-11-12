// Batch 49 (dragonclient): the client Ender Dragon copy's crystal search (EntityDragon.updateDragonEnderCrystal, run by onLivingUpdate on both sides), replayed against the
// executed 1.7.10 classes (tools/probes/TrackerMountsProbe.java cases b49dc0..2 -> public/research/tracker-mounts-reference.json). The probe runs real server
// EntityEnderCrystal objects tracked at range 256, their client copies made from the S0E type 51 packet, S13 destroys, and the unchanged client EntityDragon. Per tick the
// record holds the copy's crystal target (index into the crystal list, -1 none), its health, ticksExisted, the draw count and last raw value of its Entity.rand, and every
// crystal copy's innerRotation. The living sound (RenderGlobal.playSound is empty in 1.7.10) is silent but its draws are in the count.
import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { MobTracker } from "./entity-tracker.js";
import { EntityWorld } from "./entities.js";
import { mountEntity } from "./mob-riding.js";
import { JavaRandom } from "./java-random.js";

const ref = JSON.parse(await readFile(new URL("../public/research/tracker-mounts-reference.json", import.meta.url), "utf8"));
const grass = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0 };
const SIZES = { zombie: [0.6, 1.8], ender_dragon: [16, 8], ender_crystal: [2, 2] };
const NAMES = ["b49dc0", "b49dc1", "b49dc2"];

function replay(name) {
  const record = ref.cases[name];
  const mk = (type, i) => ({ type, uuid: `u${i}`, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rotationYaw: 0, rotationPitch: 0, rotationYawHead: 0, renderYawOffset: 0, health: 10, onGround: true });
  const dragon = mk("ender_dragon", 0), zombie = mk("zombie", 1);
  const crystals = record.crystals.map(([x, y, z], k) => Object.assign(mk("ender_crystal", 2 + k), { x, y, z, onGround: false }));
  const tracker = new MobTracker(10);
  const host = { world: grass, size: (m) => SIZES[m.type] }, P = EntityWorld.prototype;
  const physics = Object.assign((c, e) => P.moveClient.call(host, c, e), { turn: (c, e) => P.clientAfterMove.call(host, c, e), pre: (c, e) => P.clientEnvironment.call(host, c, e) });
  const player = { x: 0.5, y: 0, z: 0.5 };
  const rows = [], first = new Map(), lastInner = new Map();
  let seeded = null, draws = 0, last = 0;
  record.inputs.forEach((inp, t) => {
    const [x, y, z, yaw, vx, vy, vz] = inp, [rx, ry, rz] = inp.slice(-3);
    Object.assign(dragon, { x, y, z, vx, vy, vz, rotationYaw: yaw, rotationYawHead: yaw, renderYawOffset: yaw, health: inp[14] });
    Object.assign(zombie, { x: rx, y: ry, z: rz });
    // a crystal that blew up this tick is gone from the world's list before the tracker runs (the probe: my.a() before the tick's sends, S13 handled in the same tick)
    const live = [dragon, zombie, ...crystals.filter((c, k) => !(record.crystals[k][3] >= 0 && t >= record.crystals[k][3]))];
    tracker.serverTick(live, player, (e) => SIZES[e.type]);
    const cm = tracker.clientIfTracked(dragon);
    if (cm?.dragon && !seeded) { // the probe seeds the copy's Entity.rand with 77 and counts its raw draws
      seeded = new JavaRandom(77);
      const next = seeded.next.bind(seeded);
      seeded.next = (bits) => { draws++; return (last = next(bits)); };
      cm.rand = seeded;
    }
    tracker.clientTick(physics);
    const want = record.dc[t], d = cm.dragon;
    const target = d.healer ? crystals.indexOf(tracker.liveOf(d.healer)) : -1;
    // each crystal copy's innerRotation relative to the constructor's roll (the roll itself is unseeded in Java and in the port): the ticks it has run
    const copies = crystals.map((c) => {
      const cc = tracker.clientIfTracked(c);
      if (cc && !first.has(c)) first.set(c, cc.innerRotation - 1); // the roll: the copy's first update already ran
      return [cc ? 1 : 0, first.has(c) ? (cc ? cc.innerRotation : lastInner.get(c)) - first.get(c) : -1];
    });
    crystals.forEach((c, k) => { if (copies[k][0]) lastInner.set(c, copies[k][1] + first.get(c)); });
    rows.push({ t, target, health: cm.health, aa: d.age, draws, last, copies });
    assert.equal(target, want[0], `${name} tick ${t}: crystal target`);
    assert.equal(cm.health, want[1], `${name} tick ${t}: health`);
    assert.equal(d.age, want[2], `${name} tick ${t}: ticksExisted`);
    assert.equal(draws, want[3], `${name} tick ${t}: draws of Entity.rand`);
    assert.equal(last, want[4], `${name} tick ${t}: last raw draw`);
  });
  // the crystal copies' innerRotation counts one a tick while they exist and freezes when the destroy removes them (executed: a is the copy's own field, K its isDead)
  const javaFirst = new Map();
  record.dc.forEach((w, t) => w[5].forEach((cw, k) => {
    if (cw[0] < 0) { assert.equal(rows[t].copies[k][0], 0, `${name} tick ${t}: crystal ${k} copy not there yet`); return; }
    if (!javaFirst.has(k)) javaFirst.set(k, cw[0] - 1);
    assert.equal(rows[t].copies[k][0], cw[1] ? 0 : 1, `${name} tick ${t}: crystal ${k} copy present (K ${cw[1]})`);
    assert.equal(rows[t].copies[k][1], cw[0] - javaFirst.get(k), `${name} tick ${t}: crystal ${k} innerRotation advance`);
  }));
  return rows;
}

for (const name of NAMES) {
  test(`client dragon copy ${name}: crystal target, healing and random stream match the executed classes`, () => {
    assert.equal(replay(name).length, 80);
  });
}

test("b49dc records exercise the search: nothing, a crystal that blows up, and a target that changes as the dragon flies", () => {
  const targets = (n) => ref.cases[n].dc.map((w) => w[0]);
  assert.ok(targets("b49dc0").every((v) => v === -1), "no crystals, no target");
  assert.ok(targets("b49dc1").includes(0) && targets("b49dc1").at(-1) === -1, "a target is found, then dropped after the crystal dies");
  const t2 = targets("b49dc2"), i0 = t2.indexOf(0), i1 = t2.indexOf(1);
  assert.ok(i0 >= 0 && i1 > i0, "the nearer crystal changes from 0 to 1 as the dragon flies on");
  const health = (n) => ref.cases[n].dc.map((w) => w[1]);
  assert.equal(health("b49dc0").at(-1), 150, "no crystal, no client healing");
  assert.ok(health("b49dc1").at(-1) > 150 && health("b49dc2").at(-1) > 150, "a target heals the client's own health by 1 every 10th tick");
});

test("the dragon is drawn with its own copy's crystal target, not the live dragon's", async () => {
  const src = await readFile(new URL("./dragon-renderer.js", import.meta.url), "utf8");
  assert.match(src, /const h = cd \? cd\.healer : s\.healer/);
});
