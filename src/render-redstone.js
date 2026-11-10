// RenderBlocks vertex streams for the redstone render types, replayed against the unchanged 1.7.10 classes
// (tools/probes/RenderTypes2Probe.java, public/research/render-types-2-reference.json, src/render-types-2.test.js).
// Each function returns quads { icon, verts: [[x, y, z] x4], uv: [[fu, fv] x4], colour: [r, g, b] } in native vertex
// order; fu and fv are the icon fractions with v measured from the icon's top (Icon.getInterpolatedV), as the native
// Tessellator received them. chunk-mesher.js maps them into the atlas and lights them.
import { toOriginal } from "./block-registry.js";

// Original ids with Block.canProvidePower (aji.f()) and Block.isNormalCube (aji.r()), from the native probe's
// canProvidePower and normalCube arrays (render-types-2-reference.json).
const POWER = new Set([28, 55, 69, 70, 72, 75, 76, 77, 93, 94, 131, 143, 146, 147, 148, 149, 150, 151, 152]);
const NORMAL = new Set([1, 2, 3, 4, 5, 7, 12, 13, 14, 15, 16, 17, 19, 21, 22, 23, 24, 25, 35, 41, 42, 43, 45, 47, 48, 49, 52, 56, 57, 58, 61, 62, 73, 74, 80, 82, 84, 86, 87, 88, 91, 97, 98, 99, 100, 103, 110, 112, 120, 121, 123, 124, 125, 129, 133, 137, 153, 155, 158, 159, 162, 170, 172, 173, 174]);
export const WIRE = 55, REPEATER_OFF = 93, REPEATER_ON = 94;
// The original id and metadata of an internal cell.
export const originalCell = (world, x, y, z) => {
  const id = world.get(x, y, z);
  if (!id) return [0, 0];
  const o = toOriginal(id, world.getMeta(x, y, z), {});
  return o ? [o[0], o[1]] : [0, 0];
};
export const normalCubeAt = (world, x, y, z) => NORMAL.has(originalCell(world, x, y, z)[0]);
const f = Math.fround;

// BlockRedstoneWire.isPowerProviderOrWire(world, x, y, z, dir): wire, a repeater lying along dir, or anything that can provide power (dir -1 asks for wire only).
function providerOrWire(world, x, y, z, dir) {
  const [id, meta] = originalCell(world, x, y, z);
  if (id === WIRE) return true;
  if (id === REPEATER_OFF || id === REPEATER_ON) return dir === (meta & 3) || dir === [2, 3, 0, 1][meta & 3];
  return POWER.has(id) && dir !== -1;
}
// Tessellator.setColorOpaque_F (float channel * 255, truncated) of the dust colour for a power level.
export function wireColour(power) {
  const p = f(power / 15);
  let r = f(f(p * 0.6) + 0.4), g = f(f(f(p * p) * 0.7) - 0.5), b = f(f(f(p * p) * 0.6) - 0.7);
  if (power === 0) r = f(0.3);
  return [r, Math.max(0, g), Math.max(0, b)];
}
// RenderBlocks.renderBlockRedstoneWire (blm.a(amk, ...)): the dust quad (cross or line) with its overlay, then the climbing strips.
export function wireQuads(world, x, y, z) {
  const power = world.getMeta(x, y, z), out = [], c1 = wireColour(power), white = [1, 1, 1], at = (dx, dy, dz) => normalCubeAt(world, x + dx, y + dy, z + dz);
  let w = providerOrWire(world, x - 1, y, z, 1) || (!at(-1, 0, 0) && providerOrWire(world, x - 1, y - 1, z, -1)),
    e = providerOrWire(world, x + 1, y, z, 3) || (!at(1, 0, 0) && providerOrWire(world, x + 1, y - 1, z, -1)),
    n = providerOrWire(world, x, y, z - 1, 2) || (!at(0, 0, -1) && providerOrWire(world, x, y - 1, z - 1, -1)),
    s = providerOrWire(world, x, y, z + 1, 0) || (!at(0, 0, 1) && providerOrWire(world, x, y - 1, z + 1, -1));
  const open = !at(0, 1, 0);
  if (open) {
    if (at(-1, 0, 0) && providerOrWire(world, x - 1, y + 1, z, -1)) w = true;
    if (at(1, 0, 0) && providerOrWire(world, x + 1, y + 1, z, -1)) e = true;
    if (at(0, 0, -1) && providerOrWire(world, x, y + 1, z - 1, -1)) n = true;
    if (at(0, 0, 1) && providerOrWire(world, x, y + 1, z + 1, -1)) s = true;
  }
  let x0 = x, x1 = x + 1, z0 = z, z1 = z + 1, kind = 0;
  if ((w || e) && !n && !s) kind = 1;
  if ((n || s) && !e && !w) kind = 2;
  const y0 = y + 0.015625;
  const tiles = kind === 0 ? ["redstone_dust_cross", "redstone_dust_cross_overlay"] : ["redstone_dust_line", "redstone_dust_line_overlay"];
  let pu0 = 0, pv0 = 0, pu1 = 16, pv1 = 16;
  if (kind === 0) {
    if (!w) { x0 = f(x0 + 0.3125); pu0 += 5; }
    if (!e) { x1 = f(x1 - 0.3125); pu1 -= 5; }
    if (!n) { z0 = f(z0 + 0.3125); pv0 += 5; }
    if (!s) { z1 = f(z1 - 0.3125); pv1 -= 5; }
  }
  const verts = [[x1, y0, z1], [x1, y0, z0], [x0, y0, z0], [x0, y0, z1]];
  // The cross takes u from x and v from z; a line along x the same, a line along z swaps them (read off the native vertices).
  const uv = kind === 2 ? [[pv1, pu1], [pv0, pu1], [pv0, pu0], [pv1, pu0]] : [[pu1, pv1], [pu1, pv0], [pu0, pv0], [pu0, pv1]];
  tiles.forEach((icon, i) => out.push({ icon, verts, uv: uv.map(([a, b]) => [a / 16, b / 16]), colour: i ? white : c1 }));
  // The strips up the side of a normal cube that carries dust on top.
  if (open) {
    const strip = (cond, px, pz, flipX) => {
      if (!cond) return;
      const top = y + 1.021875;
      for (const [i, icon] of ["redstone_dust_line", "redstone_dust_line_overlay"].entries()) {
        const v = px === null ? [[x, top, pz], [x, y, pz], [x + 1, y, pz], [x + 1, top, pz]] : [[px, top, z + 1], [px, y, z + 1], [px, y, z], [px, top, z]];
        out.push({ icon, verts: v, uv: [[1, 0], [0, 0], [0, 1], [1, 1]], colour: i ? white : c1, strip: true });
      }
    };
    const wireAbove = (dx, dz) => originalCell(world, x + dx, y + 1, z + dz)[0] === WIRE;
    strip(at(-1, 0, 0) && wireAbove(-1, 0), x + 0.015625, null);
    strip(at(1, 0, 0) && wireAbove(1, 0), x + 1 - 0.015625, null);
    strip(at(0, 0, -1) && wireAbove(0, -1), null, z + 0.015625);
    strip(at(0, 0, 1) && wireAbove(0, 1), null, z + 1 - 0.015625);
  }
  return out;
}

// Vec3.rotateAroundX / Y / Z (float angle through the MathHelper sine table, double arithmetic); each returns a new [x, y, z].
const rotX = ([x, y, z], c, s) => [x, y * c + z * s, z * c - y * s];
const rotY = ([x, y, z], c, s) => [x * c + z * s, y, z * c - x * s];
const rotZ = ([x, y, z], c, s) => [x * c + y * s, y * c - x * s, z];
// RenderBlocks.renderBlockLever, the handle (the cobblestone base is a renderStandardBlock the mesher draws with leverBaseBounds).
export const leverBaseBounds = (meta) => {
  const f = 0.25, f1 = 0.1875, f2 = 0.1875, h = 0.5;
  switch (meta & 7) {
    case 5: return [h - f1, 0, h - f, h + f1, f2, h + f];
    case 6: return [h - f, 0, h - f1, h + f, f2, h + f1];
    case 4: return [h - f1, h - f, 1 - f2, h + f1, h + f, 1];
    case 3: return [h - f1, h - f, 0, h + f1, h + f, f2];
    case 2: return [1 - f2, h - f, h - f1, 1, h + f, h + f1];
    case 1: return [0, h - f, h - f1, f2, h + f, h + f1];
    case 0: return [h - f, 1 - f2, h - f1, h + f, 1, h + f1];
    default: return [h - f1, 1 - f2, h - f, h + f1, 1, h + f];
  }
};
export function leverHandleQuads(x, y, z, meta, cos, sin) {
  const o = meta & 7, thrown = (meta & 8) > 0, a = 0.0625, len = 0.625;
  let pts = [[-a, 0, -a], [a, 0, -a], [a, 0, a], [-a, 0, a], [-a, len, -a], [a, len, -a], [a, len, a], [-a, len, a]];
  const PI = Math.fround(3.1415927), HALF = Math.fround(1.5707964), TILT = Math.fround(0.69813174);
  const rot = (p, fn, ang) => fn(p, cos(ang), sin(ang));
  pts = pts.map((p0) => {
    let p = p0.slice();
    if (thrown) { p[2] -= 0.0625; p = rot(p, rotX, TILT); } else { p[2] += 0.0625; p = rot(p, rotX, -TILT); }
    if (o === 0 || o === 7) p = rot(p, rotZ, PI);
    if (o === 6 || o === 0) p = rot(p, rotY, HALF);
    if (o > 0 && o < 5) {
      p[1] -= 0.375;
      p = rot(p, rotX, HALF);
      if (o === 4) p = rot(p, rotY, 0);
      if (o === 3) p = rot(p, rotY, PI);
      if (o === 2) p = rot(p, rotY, HALF);
      if (o === 1) p = rot(p, rotY, -HALF);
      return [p[0] + x + 0.5, p[1] + y + 0.5, p[2] + z + 0.5];
    }
    if (o !== 0 && o !== 7) return [p[0] + x + 0.5, p[1] + y + 0.125, p[2] + z + 0.5];
    return [p[0] + x + 0.5, p[1] + y + 0.875, p[2] + z + 0.5];
  });
  const quads = [], faces = [[0, 1, 2, 3], [7, 6, 5, 4], [1, 0, 4, 5], [2, 1, 5, 6], [3, 2, 6, 7], [0, 3, 7, 4]];
  let uv = [7, 6, 9, 8];
  faces.forEach((ix, k) => {
    if (k === 2) uv = [7, 6, 9, 16];
    const [u0, v0, u1, v1] = uv.map((n) => n / 16);
    quads.push({ icon: "lever", verts: ix.map((i) => pts[i]), uv: [[u0, v1], [u1, v1], [u1, v0], [u0, v0]], colour: [1, 1, 1] });
  });
  return quads;
}

// RenderBlocks.renderBlockTripWireSource (render type 29, bytecode-read and replayed against the probe's native vertices): the plate's bounds, then the
// two arm boxes rotated like the lever handle and, on an attached hook, two strips of wire. The plate itself is a planks-textured standard block.
export const hookPlateBounds = (dir) => {
  const f = 0.125, g = Math.fround(Math.fround(0.3) - 0.25), h = Math.fround(Math.fround(0.3) + 0.25); // the float bounds 0.3f -/+ 0.25f
  return dir === 2 ? [0.5 - f, g, 1 - f, 0.5 + f, h, 1] : dir === 0 ? [0.5 - f, g, 0, 0.5 + f, h, f] : dir === 1 ? [1 - f, g, 0.5 - f, 1, h, 0.5 + f] : [0, g, 0.5 - f, f, h, 0.5 + f];
};
export function hookQuads(x, y, z, meta, suspended, cos, sin) {
  const dir = meta & 3, attached = (meta & 4) !== 0, powered = (meta & 8) !== 0, fr = Math.fround;
  const PI = fr(3.1415927), HALF = fr(1.5707964), rot = (p, fn, ang) => fn(p, cos(ang), sin(ang));
  const box = (hx, hz, h) => [[-hx, 0, -hz], [hx, 0, -hz], [hx, 0, hz], [-hx, 0, hz], [-hx, h, -hz], [hx, h, -hz], [hx, h, hz], [-hx, h, hz]];
  const place = (p0) => {
    let p = p0;
    p = dir === 2 ? rot(p, rotY, 0) : dir === 0 ? rot(p, rotY, PI) : dir === 1 ? rot(p, rotY, HALF) : rot(p, rotY, -HALF);
    return [p[0] + x + 0.5, p[1] + fr(y + fr(0.3125)), p[2] + z + 0.5];
  };
  const arm1 = box(fr(0.046875), fr(0.046875), fr(0.3125)).map((q) => {
    let p = [q[0], q[1], q[2] + 0.0625];
    if (powered) { p = rot(p, rotX, fr(0.5235988)); p[1] -= 0.4375; } else if (attached) { p = rot(p, rotX, fr(0.08726647)); p[1] -= 0.4375; } else { p = rot(p, rotX, fr(-0.69813174)); p[1] -= 0.375; }
    return place(rot(p, rotX, HALF));
  });
  const arm2 = box(fr(0.09375), fr(0.09375), fr(0.03125)).map((q) => {
    let p = [q[0], q[1], q[2] + 0.21875];
    if (powered) { p[1] -= 0.09375; p[2] -= 0.1625; p = rot(p, rotX, 0); } else if (attached) { p[1] += 0.015625; p[2] -= 0.171875; p = rot(p, rotX, fr(0.17453294)); } else p = rot(p, rotX, fr(0.87266463));
    return place(p);
  });
  const faces = [[0, 1, 2, 3], [7, 6, 5, 4], [1, 0, 4, 5], [2, 1, 5, 6], [3, 2, 6, 7], [0, 3, 7, 4]], out = [];
  const emit = (pts, [ua, ub], [va, vb], vTall) => faces.forEach((ix, k) => {
    const v1 = k < 2 ? vb : vTall, u0 = ua / 16, u1 = ub / 16, w0 = va / 16, w1 = v1 / 16;
    out.push({ icon: "trip_wire_source", verts: ix.map((i) => pts[i]), uv: [[u0, w1], [u1, w1], [u1, w0], [u0, w0]], colour: [1, 1, 1] });
  });
  emit(arm1, [7, 9], [9, 11], 16);
  emit(arm2, [5, 11], [3, 9], 5);
  if (attached) {
    const dy = arm2[0][1], f48 = fr(0.5 - fr(0.03125) / 2), f49 = fr(f48 + fr(0.03125)), h = y + (suspended ? 3.5 : 1.5) / 16, v0 = 2 / 16, v1 = 4 / 16, c = [0.75, 0.75, 0.75];
    const q = (pts) => out.push({ icon: "trip_wire_source", verts: pts.map(([a, b, cc]) => [a, b, cc]), uv: pts.map((p) => [p[3], p[4]]), colour: c });
    const X = (o) => x + o, Z = (o) => z + o;
    if (dir === 2) {
      q([[X(f48), h, Z(0.25), 0, v0], [X(f49), h, Z(0.25), 0, v1], [X(f49), h, Z(0), 1, v1], [X(f48), h, Z(0), 1, v0]]);
      q([[X(f48), dy, Z(0.5), 0, v0], [X(f49), dy, Z(0.5), 0, v1], [X(f49), h, Z(0.25), 1, v1], [X(f48), h, Z(0.25), 1, v0]]);
    } else if (dir === 0) {
      q([[X(f48), h, Z(0.75), 0, v0], [X(f49), h, Z(0.75), 0, v1], [X(f49), dy, Z(0.5), 1, v1], [X(f48), dy, Z(0.5), 1, v0]]);
      q([[X(f48), h, Z(1), 0, v0], [X(f49), h, Z(1), 0, v1], [X(f49), h, Z(0.75), 1, v1], [X(f48), h, Z(0.75), 1, v0]]);
    } else if (dir === 1) {
      q([[X(0), h, Z(f49), 0, v1], [X(0.25), h, Z(f49), 1, v1], [X(0.25), h, Z(f48), 1, v0], [X(0), h, Z(f48), 0, v0]]);
      q([[X(0.25), h, Z(f49), 0, v1], [X(0.5), dy, Z(f49), 1, v1], [X(0.5), dy, Z(f48), 1, v0], [X(0.25), h, Z(f48), 0, v0]]);
    } else {
      q([[X(0.5), dy, Z(f49), 0, v1], [X(0.75), h, Z(f49), 1, v1], [X(0.75), h, Z(f48), 1, v0], [X(0.5), dy, Z(f48), 0, v0]]);
      q([[X(0.75), h, Z(f49), 0, v1], [X(1), h, Z(f49), 1, v1], [X(1), h, Z(f48), 1, v0], [X(0.75), h, Z(f48), 0, v0]]);
    }
  }
  return out;
}
