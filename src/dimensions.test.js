import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as D from "./dimensions.js";

// tools/probes/DimensionProbe.java (tools/verify-dimensions.mjs): the unchanged Teleporter (ahp), WorldProvider classes (aqo/aqp/aqr),
// Direction (p), Entity.setInPortal (sa.ah) and EntityPlayer.getMaxInPortalTime (yz.D) of 1.7.10.
export const reference = JSON.parse(await readFile(new URL("../public/research/dimensions-reference.json", import.meta.url)));
const of = (kind) => reference.records.filter((r) => r.kind === kind);
const ORIGINAL = { air: 0, obsidian: 49, portal: 90, endPortal: 119, bedrock: 7 };

test("reference has the expected record counts", () => {
  assert.equal(reference.records.length, 103);
  assert.deepEqual(["direction", "movementDirection", "provider", "timing", "setInPortal", "teleport"].map((k) => of(k).length), [1, 1, 3, 2, 60, 36]);
});

test("Direction arrays and movement direction", () => {
  const d = of("direction")[0];
  for (const k of Object.keys(D.DIR)) assert.deepEqual(D.DIR[k], d[k], k);
  for (const [dx, dz, want] of of("movementDirection")[0].cases) assert.equal(D.movementDirection(dx, dz), want, `${dx},${dz}`);
});

test("provider flags, light table, celestial angle and entrance", () => {
  for (const p of of("provider")) {
    const mine = D.providerOf(p.dimension);
    // The probe's `hasNoSky` is aqo.f (WorldProviderHell only); the table's names are native since batch 28 (hasNoSky = aqo.g).
    assert.equal(mine.isHellWorld, p.hasNoSky === true);
    assert.equal(mine.hasNoSky, p.dimension !== 0);
    if (p.dimension === -1) { assert.equal(mine.hasNoSky, true); assert.equal(p.canRespawnHere, false); }
    if (p.dimension === 0) assert.equal(p.canRespawnHere, true);
    assert.equal(D.actualHeight(p.dimension), p.dimension === 0 ? 256 : 128); // World.getActualHeight: 128 where aqo.g (Nether and End)
    const table = D.lightBrightnessTable(p.dimension === -1 ? 0.1 : 0);
    p.lightTable.forEach((v, i) => assert.ok(Math.abs(table[i] - v) < 1e-6, `light ${p.dimension} ${i}: ${table[i]} vs ${v}`));
    if (p.dimension === 1) assert.deepEqual(D.providerOf(1).entrance, p.entrance);
    for (const [a, r, g, b] of p.fog) {
      if (p.dimension === 1) { const c = D.endFogColor(a); assert.ok(Math.abs(c[0] - r) < 1e-6 && Math.abs(c[1] - g) < 1e-6 && Math.abs(c[2] - b) < 1e-6, `end fog ${a}`); }
    }
  }
});

test("portal timing", () => {
  for (const t of of("timing")) {
    assert.equal(D.maxInPortalTime(true, t.creative), t.playerMaxInPortal);
    assert.equal(D.maxInPortalTime(false, false), t.entityMaxInPortal);
    assert.equal(D.portalCooldown(true), t.playerCooldown);
    assert.equal(D.portalCooldown(false), t.entityCooldown);
  }
});

test("Entity.setInPortal replay", () => {
  for (const r of of("setInPortal")) {
    const s = new D.PortalState();
    s.timeUntilPortal = r.until; s.inPortal = r.inPortal; s.teleportDirection = r.teleportDirection;
    s.setInPortal(r.prev[0], r.prev[1], r.pos[0], r.pos[1], { isPlayer: r.player });
    assert.equal(s.timeUntilPortal, r.until > 0 ? D.portalCooldown(r.player) : r.afterUntil);
    if (r.until > 0) assert.equal(r.afterUntil, D.portalCooldown(r.player));
    assert.equal(s.inPortal, r.afterInPortal === true || r.afterInPortal === "true");
    assert.equal(s.teleportDirection, r.afterDirection);
  }
});

test("PortalState counts 80 ticks to travel for a survival player, 300-tick entity cooldown after", () => {
  const s = new D.PortalState();
  let travel = null, n = 0;
  while (travel === null && n < 200) { s.setInPortal(0, 0, 1, 0); travel = s.tick(0); n++; }
  assert.equal(travel, -1); assert.equal(n, 81); assert.equal(s.timeUntilPortal, 9);
  assert.equal(new D.PortalState().tick(0), null);
});

function sparse(r) {
  const cells = new Map(r.blocks.map(([x, y, z, id]) => [`${x},${y},${z}`, id]));
  const writes = [];
  return {
    dimension: r.dimension, time: 0, actualHeight: r.dimension === -1 ? 128 : 256, seed: BigInt(r.seed), writes,
    get(x, y, z) {
      const v = cells.get(`${x},${y},${z}`); if (v !== undefined) return v;
      if (y < 0) return 0;
      if (y <= r.floor) { for (const b of r.lava) if (x >= b[0] && x <= b[2] && z >= b[1] && z <= b[3]) return 11; return 1; }
      return 0;
    },
    set(x, y, z, id, meta = 0, flags = 3) { if (y < 0 || y >= 256) return; cells.set(`${x},${y},${z}`, id); writes.push([x, y, z, id, meta, flags]); },
    notify() {},
  };
}
const ent = (a, tdir) => ({ x: a[0], y: a[1], z: a[2], vx: a[3], vy: a[4], vz: a[5], yaw: a[6], pitch: a[7], teleportDirection: tdir });
const arr = (e) => [e.x, e.y, e.z, e.vx, e.vy, e.vz, e.yaw, e.pitch];
const near = (a, b, label) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-4, `${label}[${i}] ${v} vs ${b[i]}`));

test("Teleporter replay against the original (placement, built portals, platform, cache)", () => {
  for (const r of of("teleport")) {
    const w = sparse(r);
    const t = new D.Teleporter(w, { ids: ORIGINAL, isSolid: (id) => id === 1 || id === 49 });
    const e = ent(r.entity, r.teleportDirection);
    t.placeInPortal(e, e.x + 100, e.y, e.z - 100, e.yaw);
    near(arr(e), r.first.entity, `#${r.index} first`);
    assert.deepEqual(w.writes.map((x) => x.slice(0, 4)), r.first.writes.map((x) => x.slice(0, 4)), `#${r.index} writes`);
    w.writes.length = 0;
    const e2 = ent(r.entity, r.teleportDirection);
    t.placeInPortal(e2, e2.x, e2.y, e2.z, e2.yaw);
    near(arr(e2), r.second.entity, `#${r.index} second`);
    assert.equal(w.writes.length, r.second.writes.length, `#${r.index} second writes`);
  }
});

test("transferTarget scaling and End entrance", () => {
  const n = D.transferTarget(0, -1, 800, 70, -1600, 30);
  assert.deepEqual([n.x, n.z, n.teleporter], [100, -200, true]);
  const o = D.transferTarget(-1, 0, 100, 70, -200, 30);
  assert.deepEqual([o.x, o.z], [800, -1600]);
  const far = D.transferTarget(-1, 0, 5e6, 70, 0, 0);
  assert.equal(far.x, 29999872);
  const e = D.transferTarget(0, 1, 5, 70, 5, 30);
  assert.deepEqual([e.x, e.y, e.z, e.yaw, e.teleporter], [100, 50, 0, 90, true]);
  assert.equal(D.transferTarget(1, 0, 5, 70, 5, 30).teleporter, false);
});
