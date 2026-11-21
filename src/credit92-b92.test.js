// b92 credit92: a thrown ball keeps the EntityPlayerMP that threw it (zk.g, read through zk.j), also after respawnPlayer removed it.
// Bytecode-read (javap -c -p on the 1.7.10 jar):
//   zk.j (getThrower): returns the stored object; the name lookup only runs when the field is null (after a reload).
//   zj.a / zm.a (snowball, ender pearl onImpact): source = ro.a(ball, j()); the pearl teleports `(mw) j()` when its connection is open and mw.o == this.o, through sv.a(DDD) = nh.a(DDDFF), whose entity (nh.b) is the NEW player.
//   oi.a(mw, int, boolean): the old entity is removed and the new one takes its handler; the old one keeps its world and its death position.
//   sv.a(ro, F): the fall damage of the pearl on the old entity (health <= 0) is refused; the fall reset (sv.R) is the old one's.
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
  const world = new World("b92-credit");
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


test("credit92 (zk.j, zj.a): a dead thrower's snowball pushes the mob away from where the old body died and leaves the dead body as target", () => {
  const { sim, ps: [a] } = server();
  const ew = sim.mobs.mobs, d = sim.dispense;
  const pig = put(ew, "pigman", 70.5, 70.5);
  a.position.copy({ x: 44.5, y: 10, z: 44.5 }); a.previous.copy(a.position);
  const ball = d.balls.spawnThrowable({ x: 44.5, y: 10, z: 44.5 }, 0, 0, "snowball"); ball.thrower = a; ball.ownerName = a.name;
  kill(sim, a);
  assert.ok(ball.ownerBody, "leaveBody gave the ball its old thrower");
  assert.equal(ball.ownerBody.position.x, 44.5);
  const spawn = { x: a.position.x, z: a.position.z };
  ew.rand?.setSeed?.(1);
  d.ballHit(sim.mobs.mobs === ew ? sim.mobs.mobs : ew, pig, ball);
  const t = ew.silverfishState(pig).target;
  assert.ok(t && t.alive === false, "the dead body, not the respawned view");
  assert.notEqual(t, ew.ai.player);
  assert.ok(Math.abs(t.x - 44.5) < 1e-9 && Math.abs(t.x - spawn.x) > 1, "at the old body");
});

test("credit92 (zk.h): the new body is not the ball's thrower, so it is not skipped in the first five ticks", () => {
  const { sim, ps: [a] } = server();
  const d = sim.dispense, ball = d.balls.spawnThrowable({ x: 44.5, y: 10, z: 44.5 }, 0, 0, "snowball"); ball.thrower = a; ball.ownerName = a.name;
  const live = d.targets(d, ball).find(t => t.ref === a);
  assert.equal(live.thrower, true, "alive thrower: skipped");
  a.position.copy({ x: 44.5, y: 10, z: 44.5 });
  kill(sim, a);
  const after = d.targets(d, ball).find(t => t.ref === a);
  assert.ok(after && !after.thrower, "after the respawn the new entity is hittable by the old one's ball");
});

test("credit92 (zm.a, nh.a(DDDFF), sv.a): a dead thrower's pearl moves the new player and neither damages it nor resets its fall", () => {
  const { sim, ps: [a] } = server();
  const d = sim.dispense;
  const pearl = d.balls.throwEnderPearl({ x: 64.5, y: 10, z: 64.5 }, 0, 0); pearl.thrower = a; pearl.ownerName = a.name;
  kill(sim, a);
  a.fallDistance = 7;
  Object.assign(pearl, { x: 85.5, y: 10, z: 85.5 });
  const hp = a.survival.health;
  d.pearlImpact(d, { pearl, hit: null });
  assert.equal(a.position.x, 85.5, "teleported through the handler: the new entity");
  assert.equal(a.survival.health, hp, "the 5 damage went to the old entity");
  assert.equal(a.fallDistance, 7, "so did the fall reset");
});

test("credit92 (zm.a): a pearl of a living thrower still hurts it by 5 and resets the fall", () => {
  const { sim, ps: [a] } = server();
  const d = sim.dispense;
  const pearl = d.balls.throwEnderPearl({ x: 64.5, y: 10, z: 64.5 }, 0, 0); pearl.thrower = a; pearl.ownerName = a.name;
  a.fallDistance = 7; Object.assign(pearl, { x: 85.5, y: 10, z: 85.5 });
  const hp = a.survival.health;
  d.pearlImpact(d, { pearl, hit: null });
  assert.equal(a.position.x, 85.5);
  assert.equal(a.survival.health, hp - 5);
  assert.equal(a.fallDistance, 0);
});

const thornsZombie = (ew, x, z) => { const e = put(ew, "zombie", x, z); e.equipment = [null, null, null, { id: 307, count: 1, damage: 0, enchantments: [{ id: 7, lvl: 10 }] }, null]; return e; };

test("credit92 (zc.h 1065-1088, afv.a): a player's arrow that lands on a mob wearing Thorns hurts the shooter; a dead old body only hears the sound", () => {
  const { sim, ps: [a] } = server();
  const d = sim.dispense, ew = sim.mobs.mobs, z = thornsZombie(ew, 70.5, 70.5);
  const ctx = d.arrowCtx(d), arrow = () => ({ shooter: "player", owner: a, ownerName: a.name, x: 70.5, y: 11, z: 70.5, mx: 0, my: 0, mz: 0, fire: 0 });
  const hp = a.survival.health;
  assert.ok(d.arrows.damageTarget(arrow(), z, 2, ctx));
  assert.ok(a.survival.health < hp, "the shooter took thorns damage");
  d.fx.length = 0;
  const b = arrow(); a.position.copy({ x: 44.5, y: 10, z: 44.5 }); b.ownerBody = sim.serverSurvival.deadBody(a);
  const hp2 = a.survival.health; z.hurt = 0; z.health = 100;
  assert.ok(d.arrows.damageTarget(b, z, 2, ctx));
  assert.equal(a.survival.health, hp2, "the old body's damage is refused");
  const snd = d.fx.find(f => f.name === "damage.thorns");
  assert.ok(snd && snd.x === 44.5, "the sound is at the old body");
});

test("credit92 (zc.h 1065-1088): a mob's arrow on a Thorns mob hurts the shooting mob; a mob without equipment does nothing", () => {
  const { sim } = server();
  const d = sim.dispense, ew = sim.mobs.mobs, z = thornsZombie(ew, 70.5, 70.5), sk = put(ew, "skeleton", 75.5, 70.5), bare = put(ew, "zombie", 80.5, 80.5);
  const ctx = d.arrowCtx(d);
  const shot = (s) => ({ shooter: s, x: 70.5, y: 11, z: 70.5, mx: 0, my: 0, mz: 0, fire: 0 });
  const before = sk.health;
  assert.ok(d.arrows.damageTarget(shot(sk), z, 2, ctx));
  assert.ok(sk.health < before, "thorns hurt the skeleton");
  const hb = sk.health; bare.equipment = [null, null, null, null, null];
  d.arrows.damageTarget(shot(sk), bare, 2, ctx);
  assert.equal(sk.health, hb);
});

test("credit92 (single player ctx): the arrow's thorns reach ctx.survival through the player's position", () => {
  const { sim } = server();
  const d = sim.dispense, ew = sim.mobs.mobs, z = thornsZombie(ew, 70.5, 70.5);
  const dealt = [], survival = { damage: (n, name) => { dealt.push([n, name]); return true; } };
  d.arrows.damageTarget({ shooter: "player", x: 70.5, y: 11, z: 70.5, mx: 0, my: 0, mz: 0, fire: 0 }, z, 2, { mobs: ew, survival, player: { x: 60, y: 10, z: 60 } });
  assert.equal(dealt.length, 1);
  assert.equal(dealt[0][1], "thorns");
  assert.ok(d.arrows.events.some(e => e.sound === "damage.thorns" && e.position.x === 60));
});
