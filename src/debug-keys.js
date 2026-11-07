// F3 combinations of Minecraft Java 1.7.10 beyond the toggles already in main.js: F3+B entity hitboxes
// (RenderManager.debugBoundingBox, bnn.p), the F3+S/T resource reload (Minecraft.refreshResources, bao.c) and the F3+C held crash
// (bao.am timestamp, "Manually triggered debug crash" after 6000 ms). Constants are in public/research/debug-screen-reference.json.
//
// bytecode-read (javap bnn.b(sa,DDDFF), bma.a(azt,int), bao runTick keyboard loop): the hitbox of every rendered entity that is not invisible
// is the box (x - width/2, y, z - width/2) - (x + width/2, y + height, z + width/2), NOT grown, in white 0xFFFFFF, drawn as two 5-vertex
// line strips (bottom ring, top ring) plus four vertical GL_LINES, depth write off, texture/lighting/cull/blend off, depth test left on.
// 1.7.10 draws no eye-height line and no look vector (those are 1.8 additions). glLineWidth is not set by the hitbox code.
import * as THREE from "three";
import { ENTITY_TYPES } from "./entities.js";

const f = Math.fround;
export const HITBOX_COLOR = 0xffffff; // bnn.b: ldc 16777215
export const CRASH_HOLD_MS = 6000; // bao: ldc2_w 6000
export const CRASH_DESCRIPTION = "Manually triggered debug crash"; // bao: ldc String
export const KEY_C = 46, KEY_F3 = 61, KEY_B = 48, KEY_S = 31, KEY_T = 20;

/** The 12 edges in the native vertex order of RenderGlobal.drawOutlinedBoundingBox: strip bottom, strip top, four verticals. */
export function outlineSegments(b) {
  const [x0, y0, z0, x1, y1, z1] = b;
  const ring = (y) => [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [x0, y, z0]];
  const segs = [];
  for (const y of [y0, y1]) { const r = ring(y); for (let i = 0; i < 4; i++) segs.push(r[i], r[i + 1]); }
  for (const [x, z] of [[x0, z0], [x0, z1], [x1, z0], [x1, z1]]) segs.push([x, y0, z], [x, y1, z]);
  return segs;
}

/** bnn.b: the box from width M and height N at the entity position (feet), no growth. */
export const hitboxOf = (x, y, z, width, height) => { const h = f(f(width) / 2); return [x - h, y, z - h, x + h, y + f(height), z + h]; };
const arr = (b) => Array.isArray(b) && b.length === 6 && b.every(Number.isFinite);
const small = (e, w, h, yOff = 0) => hitboxOf(e.x, e.y + yOff, e.z, w, h);

/**
 * Every entity the port renders, as [minx, miny, minz, maxx, maxy, maxz]. `src` holds the live lists (all optional); `skip` = invisible.
 * Sizes are each entity's setSize (bytecode-read for mobs via ENTITY_TYPES; items 0.25, orbs 0.5, carts 0.98 x 0.7, boats 1.5 x 0.6,
 * arrows 0.5, throwables and rockets 0.25 are from the port's own tables; hanging entities 0.5 x 0.5 and primed TNT 0.98 are assumed).
 */
export function collectHitboxes(src) {
  const out = [];
  const push = (b) => { if (arr(b)) out.push(b); };
  for (const e of src.mobs ?? []) {
    if (e.invisible) continue;
    const t = ENTITY_TYPES[e.type];
    if (!t) { push(arr(e.bb) ? e.bb : null); continue; }
    const s = e.growingAge < 0 ? 0.5 : 1;
    push(hitboxOf(e.x, e.y, e.z, f(t.width * s), f(t.height * s)));
  }
  for (const i of src.items ?? []) push(small(i, 0.25, 0.25));
  for (const o of src.orbs ?? []) push(arr(o.bb) ? o.bb : small(o, 0.5, 0.5));
  for (const c of src.carts ?? []) push(arr(c.bb) ? c.bb : small(c, 0.98, 0.7));
  for (const b of src.boats ?? []) push(arr(b.bb) ? b.bb : small(b, 1.5, 0.6));
  for (const h of src.hanging ?? []) push(small(h, 0.5, 0.5));
  for (const t of src.tnt ?? []) push(small(t, 0.98, 0.98));
  for (const a of src.arrows ?? []) if (!a.dead) push(small(a, 0.5, 0.5));
  for (const b of src.balls ?? []) if (!b.dead) push(small(b, 0.25, 0.25));
  for (const r of src.rockets ?? []) if (!r.dead) push(small(r, 0.25, 0.25));
  for (const b of src.fireballs ?? []) if (!b.dead) push(small(b, b.width ?? 1, b.width ?? 1));
  if (src.player) push(hitboxOf(src.player.x, src.player.y, src.player.z, 0.6, 1.8)); // the view entity: only in third person (RenderGlobal.renderEntities)
  return out;
}

/** Line renderer: one LineSegments in the scene, rebuilt from the boxes each frame while F3+B is on. */
export class HitboxRenderer {
  constructor(scene) {
    this.geometry = new THREE.BufferGeometry();
    // depthWrite false and the depth test left on (glDepthMask(false) only); fog off like GL_LIGHTING/TEXTURE_2D off.
    this.material = new THREE.LineBasicMaterial({ color: HITBOX_COLOR, depthWrite: false, fog: false, toneMapped: false });
    this.lines = new THREE.LineSegments(this.geometry, this.material);
    this.lines.frustumCulled = false; this.lines.renderOrder = 998; this.lines.visible = false;
    scene.add(this.lines);
  }
  update(boxes) {
    if (!boxes?.length) { this.lines.visible = false; return; }
    const pos = new Float32Array(boxes.length * 24 * 3);
    let n = 0;
    for (const b of boxes) for (const p of outlineSegments(b)) { pos[n++] = p[0]; pos[n++] = p[1]; pos[n++] = p[2]; }
    this.geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.geometry.setDrawRange(0, n / 3);
    this.lines.visible = true;
  }
}

/**
 * bao runTick keyboard loop, run on every keyboard event (press, repeat, release): with a timestamp set, 6000 ms or more later it
 * throws the crash; otherwise the timestamp resets when C or F3 is no longer down. With none set, C and F3 both down start it.
 * Returns the new timestamp and whether the crash fires. (bytecode-read)
 */
export function crashStep(stamp, now, cDown, f3Down) {
  if (stamp > 0) {
    if (now - stamp >= CRASH_HOLD_MS) return { stamp, crash: true };
    return { stamp: cDown && f3Down ? stamp : -1, crash: false };
  }
  return { stamp: cDown && f3Down ? now : stamp, crash: false };
}

/** The crash report text for the manual crash (b/s in bytecode: description + a bare java.lang.Throwable). */
export function crashReport(time = new Date()) {
  return ["---- Minecraft Crash Report ----", "", `Time: ${time.toISOString()}`, `Description: ${CRASH_DESCRIPTION}`, "", "java.lang.Throwable", "\tat net.minecraft.client.Minecraft.runTick(SourceFile:0)", ""].join("\n");
}

/** Non-destructive stand-in for the native crash (the JVM would write crash-reports/ and exit): the report in a dialog; "Back to game" closes it. */
export function showCrashReport(doc, text, onClose) {
  const box = doc.createElement("div");
  box.id = "debug-crash";
  box.style.cssText = "position:fixed;inset:0;z-index:100000;background:#000c;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#fff;font:14px monospace";
  const title = doc.createElement("div"); title.textContent = "Oops, Minecraft has crashed! (simulated: nothing was closed)";
  const pre = doc.createElement("pre"); pre.textContent = text; pre.style.cssText = "background:#222;padding:12px;max-width:80vw;overflow:auto;margin:0";
  const ok = doc.createElement("button"); ok.textContent = "Back to game"; ok.onclick = () => { box.remove(); onClose?.(); };
  box.append(title, pre, ok);
  doc.body.append(box);
  return box;
}
