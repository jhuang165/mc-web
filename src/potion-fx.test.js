import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { nightVisionBrightness, blindnessFog, adjustFogColor, PortalTimer, warpScale, warpMatrix, detectionRangeScale, splashBreak } from "./potion-fx.js";
import { lightmap, JavaRandom } from "./lighting.js";
import { ITEM_POTION } from "./potions.js";
import { WitchPotions } from "./witch-potions.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/potion-fx-reference.json", import.meta.url), "utf8"));
const rec = (c) => ref.records.find((r) => r.case === c);
const f = Math.fround;

test("night vision brightness replays EntityRenderer.getNightVisionBrightness", () => {
  const { rows } = rec("nightVision");
  assert.equal(rows.length, 1300);
  for (const [d, p, v] of rows) assert.equal(nightVisionBrightness(d, p), f(v), `duration ${d} partial ${p}`);
});

test("fog colour tail replays updateFogColor (void factor, Blindness, Night Vision)", () => {
  const { rows } = rec("fogColor");
  assert.ok(rows.length > 1000);
  // The row at feet y 250 with no effects is the colour before the void / Blindness / Night Vision terms (the void factor is >= 1 there).
  const pre = new Map();
  for (const [r, g, b, chunks, y, blind, night, or, og, ob] of rows) if (y === 250 && !blind && !night) pre.set(`${r},${g},${b},${chunks}`, [or, og, ob]);
  for (const [r, g, b, chunks, y, blind, night, or, og, ob] of rows) {
    const base = pre.get(`${r},${g},${b},${chunks}`);
    assert.ok(base, "pre-colour row");
    const out = adjustFogColor(base, { feetY: y, blindness: blind, nightVision: night > 0 ? nightVisionBrightness(night, 1) : 0 });
    for (const [k, v] of [or, og, ob].entries()) {
      if (v === "NaN") { assert.equal(out[k], 0, "native NaN (0 * Infinity) is drawn as black"); continue; }
      assert.ok(Math.abs(out[k] - v) <= 1e-6, `base ${r},${g},${b} chunks ${chunks} y ${y} blind ${blind} nv ${night} channel ${k}: ${out[k]} vs ${v}`);
    }
  }
});

test("lightmap with Night Vision replays updateLightmap", () => {
  const { rows } = rec("lightmap");
  assert.equal(rows.length, 111);
  for (const row of rows) {
    const nv = row.nightVision > 0 ? nightVisionBrightness(row.nightVision, 1) : 0;
    const out = lightmap(row.sun, row.flicker, row.gamma, new Uint8Array(1024), false, nv);
    let worst = 0;
    for (let i = 0; i < 256; i++) {
      const argb = row.argb[i];
      const nat = [(argb >> 16) & 255, (argb >> 8) & 255, argb & 255];
      for (let k = 0; k < 3; k++) worst = Math.max(worst, Math.abs(out[i * 4 + k] - nat[k]));
    }
    assert.ok(worst <= 1, `sun ${row.sun} flicker ${row.flicker} gamma ${row.gamma} nv ${row.nightVision}: off by ${worst}`);
  }
});

test("Blindness fog distances replay setupFog", () => {
  for (const [d, start, end] of rec("blindnessFog").rows) {
    const fog = blindnessFog(d, rec("blindnessFog").far);
    assert.equal(fog.start, f(start));
    assert.equal(fog.end, f(end));
  }
});

test("portal timer and warp scale replay EntityPlayerSP / EntityRenderer", () => {
  for (const { duration, ticks } of rec("portalTimer").rows) {
    const t = new PortalTimer();
    ticks.forEach(([prev, cur], i) => {
      t.tick(duration - i);
      assert.equal(t.prev, f(prev), `duration ${duration} tick ${i}`);
      assert.equal(t.cur, f(cur), `duration ${duration} tick ${i}`);
    });
  }
  for (const [a, s] of rec("warpScale").rows) assert.equal(warpScale(a), f(s));
});

test("warp matrix is identity-like without amount and scales along the rotated axis", () => {
  const m = warpMatrix(10, 0.5, 0, true);
  assert.ok(Math.abs(m[0] - 1) < 1e-9 && Math.abs(m[5] - 1) < 1e-9 && Math.abs(m[10] - 1) < 1e-9 && m[15] === 1);
  const w = warpMatrix(0, 0, 1, true), k = 1 / warpScale(1);
  assert.ok(Math.abs(w[0] - k) < 1e-9, "no rotation: x is stretched by 1 / f6");
  assert.ok(Math.abs(w[5] - 1) < 1e-9 && Math.abs(w[10] - 1) < 1e-9);
});

test("detection range matches World.getClosestVulnerablePlayer", () => {
  const { rows, range, step } = rec("detection");
  for (const [sneak, inv, armor, bits] of rows) {
    const scale = detectionRangeScale({ sneaking: !!sneak, invisible: !!inv, armorPieces: armor });
    for (let i = 1; i <= bits.length; i++) {
      const d = f(0), dist = i * step, expected = bits[i - 1] === "1";
      void d;
      assert.equal(dist * dist < (range * scale) * (range * scale), expected, `sneak ${sneak} inv ${inv} armor ${armor} dist ${dist}`);
    }
  }
});

test("splash bottle break replays RenderGlobal.playAuxSFX 2002", () => {
  const { rows } = rec("splashBreak");
  assert.equal(rows.length, 36);
  for (const row of rows) {
    const calls = [], fx = { spawn: (...a) => { const p = { mx: a[4], my: a[5], mz: a[6], r: 1, g: 1, b: 1 }; calls.push([a, p]); return p; } };
    const n = splashBreak(fx, new JavaRandom(row.seed), row.damage, ...row.pos);
    assert.equal(n, row.particles.length, `damage ${row.damage}`);
    row.particles.forEach((nat, i) => {
      const [a, p] = calls[i];
      assert.equal(a[0], nat[0].replace("iconcrack_373_", `iconcrack_${ITEM_POTION}_`));
      for (let k = 1; k <= 6; k++) assert.ok(Math.abs(a[k] - nat[k]) < 1e-9, `particle ${i} arg ${k}: ${a[k]} vs ${nat[k]}`);
      if (nat.length > 7) for (let k = 0; k < 3; k++) assert.ok(Math.abs([p.r, p.g, p.b][k] - nat[7 + k]) < 1e-6, `particle ${i} colour ${k}`);
    });
  }
});

test("invisible and sneaking players shrink the detection range", () => {
  assert.equal(detectionRangeScale({}), 1);
  assert.ok(detectionRangeScale({ sneaking: true }) < 1);
  assert.ok(detectionRangeScale({ invisible: true, armorPieces: 4 }) > detectionRangeScale({ invisible: true }));
});

test("splash potions in flight are saved and restored with the world", () => {
  const a = new WitchPotions({}), b = new WitchPotions({});
  a.throwFromPlayer({ x: 3, y: 64, z: -2 }, 0.4, -0.3, 16384 | 8225);
  const saved = JSON.parse(JSON.stringify(a.serialize()));
  assert.equal(saved.length, 1);
  assert.equal(saved[0].owner, "player");
  b.load(saved);
  assert.deepEqual(b.serialize(), saved);
  assert.equal(b.balls[0].kind, "potion");
  assert.equal(b.balls[0].damage, 16384 | 8225);
  b.load([{ x: NaN }, null, { x: 1, y: 1, z: 1, mx: 0, my: 0, mz: 0, damage: -1 }]);
  assert.equal(b.balls.length, 0, "malformed entries are dropped");
});
