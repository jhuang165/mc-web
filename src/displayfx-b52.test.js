// Batch 52 (tag b52dx): the cart display block's colour (Block.getRenderColor swept over every id and metadata, executed) and the boat copy's splash (EntityBoat.onUpdate's splash block,
// executed on a real boat at speeds around 0.2625). The flat display shapes (types 1, 6, 19, 2) are NOT executed: renderBlockAsItem needs the LWJGL GL11 calls and a Tessellator (see the track note).
import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { displayTint, displayTerrain, displayShape, STEM_TINT } from "./cart-display-shape.js";
import { setColormaps, hasColormaps, itemGrassColor, rgbFloats } from "./biome-colors.js";
import { ObjectTracker } from "./object-tracker.js";
import { JavaRandom } from "./java-random.js";

const ref = JSON.parse(await readFile(new URL("../public/research/displayfx-reference.json", import.meta.url), "utf8"));
const tint = ref.records.find((r) => r.kind === "tint");
const rgb = (c) => rgbFloats(c);

test("the reference records the swept ids and the native class digests", () => {
  assert.equal(ref.tag, "b52dx");
  for (const c of ["xi", "aji", "blm", "aha", "agx"]) assert.match(ref.classes[c].sha256, /^[0-9a-f]{64}$/);
  assert.ok(tint.swept > 150);
  assert.deepEqual(tint.blocks.map((b) => b.id), [2, 18, 31, 104, 105, 106, 111, 161], "the only blocks whose getRenderColor is not white");
});

test("displayTint replays Block.getRenderColor for every meta of the blocks a display can draw", () => {
  setColormaps(new Int32Array(65536).fill(tint.grass), new Int32Array(65536).fill(tint.foliage)); // uniform maps: ColorizerGrass(0.5, 1.0) is the recorded colour
  assert.ok(hasColormaps());
  assert.equal(itemGrassColor(), tint.grass);
  for (const b of tint.blocks) {
    for (let m = 0; m < 16; m++) {
      const native = b.colors[m], got = displayTint(b.id, m);
      if ([106, 111].includes(b.id)) { assert.equal(displayShape(b.id), "none"); continue; } // tinted, but renderBlockAsItem draws nothing for render types 20 and 23
      if (b.id === 2) { assert.equal(got, null, "the grass block is forced to white (ajn.c)"); continue; }
      assert.deepEqual(got ?? rgb(0xFFFFFF), rgb(native), `block ${b.id} meta ${m}`);
    }
  }
  for (let m = 0; m < 16; m++) assert.equal(STEM_TINT(m), tint.blocks.find((b) => b.id === 104).colors[m]);
});

test("every block the display can draw that the reference lists as white is not tinted", () => {
  const tinted = new Set(tint.blocks.map((b) => b.id));
  for (let id = 1; id < 256; id++) if (!tinted.has(id)) for (let m = 0; m < 16; m++) assert.equal(displayTint(id, m), null, `${id}:${m}`);
});

test("blocks whose tile the item atlas bakes an item colour into are drawn from the grey terrain atlas", () => {
  for (const id of [2, 18, 31, 83, 161]) assert.ok(displayTerrain(id), String(id));
  for (const id of [1, 5, 6, 37, 50, 59, 104]) assert.ok(!displayTerrain(id), String(id));
});

// ---- the boat copy's splash against the executed boat ----
const f = Math.fround;
const boatLive = (yaw) => ({ id: 1, x: 5.5, posY: 0.3, z: 5.5, y: 0.3, vx: 0, vy: 0, vz: 0, yaw, pitch: 0, timeSinceHit: 0, forwardDir: 1, damage: 0, dead: false, bb: [4.75, 0, 4.75, 6.25, 0.6, 6.25] });
const copyOf = (yaw) => {
  const t = new ObjectTracker(10, () => 0.5), player = { x: 0, y: 0, z: 0 };
  t.view.player = player; t.ctx.world = null;
  t.serverTick({ boat: [boatLive(yaw)] }, player); t.clientTick();
  const log = []; t.hooks.particle = (...a) => log.push(a);
  return { c: [...t.entries.values()][0].client, log };
};
const cases = ref.records.filter((r) => r.kind === "travel");

for (const r of cases) {
  test(`boat splash ${r.name}: the copy spawns the executed particles tick by tick`, () => {
    const { c, log } = copyOf(r.boatYaw);
    c.sim.rand = new JavaRandom(7); // Boat.rand in the probe
    let state = [r.spawn[0], r.spawn[1] + f(0.3), r.spawn[2], r.spawn[3], r.spawn[4], r.spawn[5], r.boatYaw]; // x posY (feet + yOffset 0.3F) z vx vy vz yaw at the start of tick 0
    let total = 0;
    r.ticks.forEach((tk, i) => {
      const [x, y, z, vx, vy, vz, yaw] = state;
      Object.assign(c, { x, y, z, vx, vy, vz, yaw }); c.vt = null;
      log.length = 0;
      c.splash();
      const want = tk[2].filter((p) => p[0] === "splash");
      assert.equal(log.length, want.length, `tick ${i} count`);
      log.forEach((p, k) => {
        assert.equal(p[0], "splash");
        for (let j = 0; j < 6; j++) assert.ok(Math.abs(p[j + 1] - want[k][j + 1]) < 1e-6, `tick ${i} particle ${k}[${j}] ${p[j + 1]} vs ${want[k][j + 1]}`);
      });
      total += want.length;
      const s = tk[0]; state = [s[0], s[1], s[2], s[3], s[4], s[5], s[6]];
    });
    if (/no-splash|threshold/.test(r.name)) assert.equal(total, 0); else assert.ok(total > 0 || r.name === "slow-no-splash");
  });
}

test("the splash condition is only the speed: a boat in the air splashes, 0.26249999999999996 does not, the next double does", () => {
  const by = (n) => cases.find((r) => r.name === n);
  assert.equal(by("dry-air").ticks[0][2].filter((p) => p[0] === "splash").length, 25);
  assert.equal(by("at-threshold").ticks[0][2].length, 0);
  assert.equal(by("just-above").ticks[0][2].length, 17);
  assert.equal(by("fast-x").ticks[0][2].length, Math.ceil(1 + 0.4 * 60));
});
