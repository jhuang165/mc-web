// b91 credit91: what a dead body (the old EntityPlayerMP of a respawned player) does as an attacker, and the look of C02 / the bow release.
// Bytecode-read (javap -c -p on the 1.7.10 jar):
//   yg.a(ro, F) (EntityMob): entityToAttack (bm) = ro.j() unless it is this mob, its rider or its mount; no test of the attacker's life.
//   yh.a(ro, F) (EntityPigZombie): `ro.j() instanceof yz` (a dead EntityPlayer still is one) calls c(sa) on every pigman within 32 blocks and on itself; c(sa) stores bm and the anger.
//   yq.a(ro, F) (EntityZombie) 6-57: target = o() (attack target), else bT() (bm, just set), else ro.j() when it is an sv; the reinforcement gets d(target) with no life test.
//   td.bq 107-182: a legacy mob whose bm fails sa.Z() (isEntityAlive) sets bm = null at its next update.
//   zc.h 1065-1100: afv.a(victim, shooter) runs for any living shooter; the S2B (reason 6) goes when the hit entity is not the shooter OBJECT. agj.b plays damage.thorns at the attacker unconditionally.
//   ej polls one queue in order: nh.a(jo) (C02) and the C07 status 5 read rotationYaw as the C03s before them left it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { langReady } from "./chat-component.js";

await langReady;
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });

function server(names = ["Placer"]) {
  const world = new World("b91-credit");
  for (let x = 30; x <= 100; x++) for (let z = 30; z <= 100; z++) for (let y = 9; y <= 30; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const sim = new DedicatedSimulation({}, { world, mobs: true, gameMode: "survival" });
  sim.mobs.spawning = false; sim.mobs.mobs.entities.length = 0;
  const ps = names.map((name, i) => {
    const p = sim.addPlayer("p" + i, name, key(i + 1));
    p.position.copy({ x: 64.5 + i, y: 10, z: 64.5 }); p.previous.copy(p.position);
    sim.input("p" + i, input());
    return p;
  });
  for (let i = 0; i < 3; i++) sim.tick();
  for (const p of ps) p.survival.protection = 0;
  return { sim, ps };
}
const kill = (sim, p) => { sim.damagePlayer(p, 50, { name: "a fall" }); sim.serverSurvival.settle(p); sim.serverSurvival.respawn(p); };
const put = (ew, type, x, z) => { const e = ew.create(type, x, 10, z); e.health = 100; ew.entities.push(e); return e; };

test("credit91 (bytecode-read yg.a, yh.c, td.bq): a pigman hit by a dead body's TNT stores the dead body as its target, not the respawned view", () => {
  const { sim, ps: [a] } = server();
  const ew = sim.mobs.mobs;
  const pig = put(ew, "pigman", 70.5, 70.5), near = put(ew, "pigman", 72.5, 70.5);
  a.position.copy({ x: 44.5, y: 10, z: 44.5 }); a.previous.copy(a.position);
  sim.dispense.prime(71.5, 11, 71.5, false, { fuse: 80, placer: a });
  const t = sim.dispense.primed.at(-1);
  kill(sim, a);
  sim.mobs.explode({ x: t.x, y: t.y, z: t.z, size: 1, source: t });
  for (const e of [pig, near]) {
    assert.ok(e.angerLevel > 0, "yh.a still angers: the dead entity is a yz");
    const target = ew.silverfishState(e).target;
    assert.ok(target, "stored (no life test)");
    assert.equal(target.alive, false, "the old entity, which td.bq drops at the next update");
    assert.notEqual(target, ew.ai.player);
  }
});

test("credit91 (bytecode-read yq.a 6-57): a zombie hit by the dead body calls a reinforcement whose target is the dead body", () => {
  const { sim, ps: [a] } = server();
  const ew = sim.mobs.mobs;
  ew.difficulty = 3;
  const z = put(ew, "zombie", 70.5, 70.5);
  z.reinforcement = 1;
  let target;
  const make = ew.spawnNatural.bind(ew);
  ew.spawnNatural = (...args) => { const r = make(...args); target = r; return r; };
  ew.lightAt = () => 0;
  const before = ew.entities.length;
  for (let i = 0; i < 40 && ew.entities.length === before; i++) { z.hurt = 0; z.health = 100; ew.attackEntityFrom(z, 1, { player: true, deadAttacker: true, from: { x: 44.5, z: 44.5 }, name: "explosion" }); z.reinforcement = 1; }
  assert.ok(target, "a reinforcement was called");
  const got = ew.ai.brain(target).attackTarget;
  assert.ok(got, "setAttackTarget(dead entity)");
  assert.equal(got.alive, false);
  assert.notEqual(got, ew.ai.player);
});

test("credit91 (bytecode-read zc.h 1127-1163): the dead shooter's arrow on the respawned body is not a self hit: the shooter hears the hit sound, and Thorns roll on the old body", () => {
  const { sim, ps: [p] } = server(["Archer"]);
  const arrows = sim.dispense.arrows;
  const a = arrows.make({ x: 70.5, y: 12, z: 70.5, mx: 0, my: 0, mz: 1, yaw: 0, pitch: 0 }, arrows.rng(), { shooter: "player", pickup: 1, owner: p, ownerName: p.name });
  arrows.list.push(a);
  kill(sim, p);
  assert.ok(a.ownerBody);
  p.survival.protection = 0; p.soundsOut = [];
  const calls = [];
  p.survival.thorns = ({ hurt, sound }) => { calls.push("roll"); hurt(2); sound(); };
  const hp = p.survival.health, fx = sim.dispense.fx.length;
  assert.equal(sim.dispense.hitPlayer(a, p, 2, sim.mobs.mobs), true);
  assert.ok(p.survival.health < hp, "the hit lands");
  assert.equal(p.soundsOut.filter((s) => s.name === "random.successful_hit").length, 1, "S2B goes to the old EntityPlayerMP's connection");
  const sounds = sim.dispense.fx.slice(fx).filter((e) => e.name === "damage.thorns");
  assert.equal(calls.length, 1);
  assert.equal(sounds.length, 1, "damage.thorns at the attacker");
  assert.deepEqual([sounds[0].x, sounds[0].y, sounds[0].z], [a.ownerBody.position.x, a.ownerBody.position.y, a.ownerBody.position.z], "at the old body's position");
});

test("credit91: a live player's arrow on another player runs the victim's Thorns on the shooter", () => {
  const { sim, ps: [s, v] } = server(["Shooter", "Victim"]);
  const arrows = sim.dispense.arrows;
  const a = arrows.make({ x: 70.5, y: 12, z: 70.5, mx: 0, my: 0, mz: 1, yaw: 0, pitch: 0 }, arrows.rng(), { shooter: "player", pickup: 1, owner: s, ownerName: s.name });
  arrows.list.push(a);
  v.survival.thorns = ({ hurt, sound }) => { hurt(1); sound(); };
  const hp = s.survival.health;
  assert.equal(sim.dispense.hitPlayer(a, v, 2, sim.mobs.mobs), true);
  assert.ok(s.survival.health < hp, "the shooter took the thorns damage");
});

test("credit91 (bytecode-read EntityHanging.attackEntityFrom): the hanging host reads the old body's Creative flag, not the respawned record's", () => {
  const { sim, ps: [p] } = server(["Archer"]);
  const arrows = sim.dispense.arrows;
  const a = arrows.make({ x: 70.5, y: 12, z: 70.5, mx: 0, my: 0, mz: 1, yaw: 0, pitch: 0 }, arrows.rng(), { shooter: "player", pickup: 1, owner: p, ownerName: p.name });
  arrows.list.push(a);
  kill(sim, p);
  p.survival.mode = "creative"; assert.equal(p.survival.creative, true); // /gamemode after the respawn
  let flag;
  const lane = sim.dispense, host = { arrowHost: (c) => { flag = c; return null; } };
  lane.hangingOf = () => host;
  lane.tickArrow(lane, a, {});
  assert.equal(flag, false, "the body died in Survival");
});

test("credit91 (bytecode-read ej, nh.a(jo)): a queued attack, player attack and bow release read the look they arrived with, and p.yaw is restored", () => {
  const { sim, ps: [p] } = server(["Fighter"]);
  Object.assign(p, { yaw: 0.5, pitch: 0.25 });
  sim.queueAttack("p0", 1); sim.queuePvpAttack("p0", "nobody"); sim.queueUse("p0", false);
  Object.assign(p, { yaw: 2, pitch: -0.5 }); // a later C03 of the same tick
  const seen = [];
  sim.mobs.attack = (q) => seen.push(["attack", q.yaw, q.pitch]);
  sim.pvpRules.attack = (q) => seen.push(["pvp", q.yaw, q.pitch]);
  sim.handleUse = (q) => seen.push(["use", q.yaw, q.pitch]);
  sim.tick();
  assert.deepEqual(seen, [["attack", 0.5, 0.25], ["pvp", 0.5, 0.25], ["use", 0.5, 0.25]]);
  assert.deepEqual([p.yaw, p.pitch], [2, -0.5]);
});
