// Batch 65 clientreplays: replays of the executed probes in public/research/clientreplays-reference.json (tools/verify-clientreplays.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fishingLine, EYE_HEIGHT_OTHER } from "./fishing-line.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/clientreplays-reference.json", import.meta.url), "utf8"));
const near = (a, b, msg, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);

test("RenderFish line endpoint and curve match the executed bytecode-order probe (96 cases)", () => {
  const rows = ref.fishLine.rows.filter((r) => r.case.startsWith("line"));
  assert.equal(rows.length, 96);
  assert.ok(rows.some((r) => r.first) && rows.some((r) => !r.first && r.local) && rows.some((r) => !r.first && !r.local));
  for (const r of rows) {
    const [px, py, pz, x, y, z] = r.angler, [hpx, hpy, hpz, hx, hy, hz] = r.hook;
    const out = fishingLine({
      first: r.first, local: r.local, swing: r.swing, partial: r.pt,
      angler: { px, py, pz, x, y, z, prevYaw: r.prevYaw, yaw: r.yaw, prevPitch: r.prevPitch, pitch: r.pitch, prevRenderYawOffset: r.prevRenderYawOffset, renderYawOffset: r.renderYawOffset },
      hook: { px: hpx, py: hpy, pz: hpz, x: hx, y: hy, z: hz },
    });
    r.tip.forEach((v, i) => near(out.tip[i], v, `${r.case} tip ${i}`));
    r.points.forEach((p, k) => p.forEach((v, i) => near(out.points[k][i], v, `${r.case} point ${k}.${i}`)));
  }
});

test("another player's eye term is the executed EntityPlayer.getEyeHeight, the local player's is 0", () => {
  const eye = ref.fishLine.rows.find((r) => r.case === "eye").getEyeHeight;
  assert.equal(EYE_HEIGHT_OTHER, eye);
  for (const r of ref.fishLine.rows.filter((r) => r.case.startsWith("line") && !r.first)) assert.equal(r.eyeTerm, r.local ? 0 : eye);
});

test("the client half of the mob push does not exist: collideWithNearbyEntities is behind !isRemote, addVelocity sends no S12 flag", async () => {
  const { pushSection, addVelocity, classes } = ref.mobPush;
  assert.match(classes.sv.sha256, /^[0-9a-f]{64}$/);
  const i = pushSection.indexOf("getfield Field ahb.E:Z");
  assert.ok(i > 0 && pushSection[i + 1].startsWith("ifne") && pushSection[i + 3] === "invokevirtual Method bo:()V", "bo() runs only when isRemote is false");
  assert.deepEqual(addVelocity.slice(-1), ["putfield Field al:Z"], "Entity.addVelocity writes isAirBorne (al) last");
  assert.ok(!addVelocity.includes("putfield Field H:Z"), "and never velocityChanged (H), the flag the tracker sends S12 for");
  const { CLIENT_PUSHES_PLAYER } = await import("./client-push.js");
  assert.equal(CLIENT_PUSHES_PLAYER, false);
});
