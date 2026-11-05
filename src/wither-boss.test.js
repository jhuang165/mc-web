import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as W from "./wither-boss.js";
import { barFrame, setBossStatus, clearBossStatus, BAR } from "./boss-bar.js";
import { EntityWorld } from "./entities.js";
import { Survival } from "./survival.js";
import { mobDrops, experiencePoints } from "./combat.js";
import { SUMMONABLE } from "./commands.js";
import { summonedMobRecord } from "./java-mobs.js";
import { NBT } from "./nbt.js";
import { JavaRandom } from "./java-random.js";

// tools/probes/WitherBossProbe.java (tools/verify-wither-boss.mjs): the unchanged EntityWither (xc), EntityWitherSkull (zp) and
// EntityFireball (ze) of 1.7.10 on the MobMoveProbe world double. Post-invulnerability bn()/e() are bytecode-derived (not run).
const reference = JSON.parse(await readFile(new URL("../public/research/wither-boss-reference.json", import.meta.url)));
const f = Math.fround;
const rows = (name) => reference.rows.filter((r) => r.case === name);
const near = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b}`);

const flat = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }), set() { return true; } };
const world = () => { const w = new EntityWorld(flat, [], () => 0.5); w.difficulty = 2; return w; };

test("the probe record counts are the ones the evidence was written with", () => {
  assert.equal(reference.rows.length, Object.values(reference.counts).reduce((a, b) => a + b, 0));
  assert.equal(reference.counts.spawn, 440);
  assert.equal(reference.counts.skullFlight, 60);
  assert.equal(reference.counts.skullBlast, 24);
});

test("facts: size, health, speed, armour, eye height and sounds are the original's", () => {
  const r = rows("facts")[0];
  assert.equal(f(W.WITHER.width), f(r.width));
  assert.equal(W.WITHER.height, r.height);
  assert.equal(W.WITHER.maxHealth, r.maxHealth);
  assert.equal(W.WITHER_EYE, f(r.eye));
  assert.equal(r.armor, 4);
  assert.equal(r.xp, 50);
  assert.equal(r.light, 15728880);
  assert.equal(r.living, "mob.wither.idle");
  assert.equal(r.hurt, "mob.wither.hurt");
  assert.equal(r.death, "mob.wither.death");
  assert.equal(experiencePoints({ type: "wither" }, new JavaRandom(1), new JavaRandom(1)), r.xp);
});

test("the spawn countdown: 220 ticks, health max/3 healing 10 every 10 ticks, the power 7 explosion on the last tick", () => {
  for (const start of rows("spawnStart")) { assert.equal(start.invul, 220); assert.equal(f(start.health), W.startHealth()); assert.equal(start.armored, W.armored(start.health)); }
  for (const seed of [1, 8]) {
    let health = W.startHealth(), invul = 220;
    for (const r of rows("spawn").filter((x) => x.seed === seed)) {
      const step = W.invulStep(invul, r.tick);
      assert.equal(r.invulBefore, invul);
      invul = Math.max(0, step.invul);
      health = Math.min(300, health + step.heal);
      assert.equal(r.invul, invul, `tick ${r.tick}`);
      assert.equal(r.health, health, `tick ${r.tick}`);
      assert.equal(r.armored, W.armored(r.health));
      assert.equal(r.explosions.length > 0, step.explode, `explosion at tick ${r.tick}`);
      if (step.explode) {
        assert.deepEqual(r.explosions[0], { x: 64.5, y: r.explosions[0].y, z: 64.5, power: 7, flaming: false, smoking: true });
        near(r.explosions[0].y, 20 + W.WITHER_EYE, 1e-6, "explosion height");
        assert.deepEqual(r.events.map((e) => e.id), [1013]);
      } else assert.equal(r.events.length, 0);
    }
    assert.equal(invul, 0);
  }
});

test("head positions for several body yaws", () => {
  for (const r of rows("headPos")) {
    const e = { x: 10, y: 20, z: 10 };
    r.heads.forEach(([x, y, z], head) => { const p = W.headPosition(e, head, r.bodyYaw); near(p.x, x, 1e-5, "x"); near(p.y, y, 1e-9, "y"); near(p.z, z, 1e-5, "z"); });
    assert.deepEqual(r.defaultYaw, [0, 0]);
  }
});

test("skull launch: spawned at the head position, blue only when charged, motion starts at zero", () => {
  for (const r of rows("launchEntity")) {
    const s = r.spawned[0];
    assert.equal(s.width, f(W.SKULL.size));
    assert.deepEqual([s.vx, s.vy, s.vz], [0, 0, 0]);
    near(s.y, 22.2, 1e-5, "head height");
    assert.deepEqual(r.aux.map((a) => a.id), [1014]);
    assert.equal(s.blue, false);
  }
  for (const r of rows("launchCoords")) { assert.equal(r.spawned[0].blue, r.charged); assert.deepEqual(r.aux.map((a) => a.id), [1014]); }
});

test("skull flight: 0.95 per tick, 0.73 when blue, acceleration added before the factor", () => {
  for (const blue of [false, true]) {
    const rs = rows("skullFlight").filter((r) => r.blue === blue);
    const start = rows("skullStart").find((r) => r.blue === blue).skull;
    assert.equal(start.width, f(W.SKULL.size));
    const k = blue ? W.SKULL.factorBlue : W.SKULL.factor;
    let v = [start.vx, start.vy, start.vz];
    for (const r of rs) {
      v = v.map((c, i) => f(f(c + [r.skull.ax, r.skull.ay, r.skull.az][i]) * k));
      near(v[0], r.skull.vx, 1e-6, "vx"); near(v[1], r.skull.vy, 1e-6, "vy"); near(v[2], r.skull.vz, 1e-6, "vz");
    }
  }
});

test("skull impact: explosion power 1 without fire; the wither effect lasts 10 s on Normal and 40 s on Hard", () => {
  for (const r of rows("skullImpact")) { assert.equal(r.explosions.length, 1); assert.equal(r.explosions[0].power, W.SKULL.power); assert.equal(r.explosions[0].flaming, false); assert.equal(r.dead, true); }
  assert.equal(W.witherSkullEffectTicks(0), 0);
  assert.equal(W.witherSkullEffectTicks(1), 0);
  assert.equal(W.witherSkullEffectTicks(2), 200);
  assert.equal(W.witherSkullEffectTicks(3), 800);
});

test("the blue skull caps block resistance at 0.8 except bedrock, end portal, frame and command block", () => {
  const proof = new Set(W.WITHER_PROOF_IDS);
  for (const r of rows("skullBlast")) assert.equal(W.skullResistance(r.blue, proof.has(r.block), f(r.base)), f(r.resistance), `block ${r.block} blue ${r.blue}`);
  assert.equal(W.WITHER_PROOF_INTERNAL.length, W.WITHER_PROOF_IDS.length);
});

test("armour phase at or below half health; hurt rejections", () => {
  for (const r of rows("armored")) assert.equal(W.armored(r.health), r.armored);
  const hurt = Object.fromEntries(rows("hurt").map((r) => [r.kind, r]));
  assert.equal(hurt.invulnerable.result, false);
  assert.equal(hurt.drown.result, false);
  assert.equal(hurt.armoredArrow.result, false);
  const w = world(), e = w.spawnWither(64.5, 1, 64.5, 0);
  assert.equal(w.attackEntityFrom(e, 4, {}), false, "invulnerable while spawning");
  e.invul = 0; e.health = 300;
  assert.equal(w.attackEntityFrom(e, 4, { name: "drown" }), false);
  assert.equal(w.attackEntityFrom(e, 4, { name: "arrow" }), true, "arrows hit above half health");
  e.health = 100;
  assert.equal(w.attackEntityFrom(e, 4, { name: "arrow" }), false, "armoured: arrows are rejected");
  assert.equal(e.health, 100);
});

test("drops: one nether star at every looting level, 50 experience", () => {
  for (const r of rows("drops")) {
    assert.deepEqual(r.items, [{ id: 399, damage: 0, count: 1 }]);
    assert.deepEqual(mobDrops({ type: "wither" }, { playerHit: true, looting: r.looting }, new JavaRandom(1)).map(([id]) => id), [2060]);
  }
});

test("render choices and the boss bar numbers", () => {
  assert.equal(W.witherTexture(220), "wither_invulnerable");
  assert.equal(W.witherTexture(0), "wither");
  assert.equal(W.witherTexture(80), "wither_invulnerable"); // last 80 ticks: even 5 tick blocks stay dark, odd ones flash to wither.png
  assert.equal(W.witherTexture(75), "wither");
  assert.equal(W.witherTexture(100), "wither_invulnerable");
  assert.equal(W.witherScale(0), 2);
  assert.equal(W.witherScale(220), 1.5);
  assert.equal(W.bossFill(300, 300), 183);
  assert.equal(W.bossFill(150, 300), 91);
  assert.equal(W.bossFill(100, 300), 61);
  clearBossStatus();
  assert.equal(barFrame(), null);
  setBossStatus({ health: 150, maxHealth: 300 }, "Wither");
  const first = barFrame();
  assert.deepEqual([first.width, first.fill, first.name, first.y, first.nameY], [182, 91, "Wither", BAR.y, BAR.nameY]);
  for (let i = 1; i < 100; i++) assert.ok(barFrame());
  assert.equal(barFrame(), null, "the bar fades after 100 frames");
});

test("the Invul tag round-trips through the probe's NBT and /summon", () => {
  const n = rows("nbt")[0];
  assert.deepEqual([n.written, n.read, n.default], [123, 123, 0]);
  assert.equal(SUMMONABLE.WitherBoss, "wither");
  const { record } = summonedMobRecord("wither", new Map([["Invul", { type: NBT.INT, value: 123 }]]));
  assert.equal(record.invul, 123);
  assert.equal(record.health, 300);
  assert.equal(summonedMobRecord("wither", new Map()).record.invul, 0);
});

test("world: a spawned Wither counts down, explodes, heals and shoots; killing it drops the star", () => {
  const w = world(), s = new Survival({}), p = { x: 64.5, y: 1, z: 80.5, alive: true, width: 0.6, height: 1.8, eyeHeight: 1.62 };
  const e = w.spawnWither(64.5, 1, 64.5, 0);
  assert.equal(e.invul, 220);
  assert.equal(e.health, f(100));
  const events = [];
  let exploded = -1;
  for (let i = 0; i < 260; i++) {
    w.tick(p, s);
    for (const x of w.drain()) { events.push(x); if (x.explode && exploded < 0) exploded = i; }
  }
  assert.equal(e.invul, 0);
  assert.equal(e.health, 300);
  assert.ok(exploded >= 215 && exploded <= 222, `explosion at tick ${exploded}`);
  assert.ok(events.some((x) => x.sound === "mob.wither.spawn"), "broadcast spawn sound");
  assert.ok(events.filter((x) => x.explode).some((x) => x.explode.size === 7 || x.explode.power === 7));
});
