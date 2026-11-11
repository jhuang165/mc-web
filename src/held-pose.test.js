import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";

globalThis.document ??= { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, style: {} }) };
const { heldKind, heldItemMatrix, isFull3D } = await import("./player-renderer.js");
const { originalOfLive } = await import("./item-names.js");
const { ITEMS } = await import("./survival.js");

// Executed third-person hand transforms (tools/probes/HeldPoseProbe.java, verify-held-pose.mjs): the unchanged RenderPlayer.renderSpecials,
// RenderBiped.renderEquippedItems and RenderWitch.renderEquippedItems ending in ItemRenderer.renderItem, as GL events.
const reference = JSON.parse(readFileSync(new URL("../public/research/held-pose-reference.json", import.meta.url)));
const RAD = Math.PI / 180, SWORDS = new Set([267, 268, 272, 276, 283]);

// native (id, damage) -> browser id
const live = new Map();
for (const id of Object.keys(ITEMS).map(Number).concat(Array.from({ length: 256 }, (_, i) => i))) {
  const o = originalOfLive(id);
  if (o && (!live.has(o.id) || id === o.id)) live.set(o.id + ":" + (o.damage ?? "*"), id);
}
const liveOf = (id, damage) => live.get(id + ":" + damage) ?? live.get(id + ":*");

function replay(events, anchor, stop) {
  const m = new THREE.Matrix4(), t = new THREE.Matrix4();
  let on = false;
  for (const e of events) {
    if (e[0] === stop) break;
    if (!on) { on = e[0] === "T" && e[1] === anchor[0] && e[2] === anchor[1] && e[3] === anchor[2]; if (!on) continue; }
    if (e[0] === "T") m.multiply(t.makeTranslation(e[1], e[2], e[3]));
    else if (e[0] === "S") m.multiply(t.makeScale(e[1], e[2], e[3]));
    else if (e[0] === "R") m.multiply(t.makeRotationAxis(new THREE.Vector3(e[2], e[3], e[4]), e[1] * RAD));
  }
  return m;
}

test("the third-person hand transform of every executed item matches the port", () => {
  let compared = 0;
  for (const c of reference.cases) {
    if (c.who === "babyBiped") continue; // the child prefix sits before the arm postRender (gap, see the note)
    const liveId = liveOf(c.id, c.damage);
    assert.ok(liveId !== undefined, "browser id of native " + c.id);
    // RenderPlayer (not RenderBiped) swaps a held rod for a stick while the bobber is out (PlayerBody.syncHeld does the same).
    const shown = c.cast && c.who === "player" ? 300 : liveId, kind = heldKind(shown, c.damage), nose = c.who === "witch";
    const blocking = c.who === "player" && c.use > 0 && SWORDS.has(c.id); // RenderBiped has no blocking branch
    const anchor = nose ? [-0.0625, 0.53125, 0.21875] : [-0.0625, 0.4375, 0.0625];
    const want = replay(c.events, anchor, kind === "block" ? "C" : "D"), got = heldItemMatrix(kind, { origin: nose ? "nose" : "arm", blocking });
    for (let i = 0; i < 16; i++) assert.ok(Math.abs(got.elements[i] - want.elements[i]) < 1e-5, `${c.who} ${c.id} use ${c.use} cast ${c.cast} (${kind}) element ${i}: ${got.elements[i]} vs ${want.elements[i]}`);
    compared++;
  }
  assert.ok(compared > 60);
});

test("Item.isFull3D of the port matches the executed flags", () => {
  let checked = 0;
  for (const [nativeId, flag] of Object.entries(reference.flags)) {
    const id = liveOf(Number(nativeId), 0);
    if (id === undefined) continue;
    assert.equal(isFull3D(id), !!flag[0], "isFull3D of native " + nativeId + " (browser " + id + ")");
    checked++;
  }
  assert.ok(checked > 30);
});
