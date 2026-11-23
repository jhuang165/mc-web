// b98 horse98: the native packets of a mountEntity(null) on the dedicated server. Executed (tools/probes/Kill97Probe.java -Ddismount97=1, dismount97-reference.json): mw.a(sa) sends
// S08 (setPlayerLocation inside dismountEntity), S1B(0, player, -1), then S08 again; bytecode-read order yz.a(sa) S08, hx S1B, nh.a(DDDFF) S08.
import test from "node:test";
import assert from "node:assert/strict";
import { writePackets, CLIENTBOUND } from "./multiplayer/net-packet-ids.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { SADDLE } from "./pig-saddle.js";
import { makeSide } from "../tools/sweep-use75.mjs";

const input = (controls = {}) => ({ type: "input", controls: { ...IDLE_INPUT, ...controls }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
const sent = (p) => (p.dimOut ?? []).filter((m) => m.type === "dismount");

test("the dismount message is counted as S08, S1B, S08 in that order, 34 + 10 + 34 bytes", () => {
  assert.equal(CLIENTBOUND.dismount, 8);
  assert.deepEqual(writePackets({ type: "dismount", x: 1, y: 2, z: 3, vehicle: "c1" }, {}), [[8, 34], [27, 10], [8, 34]]);
});

test("a sneaking cart rider gets the S08 / S1B / S08 message at the spot it stands on", () => {
  const { s, p } = makeSide();
  const cart = s.vehicles.spawnVehicle("minecart", p.position.x, p.position.y, p.position.z);
  s.tick(); s.vehicles.queue("a", { v: `c${cart.id}`, hit: false }); s.tick();
  assert.ok(p.mount, "mounted");
  p.dimOut = null;
  s.input("a", input({ sneak: true }));
  const real = s.vehicles.dismount.bind(s.vehicles); let at = null;
  s.vehicles.dismount = (q, n) => { real(q, n); at = { x: q.position.x, y: q.position.y, z: q.position.z }; };
  s.tick();
  assert.equal(p.mount, null);
  const m = sent(p);
  assert.equal(m.length, 1, "one dismount message");
  assert.deepEqual({ x: m[0].x, y: m[0].y, z: m[0].z }, at, "it names the spot the player was put on");
});

test("a sneaking pig rider gets it too (the mob tick's riderSneakOff, then afterRiders)", () => {
  const { s, p } = makeSide();
  const e = s.mobs.mobs.create("pig", 66.5, 10, 64.5); e.saddled = true; s.mobs.mobs.entities.push(e);
  p.survival.inventory.main[0] = { id: SADDLE, count: 1, damage: 0 }; p.survival.inventory.current = 0;
  s.queueAnimUse("a", Number(String(e.id).replace(/^mob-/, "")), false); s.tick();
  assert.ok(p.mount?.mob === e, "mounted");
  for (let i = 0; i < 3; i++) s.tick();
  p.dimOut = null;
  s.input("a", input({ sneak: true })); s.tick();
  assert.equal(p.mount, null);
  assert.equal(sent(p).length, 1);
});

test("a mount that vanished (no mountEntity(null)) and a death release send no packets", () => {
  const { s, p } = makeSide();
  const cart = s.vehicles.spawnVehicle("minecart", p.position.x, p.position.y, p.position.z);
  s.tick(); s.vehicles.queue("a", { v: `c${cart.id}`, hit: false }); s.tick();
  assert.ok(p.mount);
  p.dimOut = null;
  s.vehicles.carts.carts.splice(s.vehicles.carts.carts.indexOf(cart), 1);
  s.tick();
  assert.equal(p.mount, null, "let go");
  assert.equal(sent(p).length, 0, "no S08 / S1B");
});

test("a stale released mark does not leak into a later vanished-mount let-go", () => {
  const { s, p } = makeSide();
  const cart = s.vehicles.spawnVehicle("minecart", p.position.x, p.position.y, p.position.z);
  s.tick(); s.vehicles.queue("a", { v: `c${cart.id}`, hit: false }); s.tick();
  p.mount.rider.released = { x: 0, y: 0, z: 0 };
  s.vehicles.dismount(p, true);
  assert.equal(p.mount, null);
  assert.equal(sent(p).length, 1);
  assert.ok(!p.dimOut.some((m) => m.type === "dismount" && m !== sent(p)[0]));
});

// ---- a pig or horse rider whose eyes are in water (Executed: tools/probes/Horse98Probe.java, public/research/horse98-reference.json: real wo / wi, mw rider, ahb world, block 9) ----
import { readFileSync } from "node:fs";
import { WATER } from "./world.js";
const ref = JSON.parse(readFileSync(new URL("../public/research/horse98-reference.json", import.meta.url), "utf8"));
const rec = (kind, name) => ref[kind].find((c) => c.name === name).ticks;
const firstOff = (t) => t.findIndex((x) => !x.linked);

test("reference: a rider is unlinked once its eyes (feet + 1.62) are under the surface, not before (pig seat 0.175, horse seat 0.7)", () => {
  for (const kind of ["pig", "horse"]) {
    assert.equal(firstOff(rec(kind, "dryControl")), -1, `${kind} dry: never`);
    assert.equal(firstOff(rec(kind, "oneStart")), -1, `${kind} 1 deep: eyes above the surface`);
    assert.equal(firstOff(rec(kind, "deepStart")), 0, `${kind} 4 deep: unlinked in the first tick`);
  }
  assert.equal(firstOff(rec("pig", "startInside")), 0, "pig, 2 deep: eyes at 1.795 under the surface 1.889");
  assert.equal(firstOff(rec("horse", "startInside")), -1, "horse, 2 deep: eyes at 2.32 above the surface");
  assert.equal(rec("pig", "dryControl")[0].rider[1].toFixed(3), "0.175");
});

const poolMob = (kind, depth) => {
  const { s, p } = makeSide();
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 10; y < 10 + depth; y++) s.world.put(x, y, z, WATER, 0, false);
  const e = s.mobs.mobs.create(kind, 66.5, 10, 64.5); e.saddled = true; s.mobs.mobs.entities.push(e);
  if (kind === "pig") { p.survival.inventory.main[0] = { id: SADDLE, count: 1, damage: 0 }; p.survival.inventory.current = 0; s.queueAnimUse("a", Number(String(e.id).replace(/^mob-/, "")), false); s.tick(); }
  return { s, p, e };
};

test("port, pig: eyes under water lets the rider off in the first tick (2 deep, like the real pig), eyes above keep it (1 deep), with the S08 / S1B / S08 message", () => {
  const one = poolMob("pig", 1);
  assert.ok(one.p.mount, "mounted in the 1-deep pool");
  for (let i = 0; i < 8; i++) one.s.tick();
  assert.ok(one.p.mount, "1 deep: still seated");
  assert.equal(sent(one.p).length, 0);
  const two = poolMob("pig", 2);
  assert.ok(two.p.mount || sent(two.p).length === 1, "mounted (or already off)");
  for (let i = 0; i < 3 && two.p.mount; i++) two.s.tick();
  assert.equal(two.p.mount, null, "2 deep: off within the first ticks");
  assert.equal(sent(two.p).length, 1, "one dismount message");
});

test("port, pig on dry ground: no dismount message while seated", () => {
  const { s, p } = poolMob("pig", 0);
  assert.ok(p.mount);
  for (let i = 0; i < 5; i++) s.tick();
  assert.ok(p.mount);
  assert.equal(sent(p).length, 0);
});
