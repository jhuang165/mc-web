import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  SHADER_LIST, NO_SHADER, nextShaderIndex, parsePostChain, parseProgram, parseBlend, convertGlsl, glslUniformDefaults, ShaderClock, orthoProjection,
  ANAGLYPH, anaglyphProjectionShift, anaglyphEyeShift, anaglyphColor, anaglyphFog, randomSuperSecretEvent, SUPER_SECRET_SOUND, SUPER_SECRET_CATEGORIES,
} from "./post-shaders.js";
import { applyOptionsTxt, writeOptionsTxt } from "./options-txt.js";

const root = new URL("../public/", import.meta.url);
const ref = JSON.parse(readFileSync(new URL("research/post-shaders-reference.json", root)));
const dir = new URL("media/1.7.10/shaders/", root);
const json = (p) => JSON.parse(readFileSync(new URL(p, dir)));
const text = (p) => readFileSync(new URL(p, dir), "utf8");
const SIZE = { width: 854, height: 480 };

test("the shader list and the F4 / button cycle match the bytecode", () => {
  assert.deepEqual(SHADER_LIST, ref.shaderList);
  assert.equal(SHADER_LIST.length, 22);
  assert.equal(NO_SHADER, ref.noShaderIndex);
  let i = NO_SHADER;
  const seen = [];
  for (let n = 0; n < 23; n++) { i = nextShaderIndex(i); seen.push(i); }
  assert.deepEqual(seen, [...Array(23).keys()]); // 0..22, ending on "none" after a full lap
  assert.equal(nextShaderIndex(21), NO_SHADER);
  assert.equal(nextShaderIndex(NO_SHADER), 0);
});

test("every shipped post chain parses and every pass is wired to known targets and programs", () => {
  for (const name of SHADER_LIST) {
    const chain = parsePostChain(json(`post/${name}.json`), SIZE);
    assert.ok(chain.passes.length > 0, name);
    const targets = new Set(["minecraft:main", ...chain.targets.map((t) => t.name)]);
    for (const p of chain.passes) {
      assert.ok(targets.has(p.intarget) && targets.has(p.outtarget), `${name}/${p.name}`);
      assert.ok(existsSync(new URL(`program/${p.name}.json`, dir)), `${name} needs program ${p.name}`);
      for (const a of p.aux) if (!a.target) assert.ok(existsSync(new URL(`../effect/${a.id}.png`, dir)), `${name} aux ${a.id}`);
    }
  }
});

test("parsePostChain: target sizes default to the framebuffer and errors name the offender", () => {
  const c = parsePostChain({ targets: ["a", { name: "b", width: 16, height: 8 }], passes: [{ name: "blit", intarget: "minecraft:main", outtarget: "a", auxtargets: [{ name: "Prev", id: "b" }, { name: "Noise", id: "dither", width: 4, height: 4, bilinear: false }], uniforms: [{ name: "X", values: [1, 2] }] }] }, SIZE);
  assert.deepEqual(c.targets, [{ name: "a", ...SIZE }, { name: "b", width: 16, height: 8 }]);
  assert.deepEqual(c.passes[0].aux.map((a) => [a.target, a.id]), [[true, "b"], [false, "dither"]]);
  assert.deepEqual(c.passes[0].uniforms, [{ name: "X", values: [1, 2] }]);
  assert.throws(() => parsePostChain({ targets: ["a", "a"] }, SIZE), /already defined/);
  assert.throws(() => parsePostChain({ passes: [{ name: "p", intarget: "nope", outtarget: "minecraft:main" }] }, SIZE), /Input target 'nope' does not exist/);
  assert.throws(() => parsePostChain({ passes: [{ name: "p", intarget: "minecraft:main", outtarget: "minecraft:main", uniforms: [{ name: "u", values: [] }] }] }, SIZE), /expected 1-4/);
});

test("program JSON: every shipped program parses, with the add one/zero overwrite blend and defaults sized to their count", () => {
  const programs = new Set();
  for (const name of SHADER_LIST) for (const p of parsePostChain(json(`post/${name}.json`), SIZE).passes) programs.add(p.name);
  assert.ok(programs.size >= 20);
  for (const name of programs) {
    const def = parseProgram(json(`program/${name}.json`));
    assert.equal(def.blend.enabled, false, name);
    assert.ok(def.samplers.includes("DiffuseSampler"), name);
    for (const [k, u] of Object.entries(def.uniforms)) if (u.values.length) assert.equal(u.values.length, u.count, `${name}.${k}`);
  }
  assert.equal(parseBlend({ func: "add", srcrgb: "srcalpha", dstrgb: "1-srcalpha" }).enabled, true);
  assert.throws(() => parseBlend({ func: "nope" }), /Unknown blend/);
});

test("GLSL 1.20 converts to GLSL ES 3.00 for every shipped program", () => {
  const programs = new Set();
  for (const name of SHADER_LIST) for (const p of parsePostChain(json(`post/${name}.json`), SIZE).passes) programs.add(p.name);
  for (const name of programs) {
    const def = parseProgram(json(`program/${name}.json`));
    for (const [stage, file, ext] of [["vertex", def.vertex, "vsh"], ["fragment", def.fragment, "fsh"]]) {
      const out = convertGlsl(text(`program/${file}.${ext}`), stage);
      const label = `${name}/${file}.${ext}`;
      assert.doesNotMatch(out, /#version|#extension|\bvarying\b|\battribute\b|\bgl_FragColor\b|\btexture2D\b/, label);
      assert.doesNotMatch(out, /^\s*uniform\s+\w+\s+\w+\s*=/m, label + " keeps a uniform initialiser");
      assert.match(out, /^precision highp float;/, label);
      if (stage === "fragment") assert.match(out, /out vec4 fragColor;[\s\S]*fragColor\s*=/, label);
      else assert.match(out, /\bgl_Position\b/, label);
    }
  }
});

test("GLSL conversion details", () => {
  assert.equal(convertGlsl("varying vec2 t;\nattribute vec4 Position;\nvoid main(){}", "vertex").includes("out vec2 t;"), true);
  assert.match(convertGlsl("varying vec2 t;\nvoid main(){ gl_FragColor = texture2D(s, t); }", "fragment"), /in vec2 t;[\s\S]*fragColor = texture\(s, t\)/);
  assert.match(convertGlsl("void main(){ gl_FragColor = texture2DLod(s, t, 0.0); }", "fragment"), /textureLod\(/);
  assert.deepEqual(glslUniformDefaults("uniform float A = 1.5;\nuniform vec3 B = vec3(-1.0,  0.0, 0.5);\nuniform sampler2D S;"), { A: 1.5, B: [-1, 0, 0.5] });
  assert.match(convertGlsl("uniform float A = 1.5;", "fragment"), /uniform float A;/);
  // The int/float literal mixes GLSL ES rejects (wobble.fsh, bumpy.fsh).
  assert.match(convertGlsl(text("program/wobble.fsh"), "fragment"), /float g = 2\.0 - abs/);
  assert.match(convertGlsl(text("program/bumpy.fsh"), "fragment"), /clamp\(f, 0\.5, 2\.0\)/);
  assert.throws(() => convertGlsl("", "geometry"), /stage/);
});

test("ShaderGroup Time: partial ticks accumulate, wrap at 20 and divide by 20", () => {
  const c = new ShaderClock();
  assert.ok(Math.abs(c.advance(0.5) - 0.5 / 20) < 1e-6);
  assert.ok(Math.abs(c.advance(0.25) - (0.5 + 1 - 0.5 + 0.25) / 20) < 1e-6); // 0.25 < 0.5: the new tick adds (1 - last) + partial
  assert.ok(Math.abs(c.advance(0.75) - (0.5 + 0.75 + 0.5) / 20) < 1e-6);
  const d = new ShaderClock();
  let t = 0;
  for (let i = 0; i < 100; i++) t = d.advance(((i * 0.37) % 1));
  assert.ok(t >= 0 && t <= 1);
});

test("ProjMat is orthographic(0, w, h, 0, 0.1, 1000)", () => {
  const m = orthoProjection(854, 480);
  assert.ok(Math.abs(m[0] - 2 / 854) < 1e-9 && Math.abs(m[5] + 2 / 480) < 1e-9);
  assert.equal(m[3], -1);
  assert.equal(m[7], 1);
  // Every shipped vertex shader replaces z with 0.2 (gl_Position = vec4(outPos.xy, 0.2, 1.0)), so only x and y matter.
});

test("3D Anaglyph offsets, masks and colour formulas match the bytecode constants", () => {
  assert.equal(ANAGLYPH.projectionShift, ref.anaglyph.projectionShift);
  assert.equal(ANAGLYPH.eyeShift, ref.anaglyph.eyeShift);
  assert.ok(Math.abs(anaglyphProjectionShift(0) - 0.07) < 1e-6 && Math.abs(anaglyphProjectionShift(1) + 0.07) < 1e-6);
  assert.ok(Math.abs(anaglyphEyeShift(0) + 0.1) < 1e-6 && Math.abs(anaglyphEyeShift(1) - 0.1) < 1e-6);
  assert.deepEqual(ANAGLYPH.passMask, [[false, true, true], [true, false, false]]);
  assert.equal(anaglyphColor(0xff000000), 0xff000000);
  assert.equal(anaglyphColor(0xffffffff), 0xffffffff); // (30 + 59 + 11) * 255 / 100 = 255 on R, 255 on G and B
  assert.equal(anaglyphColor(0x80ff0000) >>> 0, ((0x80 << 24) | (76 << 16) | (76 << 8) | 76) >>> 0); // red: 30 * 255 / 100 = 76 on every channel
  const [r, g, b] = anaglyphFog([1, 0, 0]);
  assert.ok(Math.abs(r - 0.3) < 1e-6 && Math.abs(g - 0.3) < 1e-6 && Math.abs(b - 0.3) < 1e-6);
  assert.deepEqual(anaglyphFog([0, 1, 0]).map((v) => Math.round(v * 100)), [59, 70, 0]);
});

test("the Super Secret Settings sound comes from the five categories at volume 0.25 and pitch 0.5", () => {
  assert.deepEqual(SUPER_SECRET_SOUND, { volume: ref.button.volume, pitch: ref.button.pitch });
  assert.deepEqual(SUPER_SECRET_CATEGORIES, ["neutral", "block", "hostile", "player", "weather"]);
  const events = { "a.b": { category: "neutral" }, "c.d": { category: "block" }, "gui.button.press": { category: "master" }, "e.f": { category: "music" }, "g.h": { category: "weather" } };
  assert.equal(randomSuperSecretEvent(events, () => 0), "a.b");
  assert.equal(randomSuperSecretEvent(events, () => 0.99), "g.h");
  assert.equal(randomSuperSecretEvent({ x: { category: "music" } }), null);
  const manifest = JSON.parse(readFileSync(new URL("audio/1.7.10/manifest.json", root), "utf8").toString());
  assert.ok(randomSuperSecretEvent(manifest.events) !== null);
});

test("anaglyph persists as options.txt anaglyph3d", () => {
  const o = applyOptionsTxt({}, "anaglyph3d:true\n").options;
  assert.equal(o.anaglyph, true);
  assert.match(writeOptionsTxt({ ...o }), /^anaglyph3d:true$/m);
  assert.match(writeOptionsTxt({}), /^anaglyph3d:false$/m);
});
