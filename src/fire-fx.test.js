import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  overlayPlan, FIRE_OVERLAY, fireOverlayQuads, WATER_OVERLAY, waterOverlayQuad, INSIDE_BLOCK_OVERLAY, insideBlockQuad, insideOverlayBlock,
  clientInWater, clientInsideOpaque, playerBrightness, handFov, worldFov, waterFogDensity, waterFogColor, LAVA_FOG_DENSITY, LAVA_FOG_COLOR,
  entityFizz, punchFizz, liquidFizz, lavaFizz, igniteSound, crackleSound,
} from "./fire-fx.js";
import { fogColor } from "./lighting.js";
import { liquidHeightPercent } from "./fluids.js";
import { tickLivingSimulation } from "./living-simulation.js";
import { useFireCharge } from "./spawn-egg-use.js";
import { ITEM_FIRE_CHARGE } from "./spawn-eggs.js";

const f = Math.fround, seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
const ref = JSON.parse(readFileSync(new URL("../public/research/fire-fx-reference.json", import.meta.url), "utf8"));
const icon = { minU: 0.25, maxU: 0.75, minV: 0.125, maxV: 0.375 };

test("renderOverlays order and gates: fire, block, water; never in third person or asleep", () => {
  assert.deepEqual(overlayPlan({ burning: true, insideOpaque: true, inWater: true }), ["fire", "block", "water"]);
  assert.deepEqual(overlayPlan({ inWater: true }), ["water"]);
  assert.deepEqual(overlayPlan({ burning: true, thirdPerson: 1 }), []);
  assert.deepEqual(overlayPlan({ burning: true, thirdPerson: 2 }), []);
  assert.deepEqual(overlayPlan({ burning: true, sleeping: true }), []);
});

test("fire overlay: two quads, alpha 0.9, offsets +-0.24 / -0.3, yaw +-10, mirrored u", () => {
  assert.equal(FIRE_OVERLAY.alpha, f(0.9));
  const [a, b] = fireOverlayQuads(icon);
  assert.equal(fireOverlayQuads(icon).length, 2);
  // Pass 0 is shifted +0.24 and turned -10 degrees, pass 1 shifted -0.24 and turned +10: the quad centres mirror.
  const centre = (q) => ({ x: q.reduce((s, v) => s + v.x, 0) / 4, y: q.reduce((s, v) => s + v.y, 0) / 4, z: q.reduce((s, v) => s + v.z, 0) / 4 });
  const ca = centre(a), cb = centre(b);
  assert.ok(Math.abs(ca.x + cb.x) < 1e-6 && Math.abs(ca.x - (0.24 + 0.5 * Math.sin(10 * Math.PI / 180))) < 1e-6);
  assert.ok(Math.abs(ca.y + 0.3) < 1e-6 && Math.abs(cb.y + 0.3) < 1e-6);
  assert.ok(Math.abs(ca.z - cb.z) < 1e-9 && Math.abs(ca.z + 0.5 * Math.cos(10 * Math.PI / 180)) < 1e-6);
  assert.equal(a[0].u, icon.maxU); assert.equal(a[1].u, icon.minU); assert.equal(a[0].v, icon.maxV); assert.equal(a[2].v, icon.minV);
  // Width of the turned quad on screen is cos(10 degrees).
  assert.ok(Math.abs((a[1].x - a[0].x) - Math.cos(10 * Math.PI / 180)) < 1e-6);
});

test("water overlay: 0.5 alpha, brightness tint, 4x4 repeat scrolling by yaw/64 and pitch/64", () => {
  const q = waterOverlayQuad({ brightness: 0.8, yaw: 90, pitch: 32 });
  assert.deepEqual(q.color, [f(0.8), f(0.8), f(0.8), 0.5]);
  assert.equal(WATER_OVERLAY.z, -0.5);
  const du = f(-90 / 64), dv = f(32 / 64);
  assert.equal(q.vertices[0].u, f(4 + du)); assert.equal(q.vertices[1].u, f(du));
  assert.equal(q.vertices[0].v, f(4 + dv)); assert.equal(q.vertices[2].v, f(dv));
  assert.deepEqual(q.vertices.map((v) => [v.x, v.y]), [[-1, -1], [1, -1], [1, 1], [-1, 1]]);
});

test("inside-block overlay: a tenth of the brightness, side texture, z -0.5; block pick prefers the last normal cube", () => {
  const q = insideBlockQuad(icon);
  assert.deepEqual(q.color.slice(0, 3), [f(0.1), f(0.1), f(0.1)]);
  assert.equal(INSIDE_BLOCK_OVERLAY.z, -0.5);
  assert.equal(q.vertices[0].u, icon.maxU);
  const cells = new Map([["0,5,0", 0], ["-1,5,0", 7]]);
  const get = (x, y, z) => cells.get(`${x},${y},${z}`) ?? 0;
  const normal = (b) => b === 7;
  assert.equal(insideOverlayBlock(get, 0.1, 5.5, 0.1, 0.6, 1.8, normal), 7);
  assert.equal(insideOverlayBlock(get, 5.5, 5.5, 5.5, 0.6, 1.8, normal), 0);
  assert.equal(insideOverlayBlock((x, y, z) => 7, 0.5, 5.5, 0.5, 0.6, 1.8, normal), 7);
});

test("client-side tests sample 0.12 above the camera eye and honour sleeping", () => {
  const inside = (w, x, y, z, width, eye) => { inside.args = [y, eye]; return true; };
  assert.equal(clientInsideOpaque(inside, null, 0, 70, 0, 0.6), true);
  assert.deepEqual(inside.args, [70, f(0.12)]);
  assert.equal(clientInsideOpaque(inside, null, 0, 70, 0, 0.6, true), false);
  const level = (x, y, z) => (y === 64 ? 0 : -1); // a water source cell at y 64
  assert.equal(clientInWater(level, liquidHeightPercent, 0.5, 64.5, 0.5), true);
  assert.equal(clientInWater(level, liquidHeightPercent, 0.5, 64.95, 0.5), false);
});

test("brightness tint reads the light of the player's cell through the table, zero when unloaded", () => {
  const table = Array.from({ length: 16 }, (_, i) => i / 15);
  assert.equal(playerBrightness(() => 15, table, 0, 64, 0, 1.8), 1);
  assert.equal(playerBrightness(() => 3, table, 0, 64, 0, 1.8), 3 / 15);
  assert.equal(playerBrightness(() => 15, table, 0, 64, 0, 1.8, false), 0);
});

test("fov: 70 hand, x 60/70 in water for both passes", () => {
  assert.equal(handFov(false), 70);
  assert.equal(handFov(true), f(f(70 * 60) / 70));
  assert.equal(worldFov(90, true), f(f(90 * 60) / 70));
  assert.equal(worldFov(90, false), 90);
});

test("water fog: density 0.05 with Water Breathing, 0.1 - 0.03 x Respiration otherwise; colour + 0.2 x Respiration; lava 2.0 and (0.6, 0.1, 0)", () => {
  assert.equal(waterFogDensity({}), f(0.1));
  assert.equal(waterFogDensity({ breathing: true, respiration: 3 }), f(0.05));
  for (const r of [1, 2, 3]) assert.equal(waterFogDensity({ respiration: r }), f(f(0.1) - f(f(r) * f(0.03))));
  assert.deepEqual(waterFogColor(0), [f(0.02), f(0.02), f(0.2)]);
  assert.deepEqual(waterFogColor(2), [f(f(0.02) + f(0.4)), f(f(0.02) + f(0.4)), f(f(0.2) + f(0.4))]);
  assert.equal(LAVA_FOG_DENSITY, 2);
  assert.deepEqual([...LAVA_FOG_COLOR], [f(0.6), f(0.1), 0]);
  const base = { angle: 0.25, temperature: 0.8, look: [0, 0, 1], chunks: 8 };
  assert.deepEqual(fogColor({ ...base, underwater: true, respiration: 2 }), waterFogColor(2));
  assert.deepEqual(fogColor({ ...base, underwater: true }), waterFogColor(0));
  assert.deepEqual(fogColor({ ...base, lava: true }), [...LAVA_FOG_COLOR]);
});

test("sound events: name, volume and the native pitch formula", () => {
  assert.deepEqual(entityFizz(seq(0.75, 0.25)), { name: "random.fizz", volume: f(0.7), pitch: f(f(1.6) + f(f(0.5) * f(0.4))) });
  assert.deepEqual(punchFizz(seq(0.75, 0.25)), { name: "random.fizz", volume: 0.5, pitch: f(f(2.6) + f(f(0.5) * f(0.8))) });
  assert.deepEqual(liquidFizz(seq(0, 1)), punchFizz(seq(0, 1)));
  assert.deepEqual(lavaFizz(seq(0.5)), { name: "random.fizz", volume: f(0.4), pitch: f(f(2) + f(f(0.5) * f(0.4))) });
  assert.deepEqual(igniteSound(seq(0.5)), { name: "fire.ignite", volume: 1, pitch: f(f(f(0.5) * f(0.4)) + f(0.8)) });
  assert.deepEqual(crackleSound(seq(0.5)), { name: "fire.fire", volume: 1.5, pitch: f(f(f(0.5) * f(0.7)) + f(0.3)) });
});

test("fire charge plays fire.ignite at the cell centre, volume 1, pitch r * 0.4 + 0.8", () => {
  const played = [];
  const state = { survival: { held: { id: ITEM_FIRE_CHARGE, count: 1 }, creative: true }, world: { get: () => 0, height: 256 }, fire: { ignite() {}, drain: () => [] } };
  useFireCharge(state, { block: [1, 64, 1], adjacent: [1, 65, 1] }, { random: () => 0.5, playSound: (n, o) => played.push([n, o]) });
  assert.deepEqual(played, [["fire.ignite", { volume: 1, pitch: 1, position: { x: 1.5, y: 65.5, z: 1.5 } }]]);
});

test("items in lava or rain: item sounds are drained through the live orbSound hook", () => {
  const items = { sounds: [{ name: "random.fizz", volume: 0.7, pitch: 1.7, x: 1, y: 2, z: 3 }] };
  const heard = [];
  const state = {
    world: {}, position: { x: 0, y: 0, z: 0 }, inhabited: { tick() {} }, mobs: { tick() {}, sounds: [], events: [] }, xpOrbs: { tick() {}, collect: () => 0, sounds: [], orbs: [] },
    survival: { health: 0, time: 0 }, experience: {}, items, playerTicks: 0, width: 0.6, height: 1.8,
  };
  try { tickLivingSimulation(state, { orbSound: (s) => heard.push(s) }); } catch { /* the stub mob list may not satisfy drainMobEvents */ }
  assert.deepEqual(heard.map((s) => [s.name, s.volume, s.pitch]), [["random.fizz", 0.7, 1.7]]);
  assert.equal(items.sounds.length, 0);
});

test("reference json holds the bytecode constants the module uses", () => {
  assert.equal(ref.fireOverlay.alpha, 0.9);
  assert.equal(ref.waterOverlay.alpha, 0.5);
  assert.equal(ref.fog.lavaDensity, 2);
  assert.equal(ref.fog.waterDensityBreathing, 0.05);
  assert.equal(ref.sounds.entityFizz.volume, 0.7);
  assert.equal(ref.sounds.punchFizz.volume, 0.5);
});
