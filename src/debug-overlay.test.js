import { test } from "node:test";
import assert from "node:assert/strict";
import { Profiler } from "./profiler.js";
import * as D from "./debug-overlay.js";

test("facing index and names follow Direction.directions (bytecode-read bbv/p)", () => {
  const cases = [[0, 0, "SOUTH"], [44, 0, "SOUTH"], [45, 1, "WEST"], [90, 1, "WEST"], [180, 2, "NORTH"], [-180, 2, "NORTH"], [270, 3, "EAST"], [-90, 3, "EAST"], [-45, 0, "SOUTH"], [359, 0, "SOUTH"], [-46, 3, "EAST"]];
  for (const [yaw, i, name] of cases) { assert.equal(D.facingIndex(yaw), i, String(yaw)); assert.equal(D.FACING[i], name); }
});
test("f line wraps the yaw to [-180, 180) and prints Float.toString", () => {
  assert.equal(D.facingLine(0), "f: 0 (SOUTH) / 0.0");
  assert.equal(D.facingLine(90), "f: 1 (WEST) / 90.0");
  assert.equal(D.facingLine(190), "f: 2 (NORTH) / -170.0");
  assert.equal(D.facingLine(-181), "f: 2 (NORTH) / 179.0");
  assert.equal(D.facingLine(540), "f: 2 (NORTH) / -180.0");
  assert.equal(D.facingLine(12.5), "f: 0 (SOUTH) / 12.5");
});
test("the port yaw (0 faces -Z) maps to native yaw (0 faces +Z)", () => {
  assert.equal(D.facingLine(D.nativeYaw(0)).slice(0, 14), "f: 2 (NORTH) /");
  assert.equal(D.facingIndex(D.nativeYaw(Math.PI / 2)), 1); // port +90 turns towards -X, west
  assert.equal(D.facingIndex(D.nativeYaw(Math.PI)), 0);
  assert.equal(D.facingIndex(D.nativeYaw(-Math.PI / 2)), 3);
});
test("chunk coordinate math floors negatives (qh.c) and uses >> 4 and & 15", () => {
  assert.deepEqual(D.chunkCoords(D.floorD(-0.5)), { block: -1, chunk: -1, local: 15 });
  assert.deepEqual(D.chunkCoords(D.floorD(16)), { block: 16, chunk: 1, local: 0 });
  assert.deepEqual(D.chunkCoords(D.floorD(-16.0001)), { block: -17, chunk: -2, local: 15 });
  assert.equal(D.xLine(-0.5), "x: -0.50000 (-1) // c: -1 (15)");
  assert.equal(D.zLine(33.123456), "z: 33.12346 (33) // c: 2 (1)");
  assert.equal(D.yLine(64, 65.62), "y: 64.000 (feet pos, 65.620 eyes pos)");
});
test("light line prefixes the top segment + 15 and keeps the native order lc/b/bl/sl/rl", () => {
  assert.equal(D.lightLine({ topSegment: 64, biome: "Plains", block: 3, sky: 15, real: 15 }), "lc: 79 b: Plains bl: 3 sl: 15 rl: 15");
  assert.equal(D.lightLine({ topSegment: 0, biome: "Extreme Hills", block: 0, sky: 0, real: 0 }), "lc: 15 b: Extreme Hills bl: 0 sl: 0 rl: 0");
});
test("ws/fs line widens the Float speeds to double", () => {
  assert.equal(D.walkLine(D.WALK_SPEED, D.FLY_SPEED, true, 63), "ws: 0.100, fs: 0.050, g: true, fl: 63");
  assert.equal(D.walkLine(D.WALK_SPEED, D.FLY_SPEED, false, 0), "ws: 0.100, fs: 0.050, g: false, fl: 0");
});
test("renderer, entity, particle and cache lines use the bma/bao formats", () => {
  assert.equal(D.titleLine(60, 12), "Minecraft 1.7.10 (60 fps, 12 chunk updates)");
  assert.equal(D.rendersLine({ rendered: 100, loaded: 500, clipped: 400, occluded: 0, skipping: 3 }), "C: 100/500. F: 400, O: 0, E: 3");
  assert.equal(D.entitiesLine({ rendered: 4, total: 10, hidden: 5 }), "E: 4/10. B: 5, I: 1");
  assert.equal(D.particlesLine(7, 10), "P: 7. T: All: 10");
  assert.equal(D.chunkCacheLine(441), "MultiplayerChunkCache: 441, 441");
});
test("left column order, y spacing and colours", () => {
  const s = { fps: 30, chunkUpdates: 0, renders: { rendered: 1, loaded: 2, clipped: 1, occluded: 0, skipping: 0 }, entities: { rendered: 0, total: 1, hidden: 0 }, particles: 0, chunkCache: 9, x: 1.5, z: 2.5, feetY: 64, eyeY: 65.62, yaw: 0, onGround: true, height: 60, light: { topSegment: 64, biome: "Plains", block: 0, sky: 15, real: 15 } };
  const l = D.leftLines(s);
  assert.deepEqual(l.map((x) => x.y), [2, 12, 22, 32, 42, 64, 72, 80, 88, 96, 104]);
  assert.deepEqual(l.map((x) => x.color), [...Array(5).fill(0xffffff), ...Array(6).fill(0xe0e0e0)]);
  assert.ok(l[5].text.startsWith("x: ") && l[6].text.startsWith("y: ") && l[7].text.startsWith("z: ") && l[8].text.startsWith("f: ") && l[9].text.startsWith("lc: ") && l[10].text.startsWith("ws: "));
  assert.equal(D.leftLines({ ...s, light: null }).length, 10); // the lc line needs a loaded chunk
});
test("memory lines use long division and the right margin of 2", () => {
  const MB = 1024 * 1024;
  assert.equal(D.usedMemoryLine(1000 * MB, 300 * MB, 100 * MB), "Used memory: 20% (200MB) of 1000MB");
  assert.equal(D.allocatedMemoryLine(1000 * MB, 300 * MB), "Allocated memory: 30% (300MB)");
  const r = D.rightLines({ max: 1000 * MB, total: 300 * MB, free: 100 * MB }, 427, (t) => t.length * 6);
  assert.equal(r[0].x, 427 - r[0].text.length * 6 - 2);
  assert.deepEqual(r.map((x) => x.y), [2, 12]);
  assert.equal(D.usedMemoryLine(0, 0, 0), "Used memory: 0% (0MB) of 0MB");
  assert.equal(D.readMemory({ memory: { jsHeapSizeLimit: 4 * 1024 ** 3, totalJSHeapSize: 100, usedJSHeapSize: 40 } }).free, 60);
});
test("Result colours and the digit navigation of the profiler pie", () => {
  assert.equal(D.javaHash("tick"), 3559837);
  assert.equal(D.sectorColor("tick"), (3559837 & 0xaaaaaa) + 0x444444);
  assert.equal(D.sideColor(0xffffff), 0x7f7f7f);
  assert.equal(D.pct(5.5), "5.50");
  let t = 0;
  const p = new Profiler(() => t); p.enabled = true;
  p.start("root"); p.start("tick"); t += 600; p.start("player"); t += 100; p.end(); p.end(); p.start("render"); t += 300; p.end(); p.end();
  assert.equal(D.selectSection(p, "root", 1), "root.tick");
  assert.equal(D.selectSection(p, "root.tick", 0), "root");
  assert.equal(D.selectSection(p, "root", 9), "root");
});
test("pie model: rows, labels and geometry in raw pixels", () => {
  const list = [{ name: "root", use: 100, total: 100 }, { name: "tick", use: 60, total: 60 }, { name: "unspecified", use: 40, total: 40 }];
  const m = D.pieModel(list, 854, 480);
  assert.equal(m.cx, 854 - 160 - 10); assert.equal(m.cy, 480 - 320);
  assert.equal(m.text[0].text, "[0]root "); assert.equal(m.text[0].y, m.cy - 80 - 16);
  assert.equal(m.text[2].text, "[1]tick"); assert.equal(m.text[2].y, m.cy + 80 + 20);
  assert.equal(m.text[5].text, "[?]unspecified"); assert.equal(m.text[5].y, m.cy + 80 + 8 + 20);
  assert.equal(m.sectors[0].steps, 16); assert.equal(m.sectors[1].a0, 60);
  assert.equal(D.pieModel([{ name: "", use: 100, total: 100 }], 100, 100).text[0].text, "[0]ROOT");
  assert.deepEqual(m.back, { x0: m.cx - 176, x1: m.cx + 176, y0: m.cy - 112, y1: m.cy + 320 });
});
