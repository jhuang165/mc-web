import test from "node:test";
import assert from "node:assert/strict";
import reference from "../public/research/ender-pearl-reference.json" with { type: "json" };
import { GaussianRandom, heading } from "./projectiles.js";
import { ENDER_PEARL, impactEnderPearl, launchEnderPearl, serializeEnderPearl } from "./ender-pearl.js";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test("native constructor and heading records replay through the shared throwable math", () => {
  for (const c of reference.cases) {
    const h = heading(new GaussianRandom(Number(c.seed)), 0, 0, 1, 1.5, 1);
    near(h.mx, c.mx); near(h.my, c.my); near(h.mz, c.mz);
    near(h.yaw, c.yaw); near(h.pitch, c.pitch);
  }
});

test("native impact particle draws replay in order, including hit-before-particle and side dead gates", () => {
  const seeds = { "server-no-owner": 11, "client-hit": 12, "server-hit": 13 };
  for (const c of reference.impactCases) {
    const world = { remote: c.remote }, hit = c.hit ? {} : null, particles = [];
    const pearl = { x: 10, y: 20, z: 30, dead: false, random: new GaussianRandom(seeds[c.case]) };
    impactEnderPearl(pearl, { world, hit }, {
      hit: () => {}, particle: p => particles.push(p),
    });
    assert.equal(pearl.dead, c.dead);
    assert.equal(particles.length, 32);
    const native = c.events.filter(e => e.startsWith("particle|portal|"));
    for (let i = 0; i < particles.length; i++) {
      const values = native[i].split("|").slice(2).map(Number);
      [particles[i].x, particles[i].y, particles[i].z, particles[i].mx, particles[i].my, particles[i].mz].forEach((v, j) => near(v, values[j]));
    }
    if (c.hit) assert.match(c.events[0], /^hit\|0\.0\|/);
  }
});

test("ender pearl launch shares the native throwable heading and constructor offsets", () => {
  const random = { nextGaussian: (() => { const values = [0, 0, 0]; return () => values.shift() ?? 0; })() };
  const pearl = launchEnderPearl(random, { x: 2, y: 4, z: 6 }, 0, 0);
  assert.equal(pearl.kind, "enderPearl");
  assert.equal(pearl.x, 2.1599999964237213);
  assert.equal(pearl.y, 5.5200000032782555);
  assert.equal(pearl.z, 6);
  assert.equal(Math.hypot(pearl.mx, pearl.my, pearl.mz), 1.5);
  assert.equal(ENDER_PEARL.speed, 1.5);
  assert.equal(ENDER_PEARL.inaccuracy, 1);
});

test("launch retains the same entity RNG for impact particle continuation", () => {
  const world = { remote: true }, stream = new GaussianRandom(84);
  const pearl = launchEnderPearl(stream, { x: 0, y: 5, z: 0 }, 0.2, -0.1), particles = [];
  impactEnderPearl(pearl, { world }, { particle: p => particles.push(p) });
  const replay = new GaussianRandom(84);
  launchEnderPearl(replay, { x: 0, y: 5, z: 0 }, 0.2, -0.1);
  const expected = [];
  for (let i = 0; i < 32; i++) expected.push({ y: pearl.y + replay.nextDouble() * 2, mx: replay.nextGaussian(), mz: replay.nextGaussian() });
  assert.deepEqual(particles.map(({ y, mx, mz }) => ({ y, mx, mz })), expected);
});

test("server impact emits portal particles, dismounts, teleports, resets fall and deals native fall damage", () => {
  const world = { remote: false }, owner = { kind: "playerMP", connected: true, world, riding: true, fallDistance: 12 };
  const pearl = { x: -4, y: 70.5, z: 9, dead: false, random: { nextDouble: () => 0.25, nextGaussian: () => 2 } }, order = [], hit = { kind: "mob" };
  const result = impactEnderPearl(pearl, { world, owner, hit }, {
    particle: p => { order.push("particle"); assert.deepEqual([p.kind, p.x, p.y, p.z, p.mx, p.my, p.mz], ["portal", -4, 71, 9, 2, 0, 2]); },
    hit: (target, d) => { order.push("hit"); assert.equal(target, hit); assert.deepEqual(d, { source: "thrown", projectile: pearl, thrower: owner, amount: 0 }); },
    dismount: p => { order.push("dismount"); p.riding = false; },
    teleport: (p, x, y, z) => { order.push("teleport"); p.position = [x, y, z]; },
    damage: (p, d) => { order.push("damage"); assert.equal(p.fallDistance, 0); assert.deepEqual(d, { source: "fall", amount: 5 }); return true; },
  });
  assert.equal(order.filter(x => x === "particle").length, 32);
  assert.equal(order[0], "hit");
  assert.deepEqual(order.slice(33), ["dismount", "teleport", "damage"]);
  assert.equal(result.teleported, true);
  assert.equal(result.damaged, true);
  assert.equal(pearl.dead, true);
});

test("impact gates preserve client, non-MP, disconnected and cross-world owner behavior", () => {
  const cases = [
    [{ remote: true }, { kind: "playerMP", connected: true }],
    [{ remote: false }, { kind: "player", connected: true }],
    [{ remote: false }, { kind: "playerMP", connected: false }],
    [{ remote: false }, { kind: "playerMP", connected: true, world: {} }],
  ];
  for (const [world, owner] of cases) {
    if (owner.world === undefined) owner.world = world;
    let teleports = 0, damages = 0, particles = 0;
    const pearl = { x: 1, y: 2, z: 3, dead: false, random: { nextDouble: () => 0, nextGaussian: () => 0 } };
    const result = impactEnderPearl(pearl, { world, owner }, {
      particle: () => particles++, teleport: () => teleports++, damage: () => { damages++; return true; },
    });
    assert.equal(result.teleported, false);
    assert.equal(teleports, 0);
    assert.equal(damages, 0);
    assert.equal(particles, 32);
    assert.equal(pearl.dead, !world.remote);
  }
});

test("a sleeping connected server player remains eligible; hit damage is independent of teleport gates", () => {
  const world = { remote: false }, owner = { kind: "playerMP", connected: true, sleeping: true, world, fallDistance: 9 };
  const target = {}, pearl = { x: 0, y: 6, z: 0, random: { nextDouble: () => 0, nextGaussian: () => 0 } };
  let hitCalls = 0, teleportCalls = 0;
  const result = impactEnderPearl(pearl, { world, owner, hit: target }, {
    particle: () => {}, hit: (e, d) => { hitCalls++; assert.equal(e, target); assert.equal(d.amount, 0); },
    teleport: () => teleportCalls++, damage: () => true,
  });
  assert.equal(hitCalls, 1);
  assert.equal(teleportCalls, 1);
  assert.equal(result.teleported, true);
  assert.equal(pearl.dead, true);
});

test("pearl save shape excludes thrower, in-air age and transient impact state", () => {
  const pearl = { x: 1, y: 2, z: 3, mx: 4, my: 5, mz: 6, yaw: 7, pitch: 8, ticks: 99, owner: {}, dead: false };
  assert.deepEqual(serializeEnderPearl(pearl), { x: 1, y: 2, z: 3, mx: 4, my: 5, mz: 6, yaw: 7, pitch: 8, kind: "enderPearl" });
});
