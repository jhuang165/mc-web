// b90 credit90: a dead body's TNT, arrows and punched fireballs, the click's look for digs and places, ownerless balls in the away run and the Java import.
// Bytecode-read (javap -c -p on the 1.7.10 jar): oi.a(mw, int, boolean) setDeads the old EntityPlayerMP; zc.c (arrow shooter), ze.a(ro, F) and the primed TNT keep that object.
//   sv.a(ro, F) sets aS / aR / revenge from ro.j() with no alive test; sv.C 465-505 drops a revenge target whose isEntityAlive is false at the mob's next update.
//   ej polls one queue in order: nh.a(jd) (C07) / nh.a(jo) (C08) read rotationYaw as the C03s sent before them left it. zj.a: causeThrownDamage(ball, getThrower()).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { langReady } from "./chat-component.js";
import { revengeOf, revengeBrain } from "./revenge-target.js";
import { NBT } from "./nbt.js";
import { javaProjectileFromNbt, javaProjectileToNbt } from "./java-projectiles.js";

await langReady;
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });

function server(names = ["Attacker", "Victim"]) {
  const world = new World("b90-credit");
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

test("credit90 (bytecode-read oi.a(mw, int, boolean), sv.C 465-505): a dead body's TNT leaves the mob a dead revenge target and the AI's player is the dead body", () => {
  const { sim, ps: [a] } = server(["Placer"]);
  const pig = sim.mobs.mobs.create("pig", 70.5, 10, 70.5); pig.health = 100; sim.mobs.mobs.entities.push(pig);
  a.position.copy({ x: 44.5, y: 10, z: 44.5 }); a.previous.copy(a.position);
  sim.dispense.prime(71.5, 11, 71.5, false, { fuse: 80, placer: a });
  const t = sim.dispense.primed.at(-1);
  kill(sim, a);
  assert.equal(t.placer.corpseOf, a);
  sim.mobs.explode({ x: t.x, y: t.y, z: t.z, size: 1, source: t });
  assert.equal(pig.revenge > 0, true, "the hit is a living source entity: setRevengeTarget runs");
  assert.equal(revengeBrain(sim.mobs.mobs.ai, pig), null, "the dead entity is dropped (it used to resolve to the live record's view)");
  assert.equal(revengeOf(pig).dead, true);
  assert.equal(sim.mobs.mobs.ai.player.alive, false, "ai.player is the dead body's view");
  assert.equal(sim.mobs.mobs.ai.player.x, 44.5);
});

test("credit90 (bytecode-read zc.c, ze.a(ro, F)): arrows in flight and punched fireballs keep the dead body after the respawn", () => {
  const { sim, ps: [p] } = server(["Archer"]);
  const arrows = sim.dispense.arrows;
  p.position.copy({ x: 50.5, y: 10, z: 50.5 }); p.previous.copy(p.position);
  const a = arrows.make({ x: 70.5, y: 12, z: 70.5, mx: 0, my: 0, mz: 1, yaw: 0, pitch: 0 }, arrows.rng(), { shooter: "player", pickup: 1, owner: p, ownerName: p.name });
  arrows.list.push(a);
  const ball = sim.mobs.mobs.fireballs.launch({ large: true, owner: null, x: 70.5, y: 12, z: 70.5, exact: [0, 0, 1] });
  ball.owner = "player"; ball.punchedBy = p;
  kill(sim, p);
  assert.equal(a.ownerBody.corpseOf, p);
  assert.deepEqual(a.ownerBody.position, { x: 50.5, y: 10, z: 50.5 }, "where the old body was removed");
  assert.equal(a.owner, p, "credit still goes to the record (shared StatisticsFile)");
  assert.equal(ball.punchedBy.corpseOf, p);
  const arrowAfter = arrows.make({ x: 70.5, y: 12, z: 70.5, mx: 0, my: 0, mz: 1, yaw: 0, pitch: 0 }, arrows.rng(), { shooter: "player", pickup: 1, owner: p, ownerName: p.name });
  assert.equal(arrowAfter.ownerBody, undefined, "an arrow shot by the new body is its own");
});

test("credit90 (bytecode-read nh.a(jd), nh.a(jo)): a queued dig or place reads the look it arrived with, and p.yaw is restored", () => {
  const { sim, ps: [p] } = server(["Digger"]);
  Object.assign(p, { yaw: 0, pitch: 0.25 });
  sim.queueDig("p0", 0); sim.queueEdit("p0", { place: true });
  Object.assign(p, { yaw: Math.PI, pitch: -0.5 }); // a later C03 of the same tick
  const seen = [];
  sim.handleDig = (q) => { seen.push([q.yaw, q.pitch]); return false; };
  sim.edit = (q) => { seen.push([q.yaw, q.pitch]); return false; };
  sim.tick();
  assert.deepEqual(seen, [[0, 0.25], [0, 0.25]]);
  assert.deepEqual([p.yaw, p.pitch], [Math.PI, -0.5]);
});

test("credit90 (bytecode-read zj.a, rq.j): an imported ownerless snowball is dispensed; a named one and the player's export keep the player", () => {
  const tag = (type, value) => ({ type, value });
  const entity = (owner) => new Map([["id", tag(NBT.STRING, "Snowball")], ["Pos", tag(NBT.LIST, { elementType: NBT.DOUBLE, items: [1, 2, 3] })], ["ownerName", tag(NBT.STRING, owner)]]);
  assert.equal(javaProjectileFromNbt(entity(""), {}).record.dispensed, true);
  assert.equal(javaProjectileFromNbt(entity("Steve"), {}).record.dispensed, undefined);
  assert.equal(javaProjectileToNbt("projectiles", { kind: "snowball" }).fields.ownerName.value, "Player", "a player's own ball is not ownerless after a round trip");
  assert.equal(javaProjectileToNbt("projectiles", { kind: "snowball", dispensed: true }).fields.ownerName.value, "");
});

test("credit90: the away run's dispensed balls are marked ownerless", () => {
  const src = fs.readFileSync(new URL("./away-world.js", import.meta.url), "utf8");
  assert.match(src, /thrown: \(kind, e\) => \{\s*if \(!ents\)[^\n]*\n\s*const ball = \{[^\n]*dispensed: true \}/);
});
