// EntityRenderer post-processing ("Super Secret Settings" shaders) and 3D Anaglyph for the 1.7.10 port.
// Evidence and remaining differences: public/research/post-shaders.md. The pure parts (the shader list and
// its cycling, ShaderGroup/ShaderManager JSON parsing, the GLSL 1.20 -> GLSL ES 3.00 conversion, the
// ShaderGroup clock, the anaglyph constants) have no three.js dependency and are replayed by
// post-shaders.test.js; PostProcessor at the bottom drives three.js render targets.
import * as THREE from "three";

// EntityRenderer.shaderResourceLocations (blt.ad): 22 entries; the index 22 (blt.e, the array length) is "no effect".
export const SHADER_LIST = [
  "notch", "fxaa", "art", "bumpy", "blobs2", "pencil", "color_convolve", "deconverge", "flip", "invert", "ntsc",
  "outline", "phosphor", "scan_pincushion", "sobel", "bits", "desaturate", "green", "blur", "wobble", "blobs", "antialias",
];
export const NO_SHADER = SHADER_LIST.length;
// EntityRenderer.activateNextShader (blt.c): (index + 1) % (length + 1), so the cycle visits every effect and then
// "No effect selected" before it wraps. F4 (Minecraft.runTick, key 62) calls deactivateShader (blt.b): index = none.
export const nextShaderIndex = (index) => (index + 1) % (SHADER_LIST.length + 1);

// --- Shader JSON -> pass graph (ShaderGroup bpj / ShaderManager bpi / BlendState bpg) ---------------------

export const MAIN_TARGET = "minecraft:main";
const fail = (message) => { throw new Error(message); };
const int = (o, key, def) => (o[key] === undefined ? (typeof def === "function" ? def() : def) : Number.isInteger(o[key]) ? o[key] : fail(`Expected ${key} to be an int`));
const str = (o, key) => (typeof o[key] === "string" ? o[key] : fail(`Missing ${key}, expected to find a string`));

// ShaderGroup.parseGroup. `size` is the main framebuffer size: a target without width/height takes it, and
// `resized` lists the targets (the main-sized ones) that follow a window resize.
export function parsePostChain(json, size) {
  const targets = [], passes = [];
  const known = new Set([MAIN_TARGET]);
  (json.targets ?? []).forEach((t, i) => {
    try {
      const o = typeof t === "string" ? { name: t } : t;
      const name = str(o, "name");
      if (known.has(name)) fail(name + " is already defined");
      known.add(name);
      targets.push({ name, width: int(o, "width", size.width), height: int(o, "height", size.height) });
    } catch (e) { throw new Error(`${e.message} (targets[${i}])`); }
  });
  (json.passes ?? []).forEach((p, i) => {
    try {
      const name = str(p, "name"), intarget = str(p, "intarget"), outtarget = str(p, "outtarget");
      if (!known.has(intarget)) fail(`Input target '${intarget}' does not exist`);
      if (!known.has(outtarget)) fail(`Output target '${outtarget}' does not exist`);
      const aux = (p.auxtargets ?? []).map((a, k) => {
        try {
          const aname = str(a, "name"), id = str(a, "id");
          // A known target is sampled at its own size; anything else is textures/effect/<id>.png at the given size.
          if (known.has(id)) return { name: aname, id, target: true };
          return { name: aname, id, target: false, width: int(a, "width", () => fail("Missing width")), height: int(a, "height", () => fail("Missing height")), bilinear: a.bilinear === true };
        } catch (e) { throw new Error(`${e.message} (auxtargets[${k}])`); }
      });
      const uniforms = (p.uniforms ?? []).map((u, k) => {
        const values = (u.values ?? []).map(Number);
        if (values.length < 1 || values.length > 4) throw new Error(`Invalid amount of values specified (expected 1-4, found ${values.length}) (uniforms[${k}])`);
        return { name: str(u, "name"), values };
      });
      passes.push({ name, intarget, outtarget, aux, uniforms });
    } catch (e) { throw new Error(`${e.message} (passes[${i}])`); }
  });
  return { targets, passes };
}

// BlendState.parse: the GL blend equation and factors named in a program JSON ("func", "srcrgb", ...).
const BLEND_FACTORS = { zero: "ZeroFactor", one: "OneFactor", srcalpha: "SrcAlphaFactor", "1-srcalpha": "OneMinusSrcAlphaFactor", dstalpha: "DstAlphaFactor", "1-dstalpha": "OneMinusDstAlphaFactor", srccolor: "SrcColorFactor", "1-srccolor": "OneMinusSrcColorFactor", dstcolor: "DstColorFactor", "1-dstcolor": "OneMinusDstColorFactor" };
const BLEND_EQUATIONS = { add: "AddEquation", subtract: "SubtractEquation", reversesubtract: "ReverseSubtractEquation", reverse_subtract: "ReverseSubtractEquation", min: "MinEquation", max: "MaxEquation" };
export function parseBlend(blend) {
  if (!blend) return { func: "add", src: "one", dst: "zero", enabled: false }; // BlendState() with no "blend": disabled
  const func = String(blend.func ?? "add").toLowerCase(), src = String(blend.srcrgb ?? "one").toLowerCase(), dst = String(blend.dstrgb ?? "zero").toLowerCase();
  if (!(func in BLEND_EQUATIONS) || !(src in BLEND_FACTORS) || !(dst in BLEND_FACTORS)) fail("Unknown blend state " + JSON.stringify(blend));
  // add one/zero is a plain overwrite, which every 1.7.10 program uses; the others are kept for completeness.
  return { func, src, dst, enabled: !(func === "add" && src === "one" && dst === "zero") };
}

// ShaderManager's constructor: the program's own JSON (vertex, fragment, samplers, uniform defaults).
export function parseProgram(json) {
  const uniforms = {};
  for (const u of json.uniforms ?? []) {
    const name = str(u, "name"), type = str(u, "type"), count = int(u, "count", 0), values = (u.values ?? []).map(Number);
    if (!["int", "float", "matrix4x2", "matrix4x4"].includes(type) && !/^matrix/.test(type)) fail(`${name} (${type}) is not a valid type`);
    if (values.length > 0 && values.length !== count) fail(`Invalid amount of values specified (expected ${count}, found ${values.length})`);
    uniforms[name] = { type, count, values };
  }
  return {
    vertex: str(json, "vertex"), fragment: str(json, "fragment"), blend: parseBlend(json.blend), cull: json.cull !== false,
    attributes: json.attributes ?? [], samplers: (json.samplers ?? []).map((s) => str(s, "name")), uniforms,
  };
}

// --- GLSL 1.20 -> GLSL ES 3.00 ---------------------------------------------------------------------------

// Fixes for constructs GLSL 1.20 accepts and ES does not: implicit int -> float literals and uniform initialisers.
// Each is an exact source text from the shipped programs (checked by the tests, which fail if a shader changes).
const LITERAL_FIXES = [
  ["float g = 2 - abs(h * 6.0 - 2.0);", "float g = 2.0 - abs(h * 6.0 - 2.0);"],
  ["float b = 2 - abs(h * 6.0 - 4.0);", "float b = 2.0 - abs(h * 6.0 - 4.0);"],
  ["if (c != 0)", "if (c != 0.0)"],
  ["clamp(f, 0.5, 2)", "clamp(f, 0.5, 2.0)"],
];
export function convertGlsl(source, stage) {
  if (stage !== "vertex" && stage !== "fragment") throw new Error("Unknown shader stage " + stage);
  let s = source.replace(/^\s*#version\s+\d+\s*$/m, "").replace(/^\s*#extension[^\n]*$/gm, "");
  for (const [from, to] of LITERAL_FIXES) s = s.split(from).join(to);
  // uniform float Saturation = 1.5; -> uniform float Saturation;  (the defaults come from the program JSON)
  s = s.replace(/^(\s*uniform\s+\w+\s+\w+)\s*=\s*[^;]+;/gm, "$1;");
  s = s.replace(/\bvarying\b/g, stage === "vertex" ? "out" : "in");
  if (stage === "vertex") s = s.replace(/\battribute\b/g, "in");
  else s = s.replace(/\btexture2DLod\s*\(/g, "textureLod(").replace(/\btexture2D\s*\(/g, "texture(").replace(/\bgl_FragColor\b/g, "fragColor");
  // fxaa.fsh takes its textureOffset branch with __VERSION__ >= 130, which 300 es satisfies.
  const head = "precision highp float;\nprecision highp int;\nprecision highp sampler2D;\n" + (stage === "fragment" ? "out vec4 fragColor;\n" : "");
  return head + s;
}

// The initialisers GLSL 1.20 allows on a uniform (`uniform float Saturation = 1.5;`): the values the program starts with
// before its JSON or the pass overrides them. Returns { name: number | number[] }.
export function glslUniformDefaults(source) {
  const out = {};
  for (const m of source.matchAll(/^\s*uniform\s+(float|int|vec[234])\s+(\w+)\s*=\s*([^;]+);/gm)) {
    const nums = m[3].replace(/^[^(]*\(/, "").match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi).map(Number);
    out[m[2]] = m[1] === "float" || m[1] === "int" ? nums[0] : nums;
  }
  return out;
}

// --- ShaderGroup clock and projection --------------------------------------------------------------------

// ShaderGroup.render (bpj.a(float)): the Time uniform is a tick counter driven by the partial tick, wrapped at 20 and
// divided by 20, so every 1.0 of Time is one second at 20 ticks per second.
export class ShaderClock {
  constructor() { this.time = 0; this.last = 0; }
  advance(partial) {
    const f = Math.fround;
    if (partial < this.last) { this.time = f(this.time + f(1 - this.last)); this.time = f(this.time + partial); }
    else this.time = f(this.time + f(partial - this.last));
    this.last = partial;
    while (this.time > 20) this.time = f(this.time - 20);
    return f(this.time / 20);
  }
}
// ShaderGroup.createBindFramebuffers (bpj.c): orthographic(0, w, h, 0, 0.1, 1000), the row-major ProjMat the programs take.
export function orthoProjection(width, height) {
  const f = Math.fround;
  return [f(2 / width), 0, 0, -1, 0, f(2 / -height), 0, 1, 0, 0, f(-0.0020001999), f(-1.0001999), 0, 0, 0, 1];
}

// --- 3D Anaglyph (EntityRenderer / TextureUtil) -----------------------------------------------------------

// bytecode-read (blt.a(FI) and blt.b(FI)): the projection is translated by -(pass * 2 - 1) * 0.07 (in clip space, ahead of
// gluPerspective) and the modelview by (pass * 2 - 1) * 0.1 blocks; renderWorld masks pass 0 to green and blue (cyan),
// pass 1 to red, and restores the full mask after the loop.
export const ANAGLYPH = { projectionShift: 0.07, eyeShift: 0.1, passMask: [[false, true, true], [true, false, false]] };
export const anaglyphProjectionShift = (pass) => Math.fround(-(pass * 2 - 1) * Math.fround(ANAGLYPH.projectionShift));
export const anaglyphEyeShift = (pass) => Math.fround((pass * 2 - 1) * Math.fround(ANAGLYPH.eyeShift));
// TextureUtil.anaglyphColor (bqi.a(int[])) on one packed ARGB pixel, and the float form of updateFogColor.
export function anaglyphColor(argb) {
  const a = argb >>> 24 & 255, r = argb >>> 16 & 255, g = argb >>> 8 & 255, b = argb & 255;
  const R = Math.trunc((r * 30 + g * 59 + b * 11) / 100), G = Math.trunc((r * 30 + g * 70) / 100), B = Math.trunc((r * 30 + b * 70) / 100);
  return ((a << 24) | (R << 16) | (G << 8) | B) >>> 0;
}
export function anaglyphFog([r, g, b]) {
  const f = Math.fround;
  return [f(f(f(f(r * 30) + f(g * 59)) + f(b * 11)) / 100), f(f(f(r * 30) + f(g * 70)) / 100), f(f(f(r * 30) + f(b * 70)) / 100)];
}

// --- three.js driver ---------------------------------------------------------------------------------------

const QUAD_VS = "in vec3 Position;\nout vec2 uv;\nvoid main(){ uv = Position.xy * 0.5 + 0.5; gl_Position = vec4(Position.xy, 0.0, 1.0); }";
const BLIT_FS = "uniform sampler2D tex;\nin vec2 uv;\nvoid main(){ fragColor = vec4(texture(tex, uv).rgb, 1.0); }";
// Native merge: only the pass colour masks (eye 0 writes G and B, eye 1 writes R). The colour conversion happens earlier, at texture
// upload and for fog/sky/cloud colours (anaglyph.js). `legacy` converts the final pixels instead (the pre-batch-27 method, kept
// for comparison: window.__mcweb.post.legacyAnaglyph = true).
const ANAGLYPH_FS = [
  "uniform sampler2D eye0;\nuniform sampler2D eye1;\nuniform float legacy;\nin vec2 uv;",
  "vec3 conv(vec3 c){ return vec3((c.r * 30.0 + c.g * 59.0 + c.b * 11.0) / 100.0, (c.r * 30.0 + c.g * 70.0) / 100.0, (c.r * 30.0 + c.b * 70.0) / 100.0); }",
  "void main(){ vec3 a = texture(eye0, uv).rgb, b = texture(eye1, uv).rgb; if (legacy > 0.5) { a = conv(a); b = conv(b); } fragColor = vec4(b.r, a.g, a.b, 1.0); }",
].join("\n");

const target = (THREE_, w, h, depth) => new THREE_.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), { depthBuffer: depth, minFilter: THREE_.NearestFilter, magFilter: THREE_.NearestFilter, format: THREE_.RGBAFormat, type: THREE_.UnsignedByteType });

export class PostProcessor {
  // `anaglyph()` reports GameSettings.anaglyph. Assets are fetched from `base` (public/media/1.7.10).
  constructor(renderer, { anaglyph = () => false, base = "/media/1.7.10/", fetchJson, fetchText, loadTexture } = {}) {
    this.renderer = renderer;
    this.anaglyph = anaglyph;
    this.base = base;
    this.fetchJson = fetchJson ?? (async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(r.status + " " + u); return r.json(); });
    this.fetchText = fetchText ?? (async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(r.status + " " + u); return r.text(); });
    this.loadTexture = loadTexture ?? ((u) => new Promise((ok, no) => new THREE.TextureLoader().load(u, ok, undefined, no)));
    this.index = NO_SHADER;
    this.group = null;
    this.errors = [];
    this.active = false;
    this.size = new THREE.Vector2();
    this.programs = new Map();
    this.textures = new Map();
    // Both full-screen quads (the anaglyph merge and the final blit) share one geometry and camera.
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.fsGeometry = new THREE.BufferGeometry();
    this.fsGeometry.setAttribute("Position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
    this.fsGeometry.setIndex([0, 1, 2, 0, 2, 3]);
    this.blit = this.#screenQuad(BLIT_FS, { tex: { value: null } });
    this.merge = this.#screenQuad(ANAGLYPH_FS, { eye0: { value: null }, eye1: { value: null }, legacy: { value: 0 } });
    // The wrapped renderer methods run twice per frame in anaglyph mode (see #wrap).
    this.#wrap();
  }
  #screenQuad(fs, uniforms) {
    const material = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: "precision highp float;\n" + QUAD_VS, fragmentShader: "precision highp float;\nout vec4 fragColor;\n" + fs, uniforms, depthTest: false, depthWrite: false });
    const mesh = new THREE.Mesh(this.fsGeometry, material);
    mesh.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(mesh);
    return { scene, material };
  }
  get shaderName() { return this.index === NO_SHADER ? null : SHADER_LIST[this.index]; }

  // GuiOptions "Super Secret Settings..." (blt.c): the next effect, or none after the last.
  activateNextShader() {
    this.group?.dispose();
    this.group = null;
    this.index = nextShaderIndex(this.index);
    if (this.index === NO_SHADER) return Promise.resolve(null);
    const index = this.index, name = SHADER_LIST[index];
    const loading = this.#load(name).then((group) => { if (this.index === index) this.group = group; return group; }, (e) => {
      this.errors.push(e);
      console.warn("Failed to load shader: shaders/post/" + name + ".json", e);
      if (this.index === index) this.index = NO_SHADER;
      return null;
    });
    this.loading = loading;
    return loading;
  }
  // Minecraft.runTick F4 (blt.b): the effect is dropped and the index returns to "none".
  deactivateShader() {
    this.group?.dispose();
    this.group = null;
    this.index = NO_SHADER;
  }

  async #load(name) {
    const drawing = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const chain = parsePostChain(await this.fetchJson(`${this.base}shaders/post/${name}.json`), { width: drawing.x, height: drawing.y });
    for (const p of chain.passes) await this.#program(p.name);
    for (const p of chain.passes) for (const a of p.aux) if (!a.target && !this.textures.has(a.id)) {
      const t = await this.loadTexture(`${this.base}effect/${a.id}.png`);
      t.flipY = false; // a native texture's first row is the image's first row
      t.colorSpace = THREE.NoColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.magFilter = t.minFilter = a.bilinear ? THREE.LinearFilter : THREE.NearestFilter;
      t.generateMipmaps = false;
      t.needsUpdate = true;
      this.textures.set(a.id, t);
    }
    this.#fit(drawing.x, drawing.y); // the game framebuffer target exists before the first frame
    const group = new ShaderGroup(this, chain, name);
    group.compile();
    return group;
  }
  async #program(name) {
    if (this.programs.has(name)) return this.programs.get(name);
    const dir = this.base + "shaders/program/";
    const def = parseProgram(await this.fetchJson(`${dir}${name}.json`));
    const [vs, fs] = await Promise.all([this.fetchText(`${dir}${def.vertex}.vsh`), this.fetchText(`${dir}${def.fragment}.fsh`)]);
    const program = { ...def, vertexShader: convertGlsl(vs, "vertex"), fragmentShader: convertGlsl(fs, "fragment"), glslDefaults: { ...glslUniformDefaults(vs), ...glslUniformDefaults(fs) } };
    this.programs.set(name, program);
    return program;
  }

  // The option changed outside a frame (title screen, menus: scene.render is not running): GameSettings.setOptionValue refreshes the
  // resources immediately, so scene.setRenderSettings calls this after every settings change.
  syncAnaglyph() {
    const anaglyph = !!this.anaglyph();
    if (anaglyph === !!this.anaglyphOn) return;
    this.anaglyphOn = anaglyph;
    this.onAnaglyphChange?.(anaglyph);
  }

  // --- frame boundaries -------------------------------------------------------------------------------
  // scene.render calls begin() before the sky is drawn; scene.endFrame() (after the first-person hand) calls end().
  begin(partial = 0) {
    const anaglyph = !!this.anaglyph(), group = this.group;
    this.partial = partial;
    if (anaglyph !== !!this.anaglyphOn) this.onAnaglyphChange?.(anaglyph);
    this.anaglyphOn = anaglyph;
    this.active = anaglyph || !!group;
    if (!this.active) return false;
    const r = this.renderer, size = r.getDrawingBufferSize(this.size);
    this.#fit(size.x, size.y);
    this.eye = 0;
    r.setRenderTarget(anaglyph ? this.eyes[0] : this.main);
    return true;
  }
  #fit(w, h) {
    if (this.main && this.main.width === w && this.main.height === h && !!this.eyes === this.anaglyphOn) return;
    this.main?.dispose();
    this.eyes?.forEach((t) => t.dispose());
    this.main = target(THREE, w, h, true);
    this.eyes = this.anaglyphOn ? [target(THREE, w, h, true), target(THREE, w, h, true)] : null;
    this.group?.resize(w, h);
  }
  end() {
    if (!this.active) return false;
    this.active = false;
    const r = this.renderer;
    if (this.anaglyphOn) {
      this.merge.material.uniforms.legacy.value = this.legacyAnaglyph ? 1 : 0;
      this.merge.material.uniforms.eye0.value = this.eyes[0].texture;
      this.merge.material.uniforms.eye1.value = this.eyes[1].texture;
      r.setRenderTarget(this.group ? this.main : null);
      r.clear();
      r.render(this.merge.scene, this.camera);
    }
    if (this.group) {
      this.group.render(this.partial);
      this.blit.material.uniforms.tex.value = this.main.texture;
      r.setRenderTarget(null);
      r.render(this.blit.scene, this.camera);
    }
    r.setRenderTarget(null);
    return true;
  }

  // In anaglyph mode every renderer.render/clear/clearDepth between begin() and end() runs for both eyes: the camera is
  // moved by the modelview shift and its projection translated by the clip-space shift (blt.a(FI)), and the call draws
  // into that eye's target (the two colour masks of renderWorld become the two targets merged in end()).
  #wrap() {
    const r = this.renderer, render = r.render.bind(r), clear = r.clear.bind(r), clearDepth = r.clearDepth.bind(r);
    const each = (fn) => { for (let pass = 0; pass < 2; pass++) { r.setRenderTarget(this.eyes[pass]); fn(pass); } };
    r.render = (scene, camera) => {
      if (!this.active || !this.anaglyphOn || !camera?.projectionMatrix || scene === this.merge.scene || scene === this.blit.scene) return render(scene, camera);
      const e = camera.projectionMatrix.elements, savedP = e.slice(), savedInv = camera.projectionMatrixInverse.elements.slice(), position = camera.position.clone();
      camera.updateMatrixWorld();
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
      each((pass) => {
        camera.position.copy(position).addScaledVector(right, -anaglyphEyeShift(pass));
        e[8] = savedP[8] - anaglyphProjectionShift(pass);
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
        render(scene, camera);
      });
      camera.position.copy(position);
      for (let i = 0; i < 16; i++) { e[i] = savedP[i]; camera.projectionMatrixInverse.elements[i] = savedInv[i]; }
      camera.updateMatrixWorld();
    };
    r.clear = (...a) => (this.active && this.anaglyphOn ? each(() => clear(...a)) : clear(...a));
    r.clearDepth = () => (this.active && this.anaglyphOn ? each(() => clearDepth()) : clearDepth());
  }
}

// ShaderGroup: the targets, passes and Time clock of one post/*.json, drawn with one raw shader material per pass.
export class ShaderGroup {
  constructor(post, chain, name) {
    this.post = post;
    this.chain = chain;
    this.name = name;
    this.clock = new ShaderClock();
    this.targets = new Map();
    this.passes = [];
  }
  compile() {
    const { post, chain } = this, r = post.renderer, size = r.getDrawingBufferSize(new THREE.Vector2());
    this.width = size.x;
    this.height = size.y;
    for (const t of chain.targets) this.targets.set(t.name, target(THREE, t.width, t.height, true));
    for (const p of chain.passes) {
      const def = post.programs.get(p.name), uniforms = {};
      for (const [k, v] of Object.entries(def.glslDefaults)) uniforms[k] = { value: Array.isArray(v) ? v.slice() : v };
      for (const [k, u] of Object.entries(def.uniforms)) uniforms[k] = { value: u.type.startsWith("matrix") ? u.values.slice() : u.count === 1 ? u.values[0] ?? 0 : u.values.slice() };
      for (const s of def.samplers) uniforms[s] = { value: null };
      for (const u of p.uniforms) uniforms[u.name] = { value: u.values.length === 1 ? u.values[0] : u.values.slice() };
      const material = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: def.vertexShader, fragmentShader: def.fragmentShader, uniforms, depthTest: false, depthWrite: false, transparent: false, blending: THREE.NoBlending });
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("Position", new THREE.BufferAttribute(new Float32Array(12), 3));
      geometry.setIndex([0, 1, 2, 0, 2, 3]);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      const scene = new THREE.Scene();
      scene.add(mesh);
      this.passes.push({ spec: p, def, material, geometry, scene });
    }
    this.#fitQuads();
    // Surface a GLSL compile error now (ShaderManager throws "Couldn't compile ... program"), not mid-frame.
    const errors = [], previous = r.debug.onShaderError;
    r.debug.onShaderError = (gl, program, vs, fs) => { errors.push(gl.getShaderInfoLog(fs) || gl.getShaderInfoLog(vs) || gl.getProgramInfoLog(program)); };
    try { for (const p of this.passes) { const out = this.#target(p.spec.outtarget); r.setRenderTarget(out); r.render(p.scene, post.camera); } } finally { r.debug.onShaderError = previous; r.setRenderTarget(null); }
    if (errors.length) { this.dispose(); throw new Error("Couldn't compile program: " + errors[0]); }
  }
  #target(name) { return name === MAIN_TARGET ? this.post.main : this.targets.get(name); }
  #fitQuads() {
    for (const p of this.passes) {
      const t = this.#target(p.spec.outtarget), w = t.width, h = t.height;
      // Shader.render draws (0,h) (w,h) (w,0) (0,0) at z 500 in framebuffer pixels.
      p.geometry.attributes.Position.array.set([0, h, 500, w, h, 500, w, 0, 500, 0, 0, 500]);
      p.geometry.attributes.Position.needsUpdate = true;
      p.proj = orthoProjection(w, h);
    }
  }
  // Window resize: main-sized targets follow the new size (ShaderGroup.createBindFramebuffers), others keep theirs.
  resize(w, h) {
    for (const t of this.chain.targets) if (t.width === this.width && t.height === this.height) { this.targets.get(t.name)?.dispose(); this.targets.set(t.name, target(THREE, w, h, true)); t.width = w; t.height = h; }
    this.width = w;
    this.height = h;
    if (this.passes.length) this.#fitQuads();
  }
  render(partial) {
    const { post } = this, r = post.renderer, gl = r.getContext(), time = this.clock.advance(partial), screen = r.getDrawingBufferSize(new THREE.Vector2());
    const clearColor = r.getClearColor(new THREE.Color()), clearAlpha = r.getClearAlpha(), autoClear = r.autoClear;
    r.autoClear = false;
    r.setClearColor(0x000000, 0);
    for (const p of this.passes) {
      const input = this.#target(p.spec.intarget), out = this.#target(p.spec.outtarget), u = p.material.uniforms;
      const set = (name, value) => { if (u[name]) u[name].value = value; };
      set("DiffuseSampler", input.texture);
      p.spec.aux.forEach((a, i) => {
        set(a.name, a.target ? this.#target(a.id).texture : post.textures.get(a.id));
        set("AuxSize" + i, [a.target ? this.#target(a.id).width : a.width, a.target ? this.#target(a.id).height : a.height]);
      });
      set("ProjMat", new THREE.Matrix4().fromArray(p.proj).transpose());
      set("InSize", [input.width, input.height]);
      set("OutSize", [out.width, out.height]);
      set("Time", time);
      set("ScreenSize", [screen.x, screen.y]);
      r.setRenderTarget(out);
      r.clear(true, true, true); // Framebuffer.framebufferClear to (0, 0, 0, 0) before the quad
      gl.colorMask(true, true, true, false); // Shader.render: glColorMask(true, true, true, false) and no depth write
      r.render(p.scene, post.camera);
      gl.colorMask(true, true, true, true);
    }
    r.setClearColor(clearColor, clearAlpha);
    r.autoClear = autoClear;
  }
  dispose() {
    for (const t of this.targets.values()) t.dispose();
    this.targets.clear();
    for (const p of this.passes) { p.geometry.dispose(); p.material.dispose(); }
    this.passes = [];
  }
}

// GuiOptions' "Super Secret Settings..." button (bdn.func_146113_a): the press plays a random event from the
// ANIMALS, BLOCKS, MOBS, PLAYERS and WEATHER sound categories at volume 0.25 and pitch 0.5, not the normal click.
export const SUPER_SECRET_CATEGORIES = ["neutral", "block", "hostile", "player", "weather"];
export const SUPER_SECRET_SOUND = { volume: 0.25, pitch: 0.5 };
export function randomSuperSecretEvent(events, random = Math.random) {
  const names = Object.keys(events).filter((n) => SUPER_SECRET_CATEGORIES.includes(events[n].category));
  return names.length ? names[Math.floor(random() * names.length)] : null;
}
