import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseAnimationMcmeta, spriteFrames, SpriteAnimation, resolveAnimation, stripOffset } from "./texture-animation.js";

const reference = JSON.parse(readFileSync(new URL("../public/research/texture-animation-reference.json", import.meta.url), "utf8"));

test("animation reference covers the vanilla files and the error cases", () => {
  assert.equal(reference.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  assert.ok(reference.cases.length >= 30);
  assert.ok(reference.cases.filter((c) => c.parseError || c.loadError).length >= 10);
});

test("mcmeta parsing and sprite loading match the native serializer for every probe case", () => {
  for (const c of reference.cases) {
    const nativeError = c.parseError || c.loadError;
    let meta, anim, error = null;
    try {
      meta = c.mcmeta == null ? null : parseAnimationMcmeta(c.mcmeta);
      anim = new SpriteAnimation(spriteFrames(meta, c.width, c.height));
    } catch (e) { error = e; }
    if (nativeError) { assert.ok(error, `${c.name}: native rejected it (${nativeError})`); continue; }
    assert.equal(error, null, `${c.name}: ${error?.message}`);
    if (c.meta) {
      assert.equal(meta.frametime, c.meta.frametime, c.name);
      assert.equal(meta.width, c.meta.width, c.name);
      assert.equal(meta.height, c.meta.height, c.name);
      assert.deepEqual(meta.frames.map((f) => [f.index, f.time]), c.meta.frames, c.name);
    } else assert.equal(meta, null, c.name);
    // TextureAtlasSprite.updateAnimation: the frame index shown after every tick, stepped and in closed form.
    if (c.frames.length > 1) for (let t = 0; t < c.ticks; t++) {
      assert.equal(anim.frame, c.frames[t], `${c.name} tick ${t}`);
      assert.equal(anim.frameAtTick(t), c.frames[t], `${c.name} closed form ${t}`);
      anim.step();
    }
  }
});

test("native error messages show up as errors here too", () => {
  assert.throws(() => parseAnimationMcmeta('{"animation":{"frametime":0}}'), /default frame time/);
  assert.throws(() => parseAnimationMcmeta('{"animation":{"frames":[{"index":0,"time":0}]}}'), /frame time/);
  assert.throws(() => parseAnimationMcmeta('{"animation":{"frames":5}}'), /frames/);
  assert.throws(() => spriteFrames(parseAnimationMcmeta('{"animation":{"frames":[4]}}'), 16, 64), /invalid frameindex 4/);
  assert.throws(() => spriteFrames(null, 16, 64), /broken aspect ratio/);
  assert.equal(parseAnimationMcmeta('{"texture":{"blur":true}}'), null);
});

test("1.7.10 has no interpolate key: it is ignored and frames step in whole frames", () => {
  const meta = parseAnimationMcmeta('{"animation":{"interpolate":true,"frametime":2}}');
  assert.deepEqual(Object.keys(meta).sort(), ["frames", "frametime", "height", "width"]);
});

test("lenient wrapper keeps a broken pack texture usable", () => {
  const a = resolveAnimation('{"animation":{"frametime":0}}', 16, 64);
  assert.equal(a.count, 4);
  assert.match(a.error, /frame time/);
  assert.equal(resolveAnimation(null, 16, 16).count, 1);
  assert.equal(resolveAnimation(null, 16, 64).count, 4); // native: missing texture; here the strip plays
});

// The scene used hard-coded phases for the vanilla animated textures; the mcmeta-driven ones must match them exactly.
const vanilla = (name) => {
  const dir = new URL("../public/media/1.7.10/blocks/", import.meta.url);
  const png = readFileSync(new URL(name + ".png", dir)), w = png.readUInt32BE(16), h = png.readUInt32BE(20);
  const anim = resolveAnimation(readFileSync(new URL(name + ".png.mcmeta", dir), "utf8"), w, h);
  return { anim, count: anim.count, offset: (tick) => stripOffset(anim.frameAtTick(tick), anim.count) };
};
test("vanilla mcmeta reproduces the old hard-coded water, lava, fire and portal phases", () => {
  const water = vanilla("water_still"), flow = vanilla("water_flow"), portal = vanilla("portal"), lavaS = vanilla("lava_still"), lavaF = vanilla("lava_flow"), f0 = vanilla("fire_layer_0"), f1 = vanilla("fire_layer_1");
  assert.deepEqual([water.count, flow.count, portal.count, lavaS.count, lavaF.count, f0.count, f1.count], [32, 32, 32, 20, 16, 32, 32]);
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 20000; i++) {
    const time = i < 2000 ? i / 20 : rnd() * 5000, tick = Math.floor(time * 20);
    const step = Math.floor(time * 10) % 38, fireStep = Math.floor(time * 20) % 32;
    assert.equal(water.offset(tick), 1 - ((Math.floor(time * 10) % 32) + 1) / 32);
    assert.equal(flow.offset(tick), 1 - ((Math.floor(time * 20) % 32) + 1) / 32);
    assert.equal(portal.offset(tick), 1 - ((Math.floor(time * 20) % 32) + 1) / 32);
    assert.equal(lavaS.offset(tick), 1 - ((step < 20 ? step : 38 - step) + 1) / 20);
    assert.equal(lavaF.offset(tick), 1 - ((Math.floor((time * 20) / 3) % 16) + 1) / 16);
    assert.equal(f0.offset(tick), 1 - (((fireStep + 16) % 32) + 1) / 32);
    assert.equal(f1.offset(tick), 1 - (fireStep + 1) / 32);
  }
});
