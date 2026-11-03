import { test } from "node:test";
import assert from "node:assert/strict";
import { SIZE, HEIGHT } from "./world.js";
import {
  BRIGHTNESS,
  celestialAngle,
  sunBrightness,
  skylightSubtracted,
  skyColorByTemp,
  sunriseColors,
  JavaRandom,
  starQuads,
  lightmap,
  pack,
  aoBrightness,
  LightVolume,
  smoothFace,
  lightOpacity,
  lightEmission,
} from "./lighting.js";
import { World } from "./world.js";

// A flat test world: stone below y = 10, air above.
function flat() {
  const data = new Uint8Array(SIZE * SIZE * HEIGHT);
  for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) for (let y = 0; y < 10; y++) data[(x * SIZE + z) * HEIGHT + y] = 3;
  return {
    data,
    get(x, y, z) {
      return x < 0 || z < 0 || y < 0 || x >= SIZE || z >= SIZE || y >= HEIGHT ? 0 : data[(x * SIZE + z) * HEIGHT + y];
    },
    put(x, y, z, b) {
      data[(x * SIZE + z) * HEIGHT + y] = b;
    },
  };
}

test("overworld brightness table matches generateLightBrightnessTable", () => {
  assert.equal(BRIGHTNESS[15], 1);
  assert.equal(BRIGHTNESS[0], 0);
  assert.ok(Math.abs(BRIGHTNESS[7] - 0.1794872) < 1e-6);
});

test("celestial angle, sun brightness and skylight subtraction follow the day cycle", () => {
  assert.equal(celestialAngle(6000), 0);
  assert.ok(Math.abs(celestialAngle(18000) - 0.5) < 1e-6);
  assert.equal(skylightSubtracted(celestialAngle(6000)), 0);
  assert.equal(skylightSubtracted(celestialAngle(18000)), 11);
  assert.ok(Math.abs(sunBrightness(celestialAngle(6000)) - 1) < 1e-6);
  assert.ok(Math.abs(sunBrightness(celestialAngle(18000)) - 0.2) < 1e-6);
  assert.equal(sunriseColors(celestialAngle(6000)), null);
  assert.ok(sunriseColors(celestialAngle(12800)));
});

test("plains sky colour comes from BiomeGenBase.getSkyColorByTemp", () => {
  const c = skyColorByTemp(0.8);
  assert.deepEqual(c, [121, 167, 255]);
});

test("JavaRandom reproduces java.util.Random and the 1.7.10 star field", () => {
  const r = new JavaRandom(10842);
  assert.ok(Math.abs(r.nextFloat() - 0.12987703) < 1e-7);
  assert.ok(Math.abs(r.nextFloat() - 0.037620723) < 1e-8);
  assert.equal(r.nextDouble(), 0.883435442313338);
  assert.ok(Math.abs(new JavaRandom(187).nextFloat() - 0.7403738) < 1e-7);
  assert.equal(starQuads().length / 3, 3120);
});

test("lightmap corners: dark night floor, full day white, warm torchlight", () => {
  const day = lightmap(1, 0, 0);
  assert.deepEqual(Array.from(day.slice(0, 4)), [14, 14, 14, 255]);
  assert.deepEqual(Array.from(day.slice(1020)), [252, 252, 252, 255]);
  const night = lightmap(0.2, 0, 0), torch = 10 * 4;
  assert.ok(night[torch] > night[torch + 2], "block light is warmer in red than blue");
  assert.ok(lightmap(0.2, 0, 1)[4 * 16 * 4] > night[4 * 16 * 4], "gamma brightens dim texels");
});

test("aoBrightness replaces zero samples with the face centre", () => {
  const centre = pack(15, 0);
  assert.equal(aoBrightness(0, 0, 0, centre), centre);
  assert.equal(aoBrightness(pack(15, 0), pack(11, 0), pack(11, 0), pack(15, 0)), pack(13, 0));
});

test("LightVolume propagates sky, torch and water light", () => {
  const w = flat();
  w.put(64, 10, 64, 20);
  for (let y = 10; y < 14; y++) w.put(30, y, 30, 10);
  w.put(30, 9, 30, 10);
  const light = new LightVolume(w);
  assert.equal(light.skyAt(10, 10, 10), 15);
  assert.equal(light.skyAt(10, 9, 10), 0);
  assert.equal(light.blockAt(64, 10, 64), 14);
  assert.equal(light.blockAt(65, 10, 64), 13);
  assert.equal(light.blockAt(68, 10, 64), 10);
  // Water costs 3 per block; the column below the water surface dims.
  assert.equal(light.skyAt(30, 13, 30), 12);
  assert.equal(light.skyAt(30, 12, 30), 12, "open-air neighbours feed 15 - 3 from the side");
  assert.equal(light.skyAt(30, 9, 30), 9, "inside the stone the column only gets light from above");
  assert.equal(light.level(10, 10, 10, 11), 4);
  // Removing the torch clears its block light.
  w.put(64, 10, 64, 0);
  assert.ok(light.update(64, 10, 64));
  assert.equal(light.blockAt(65, 10, 64), 0);
});

// The light rules written out plainly: every cell seeds its base value (open sky 15, emission) and a
// FIFO relaxation runs to the fixed point. Outside the volume and above it reads as open sky.
function referenceLight(w, H) {
  const n = SIZE * SIZE * H, cost = new Uint8Array(n), out = {};
  const heights = new Int32Array(SIZE * SIZE);
  for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) {
    let y = H - 1;
    while (y >= 0 && lightOpacity(w.get(x, y, z)) === 0) y--;
    heights[x * SIZE + z] = y + 1;
    for (let yy = 0; yy < H; yy++) {
      const b = w.get(x, yy, z), op = lightOpacity(b);
      cost[(x * SIZE + z) * H + yy] = op >= 15 && lightEmission(b) > 0 ? 1 : Math.max(1, Math.min(15, op));
    }
  }
  for (const channel of ["sky", "block"]) {
    const arr = new Uint8Array(n), queue = [], outside = channel === "sky" ? 15 : 0;
    for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) for (let y = 0; y < H; y++) {
      const i = (x * SIZE + z) * H + y;
      arr[i] = channel === "sky" ? (y >= heights[x * SIZE + z] ? 15 : 0) : lightEmission(w.get(x, y, z));
      const edge = x === 0 || z === 0 || x === SIZE - 1 || z === SIZE - 1 || y === H - 1;
      if (edge && cost[i] < 15) arr[i] = Math.max(arr[i], outside - cost[i]);
      queue.push(i);
    }
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q], v = arr[i], y = i % H, t = (i - y) / H, z = t % SIZE, x = (t - z) / SIZE;
      for (const [ok, j] of [[y + 1 < H, i + 1], [y > 0, i - 1], [z + 1 < SIZE, i + H], [z > 0, i - H], [x + 1 < SIZE, i + SIZE * H], [x > 0, i - SIZE * H]])
        if (ok && cost[j] < 15 && v - cost[j] > arr[j]) { arr[j] = v - cost[j]; queue.push(j); }
    }
    out[channel] = arr;
  }
  return out;
}

test("LightVolume matches a plain reference solver on Java terrain, before and after edits", () => {
  const w = new World("17", "javaStreamed", 12);
  w.blockLight = () => 0;
  const H = w.height, emission = (x, y, z, b) => lightEmission(b);
  // Torches in a cave mouth and under an overhang, a glass-free roof, water and a hole to the void.
  for (const [x, y, z, b] of [[40, 50, 40, 20], [41, 50, 40, 0], [90, 100, 90, 1], [90, 99, 90, 20], [10, 70, 100, 9], [127, 80, 64, 42], [0, 90, 0, 20]])
    w.set(x, y, z, b);
  for (let a = 80; a < 100; a++) for (let b = 80; b < 100; b++) w.set(a, 120, b, 1);
  const light = new LightVolume(w, emission), same = (label) => {
    const ref = referenceLight(w, H);
    assert.ok(Buffer.from(light.sky).equals(Buffer.from(ref.sky)), `${label}: sky light`);
    assert.ok(Buffer.from(light.block).equals(Buffer.from(ref.block)), `${label}: block light`);
  };
  same("fresh volume");
  for (const [x, y, z, b] of [[90, 120, 90, 0], [85, 120, 85, 0], [40, 50, 41, 20], [64, w.surface(64, 64) - 1, 64, 0], [60, 140, 60, 1]]) {
    w.set(x, y, z, b);
    light.update(x, y, z);
  }
  same("after updates");
});

test("smooth lighting darkens a floor corner under an overhang", () => {
  const w = flat();
  for (let x = 40; x < 44; x++) for (let z = 40; z < 44; z++) w.put(x, 12, z, 3);
  w.put(39, 10, 39, 3);
  const light = new LightVolume(w);
  const corners = [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]];
  const open = smoothFace(light, 20, 9, 20, 2, corners);
  assert.deepEqual(open.ao.map((a) => a.toFixed(3)), ["1.000", "1.000", "1.000", "1.000"]);
  const nook = smoothFace(light, 40, 9, 40, 2, corners);
  assert.ok(nook.ao[0] < 1, "the stone block beside the corner occludes it");
  assert.ok(nook.packed[2] >> 20 < 15, "sky light under the overhang is reduced");
});
