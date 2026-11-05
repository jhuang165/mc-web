// Firework star / rocket: replays public/research/fireworks-reference.json (tools/verify-fireworks.mjs, FireworksProbe.java).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JavaRandom } from "./java-random.js";
import { EffectRenderer } from "./effect-renderer.js";
import { ORIGINAL_ITEMS } from "./original-items.js";
import { FireworkParticles } from "./firework-particles.js";
import { createRocket, tickRocket } from "./firework-rocket.js";
import { FireworkRockets, dispenseFirework } from "./fireworks-live.js";
import { writeFireworkTags } from "./fireworks-nbt.js";
import { readFireworkNbt } from "./fireworks-nbt.js";
import { sameStackItem, makeStack } from "./inventory.js";
import {
  FIREWORK_ITEMS, ITEM_FIREWORK_STAR, ITEM_FIREWORK_ROCKET, DYE_COLORS, registerSkullItem, fireworksResult, fireworkLines, starTint,
  normalizeExplosion, normalizeFireworks, installFireworkItems,
} from "./fireworks.js";

const ref = JSON.parse(await readFile(new URL("../public/research/fireworks-reference.json", import.meta.url)));
const by = (c) => ref.records.filter((r) => r.case === c);
const SKULL = 9999;
registerSkullItem(SKULL);
const state = (raw) => { const r = new JavaRandom(0); r.seed = BigInt(raw); return r; };
const explosionOf = (x) => normalizeExplosion({ type: x.Type ?? 0, colors: x.Colors ?? [], fade: x.FadeColors ?? [], flicker: !!x.Flicker, trail: !!x.Trail });
const fireworksOf = (t) => (t ? { ...(t.Flight !== undefined ? { flight: t.Flight } : {}), explosions: (t.Explosions ?? []).map(explosionOf) } : undefined);
const toStack = (i) => {
  if (!i) return null;
  const id = i.id === 397 ? SKULL : FIREWORK_ITEMS[i.id] ?? (ORIGINAL_ITEMS[i.id] ?? ORIGINAL_ITEMS[`${i.id}:0`]);
  const s = { id, count: i.count, damage: i.damage };
  if (i.tag?.Explosion) s.explosion = explosionOf(i.tag.Explosion);
  if (i.tag?.Fireworks) s.fireworks = fireworksOf(i.tag.Fireworks);
  return s;
};
const world = { get: (x, y, z) => (y < 64 ? 3 : 0), getMeta: () => 0, solid: (x, y, z) => y < 64 };

test("records and ids", () => {
  assert.deepEqual(Object.fromEntries(["recipe", "tooltip", "rocket", "starter", "lifecycle"].map((c) => [c, by(c).length])), { recipe: 78, tooltip: 12, rocket: 12, starter: 15, lifecycle: 6 });
  assert.equal(FIREWORK_ITEMS[401], ITEM_FIREWORK_ROCKET);
  assert.equal(ORIGINAL_ITEMS[402], ITEM_FIREWORK_STAR);
  assert.deepEqual([...DYE_COLORS], by("facts")[0].dyeColors ?? [...DYE_COLORS]);
  const items = {};
  installFireworkItems(items);
  assert.ok(items[ITEM_FIREWORK_STAR] && items[ITEM_FIREWORK_ROCKET]);
});

test("RecipeFireworks matches the original", () => {
  for (const r of by("recipe")) {
    const cells = Array(r.size * r.size).fill(null);
    for (const { slot, item } of r.input) cells[slot] = toStack(item);
    const got = fireworksResult(cells);
    if (!r.matched) { assert.equal(got, null, r.name); continue; }
    assert.ok(got, r.name);
    const want = toStack(r.result);
    assert.equal(got.id, want.id, r.name);
    assert.equal(got.count, want.count, r.name);
    assert.deepEqual(got.explosion ?? null, want.explosion ?? null, r.name);
    assert.deepEqual(got.fireworks ?? null, want.fireworks ?? null, r.name);
  }
});

test("tooltips and star tint", () => {
  for (const r of by("tooltip")) {
    const s = toStack(r.item);
    assert.deepEqual(fireworkLines(s), r.lines, r.name);
    if (r.tint) assert.deepEqual([starTint(s, 0), starTint(s, 1)], r.tint, r.name);
  }
});

test("starter, sparks and overlays replay the original", () => {
  for (const r of by("starter")) {
    const seeds = [r.seed];
    for (const ev of r.events) for (const m of ev.made) seeds.push(m.seed);
    let q = 0;
    const fx = new FireworkParticles({ random: () => 0.5, entityRandom: () => state(seeds[q++]), effects: new EffectRenderer(), playSound: () => {}, viewer: [10.5 + r.viewer, 70, 10.5] });
    const s = fx.spawnStarter(10.5, 70, 10.5, 0.01, 0.2, -0.02, { explosions: (r.tag?.Explosions ?? []).map(explosionOf) });
    for (let t = 0; t < r.ticks; t++) {
      const before = fx.effects.layers[0].length;
      fx.step(null, s);
      const made = fx.effects.layers[0].slice(before), ev = r.events[t];
      assert.equal(made.length, ev.made.length, `${r.name} tick ${t}`);
      made.forEach((p, i) => {
        const m = ev.made[i];
        for (const [a, b] of [[p.mx, m.motion[0]], [p.my, m.motion[1]], [p.mz, m.motion[2]], [p.r, m.rgb[0]], [p.max, m.maxAge], [p.scale, m.scale]]) assert.ok(Math.abs(a - b) < 1e-9, `${r.name} ${t} ${i}`);
      });
    }
  }
});

test("rocket flight replays the original", () => {
  for (const r of by("rocket")) {
    const rand = state(r.seed);
    const ro = createRocket(10.5, 65, 10.5, { id: ITEM_FIREWORK_ROCKET, fireworks: fireworksOf(r.stack.tag?.Fireworks) }, rand);
    assert.equal(ro.lifetime, r.lifetime, r.name);
    r.rows.forEach((row, t) => {
      tickRocket(ro, world, rand, { remote: r.remote, server: !r.remote });
      const got = [ro.x, ro.y, ro.z, ro.mx, ro.my, ro.mz, ro.yaw, ro.pitch, ro.prevYaw, ro.prevPitch, ro.life, ro.dead ? 1 : 0];
      got.forEach((v, i) => assert.ok(Math.abs(v - row[i]) < 1e-12, `${r.name} tick ${t} col ${i}`));
    });
  }
});

test("starter with no colours is skipped (documented divergence)", () => {
  assert.equal(by("starterThrows").length, 1);
  const fx = new FireworkParticles({ effects: new EffectRenderer() });
  assert.doesNotThrow(() => { const s = fx.spawnStarter(0, 70, 0, 0, 0, 0, { explosions: [normalizeExplosion({ type: 0 })] }); for (let t = 0; t < 5; t++) fx.step(null, s); });
});

test("live rockets: launch, dispenser, lifecycle, persistence", () => {
  const rk = new FireworkRockets(state(7));
  const stack = { id: ITEM_FIREWORK_ROCKET, count: 1, damage: 0, fireworks: normalizeFireworks({ flight: 1, explosions: [{ type: 1, colors: [DYE_COLORS[1]] }] }) };
  dispenseFirework(rk, 10, 65, 10, 0, 1, stack);
  assert.equal(rk.rockets[0].z, 11.5);
  assert.equal(rk.balls[0].kind, "firework");
  const copy = new FireworkRockets(state(1));
  copy.load(JSON.parse(JSON.stringify(rk.serialize())));
  assert.equal(copy.rockets.length, 1);
  let exploded = null, sparks = 0, launch = 0;
  for (let t = 0; t < 200 && !exploded; t++) rk.tick(world, { sound: (n) => { if (n === "fireworks.launch") launch++; }, spark: () => sparks++, explode: (...a) => { exploded = a; } });
  assert.ok(exploded && sparks > 0 && launch === 1);
  assert.equal(rk.rockets.length, 0);
  assert.equal(exploded[6].explosions[0].type, 1);
});

test("stack identity and NBT round trip", () => {
  const a = { id: ITEM_FIREWORK_STAR, count: 1, damage: 0, explosion: normalizeExplosion({ type: 2, colors: [1, 2], fade: [3], flicker: true }) };
  const b = makeStack(a.id, 1, 0, undefined, { explosion: { ...a.explosion, colors: [1, 2] } });
  assert.ok(sameStackItem(a, b));
  assert.ok(!sameStackItem(a, { ...a, explosion: normalizeExplosion({ type: 3, colors: [1, 2] }) }));
  const entries = {};
  writeFireworkTags(a, entries);
  const back = {};
  readFireworkNbt(back, new Map(Object.entries(entries)));
  assert.deepEqual(back.explosion, a.explosion);
  const rocket = { fireworks: normalizeFireworks({ flight: 2, explosions: [a.explosion] }) };
  const e2 = {}; writeFireworkTags(rocket, e2);
  const back2 = {}; readFireworkNbt(back2, new Map(Object.entries(e2)));
  assert.deepEqual(back2.fireworks, rocket.fireworks);
});
