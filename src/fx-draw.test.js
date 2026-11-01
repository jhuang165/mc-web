import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Fx } from "./fx.js";
import { explosionSprite } from "./explosion-particles.js";
import { particleBasis, particleQuad, particleLightCell, spriteQuad, colorByte } from "./particles.js";

// FxProbe's "draw" records: EffectRenderer.renderParticles for one particle of each kind
// this build draws (Tessellator.setBrightness(getBrightnessForRender), then the unchanged
// renderParticle), read back from the Tessellator's buffer at three partial ticks and two
// camera bases, at construction and two ticks later. interpPos is 0 in the probe.
const reference = JSON.parse(readFileSync(new URL("../public/research/fx-reference.json", import.meta.url)));
const draws = reference.records.filter((r) => r.case === "draw");
const fxSprite = Fx.prototype.sprite, fxBrightness = Fx.prototype.brightness;

// The probe's IIcons: BIcon for blockcrack/blockdust, ParticleProbe.Icon (0..1) for items.
const ICON = { block: [[0.25, 0.3125], [0.5, 0.5625]], item: [[0, 1], [0, 1]] };
// The JS particle for a recorded EntityFX state: kind names as fx.js / explosion-particles.js
// construct them, and the per-class base scale each render override starts from.
function particle(kind, s) {
  const own = Object.values(s.own)[0];
  const p = { px: s.prev[0], py: s.prev[1], pz: s.prev[2], x: s.pos[0], y: s.pos[1], z: s.pos[2], age: s.age, max: s.max, scale: s.scale, tex: s.tex,
    jx: s.jitter[0], jy: s.jitter[1], r: s.rgba[0], g: s.rgba[1], b: s.rgba[2], a: s.rgba[3], box: [0, s.box[0], 0, 0, s.box[1], 0], yOffset: s.yOffset, layer: s.layer };
  const name = { depthsuspend: "aura", townaura: "aura", happyVillager: "aura", magicCrit: "crit", mobSpell: "spell", mobSpellAmbient: "spell", angryVillager: "heart",
    dripWater: "drip", dripLava: "drip", largesmoke: "smoke" }[kind] ?? kind;
  Object.assign(p, { kind: name, base: own, lava: kind === "dripLava" });
  if (name === "explode" || name === "smoke") Object.assign(p, { frame: s.tex, scale: own ?? s.scale });
  return p;
}
function corners(kind, p, partial, basis) {
  if (p.layer === 0) {
    const sprite = p.kind === "explode" || p.kind === "smoke" ? explosionSprite(p, partial) : fxSprite.call(null, p, partial);
    return spriteQuad(p, partial, basis, sprite);
  }
  const [u, v] = kind.startsWith("block") ? ICON.block : ICON.item;
  return particleQuad(p, partial, basis, u, v);
}
// Tessellator's colour int: (a << 24 | b << 16 | g << 8 | r) on a little-endian buffer.
const color = (p) => ((colorByte(p.a) << 24) | (colorByte(p.b) << 16) | (colorByte(p.g) << 8) | colorByte(p.r)) | 0;

test("the draw records cover every kind and both camera bases", () => {
  assert.equal(draws.length, 25);
  for (const r of draws) assert.equal(r.frames.length, 2);
  // ActiveRenderInfo for yaw 30 / pitch -20 and the mirrored yaw 200 / pitch 65.
  const [first, second] = draws[0].frames[0].draws.slice(0, 2).map((d) => d.basis);
  for (const [want, basis] of [[first, particleBasis(30, -20)], [second, particleBasis(200, 65, true)]])
    assert.deepEqual([basis.x, basis.xz, basis.z, basis.yz, basis.xy], want);
});

for (const r of draws)
  test(`${r.kind} draws the original vertices`, () => {
    for (const frame of r.frames) {
      const p = particle(r.kind, frame.state);
      for (const d of frame.draws) {
        const [x, xz, z, yz, xy] = d.basis, basis = { x, xz, z, yz, xy };
        assert.equal(particleLightCell(p).length, 3);
        const light = p.layer === 0 ? fxBrightness.call(null, p, d.partial, r.light) : r.light;
        const at = `tick ${frame.tick} partial ${d.partial} basis ${d.basis[0]}`;
        assert.equal(light, d.brightness, `${r.kind} brightness, ${at}`);
        const ours = corners(r.kind, p, d.partial, basis);
        assert.equal(ours.length, d.vertices.length);
        d.vertices.forEach((v, i) => {
          for (let k = 0; k < 5; k++) assert.ok(ours[i][k] === v[k], `${r.kind} vertex ${i}[${k}] ${ours[i][k]} != ${v[k]}, ${at}`);
          assert.equal(color(p), v[5], `${r.kind} colour, ${at}`);
          assert.equal(v[6], d.brightness);
        });
      }
    }
  });
