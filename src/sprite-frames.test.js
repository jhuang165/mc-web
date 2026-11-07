// Compass / clock frame counts and the original TextureCompass / TextureClock replays with strips of other lengths
// (maps-clock-reference.json clockFrames / compassFrames, from the unchanged bql / bqm; tools/verify-maps-clock.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spriteFrameCount } from "./sprite-frames.js";
import { celestialAngle, createClock, tickClock } from "./clock.js";
import { compassAngle, createCompass, tickCompass, itemFrameCompassFrame } from "./compass.js";

const ref = JSON.parse(await readFile(new URL("../public/research/maps-clock-reference.json", import.meta.url)));
const by = (c) => ref.records.filter((r) => r.case === c);

test("the sprite frame list size follows loadSprite (bqd.a / bqd.e)", () => {
  assert.deepEqual(spriteFrameCount('{"animation":{}}', 16, 512), { count: 32, rejected: null });
  assert.deepEqual(spriteFrameCount('{"animation":{}}', 32, 64 * 32), { count: 64, rejected: null });
  assert.equal(spriteFrameCount(null, 16, 16).count, 1); // a square pack texture: one frame
  assert.equal(spriteFrameCount('{"animation":{"frames":[0,1,5]}}', 16, 16 * 8).count, 6); // padded up to the largest index
  assert.equal(spriteFrameCount('{"animation":{"frametime":9}}', 16, 16 * 7).count, 7); // frametime is ignored by both sprites
  const bare = spriteFrameCount(null, 16, 16 * 10); // native: missing texture; tolerated here
  assert.equal(bare.count, 10);
  assert.match(bare.rejected, /broken aspect ratio/);
  assert.match(spriteFrameCount('{"animation":{"frames":[0,9]}}', 16, 16 * 4).rejected, /invalid frameindex 9/);
  assert.equal(spriteFrameCount("not json", 16, 16 * 4).count, 4);
});

test("TextureClock matches the original for frame lists of 1 to 128 entries", () => {
  const records = by("clockFrames");
  assert.equal(records.length, 30);
  for (const r of records) {
    const clock = createClock(), samples = new Map(r.samples.map((s) => [s[0], s]));
    for (let i = 0; i < 120; i++) {
      tickClock(clock, celestialAngle(r.time), r.frames);
      const s = samples.get(i);
      if (s) { assert.equal(clock.frame, s[1], `${r.frames} frames, time ${r.time}, tick ${i}`); assert.equal(clock.angle, s[2]); }
    }
  }
});

test("TextureCompass matches the original for frame lists of 1 to 128 entries, settled and as set by an item frame", () => {
  const records = by("compassFrames");
  assert.equal(records.length, 36);
  for (const r of records) {
    const compass = createCompass(), samples = new Map(r.samples.map((s) => [s[0], s])), spawn = [r.spawn[0], 64, r.spawn[1]];
    const position = { x: r.player[0], z: r.player[1] };
    for (let i = 0; i < 100; i++) {
      tickCompass(compass, compassAngle(position, Math.fround(r.player[2]), spawn, true), r.frames);
      const s = samples.get(i);
      if (s) { assert.equal(compass.frame, s[1], `${r.frames} frames, player ${r.player}, tick ${i}`); assert.equal(compass.angle, s[2]); assert.equal(compass.velocity, s[3]); }
    }
    for (const [dir, frame] of r.frame) assert.equal(itemFrameCompassFrame(position.x, position.z, dir, spawn, true, r.frames), frame, `item frame dir ${dir}, ${r.frames} frames, ${r.player}`);
  }
});

test("a framed compass spins at random in the Nether and End", () => {
  assert.equal(itemFrameCompassFrame(3, 4, 2, [0, 64, 0], false, 32, () => 0), 0);
  const seen = new Set();
  for (let k = 0; k < 20; k++) seen.add(itemFrameCompassFrame(3, 4, 2, [0, 64, 0], false, 32, () => k / 20));
  assert.ok(seen.size > 10);
});
