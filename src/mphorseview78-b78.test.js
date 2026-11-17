import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bipedPose } from './player-renderer.js';
import { riderYaws, ridingPose, mountBodyYaw, previewHorse } from './multiplayer/client-rider-pose.js';
import { mountSeat } from './multiplayer/client-ride-seat.js';
import { buildWindow } from './multiplayer/client-containers.js';
import { HORSE_PREVIEW_LAYOUT, horsePreviewPose } from './horse-preview.js';
import { paperdollPose } from './inventory-player.js';
import { ServerPlayerTracker } from './multiplayer/server-player-tracker.js';

const f = Math.fround;
const main = readFileSync(new URL('./main.js', import.meta.url), 'utf8');

test('riding pose (ModelBiped.isRiding): arms -PI/5, legs forward -2PI/5, legs splayed +-PI/10', () => {
  const still = bipedPose({}), r = bipedPose({ riding: true });
  assert.equal(r.rightArm.rot[0], still.rightArm.rot[0] - f(Math.PI / 5));
  assert.equal(r.leftArm.rot[0], still.leftArm.rot[0] - f(Math.PI / 5));
  assert.equal(r.rightLeg.rot[0], -f(f(Math.PI) * f(2 / 5)));
  assert.equal(r.leftLeg.rot[0], r.rightLeg.rot[0]);
  assert.equal(r.rightLeg.rot[1], f(Math.PI / 10));
  assert.equal(r.leftLeg.rot[1], -f(Math.PI / 10));
  // limb swing does not move a seated rider's legs
  assert.deepEqual(bipedPose({ riding: true, limbSwing: 3, limbSwingAmount: 1 }).rightLeg.rot, r.rightLeg.rot);
});

test('remote riders use the same pose flag as the local player', () => {
  const presence = readFileSync(new URL('./multiplayer/presence.js', import.meta.url), 'utf8');
  assert.match(presence, /riding: !!p\.riding, mountYaw:/);
  assert.match(main, /riding: !!rider\.vehicle \|\| !!mpRiding/);
});

test('seat offset: the feet sit at the mount seat with getYOffset -0.5 (boat, pig, horse)', () => {
  const pig = { client: { x: 1, y: 64, z: 2, yaw: 0 }, mob: { type: 'pig', width: 0.9, height: 0.9, x: 1, y: 64, z: 2, yaw: 0 } };
  const seat = mountSeat('m7', { mobs: { copies: new Map([[7, pig]]) } });
  assert.ok(seat && Math.abs(seat.y - (64 + 0.9 * 0.75 - 0.5)) < 1e-6, JSON.stringify(seat));
  assert.equal(mountSeat('m8', { mobs: { copies: new Map() } }), null);
});

test('riderYaws: clamp to 85 degrees of the mount body, 0.2 extra past 50 degrees (boh.a, bytecode-read)', () => {
  assert.deepEqual(riderYaws(30, 20), { body: 20, head: 10 });
  const r = riderYaws(100, 0); // d clamps to 85, d*d > 2500 -> body = 15 + 17
  assert.equal(r.body, f(15 + f(85 * f(0.2))));
  assert.equal(r.head, f(100 - r.body));
  const w = riderYaws(-170, 170); // wrapped difference is +20
  assert.equal(w.body, -190);
  assert.equal(riderYaws(40, 0).body, 0 + 0); // d = 40: within 50 -> no extra turn
});

test('ridingPose replaces body and relative head yaw; null mount leaves the pose', () => {
  const pose = { bodyYaw: 10, headYaw: 5, x: 1 };
  assert.equal(ridingPose(pose, null), pose);
  assert.deepEqual(ridingPose(pose, 0), { ...pose, bodyYaw: 0, headYaw: 15 });
});

test('mountBodyYaw: interpolated renderYawOffset of a pig or horse copy only', () => {
  const mobs = { copies: new Map([[3, { client: { prevRenderYawOffset: 10, renderYawOffset: 30 } }]]) };
  assert.equal(mountBodyYaw('m3', mobs, 0.5), 20);
  assert.equal(mountBodyYaw('b3', mobs, 0.5), null);
  assert.equal(mountBodyYaw('m4', mobs, 0.5), null);
});

test('horse window preview: layout and pose match GuiScreenHorseInventory (anchor 51,60 scale 17)', () => {
  assert.deepEqual(HORSE_PREVIEW_LAYOUT, { x: 51, y: 60, scale: 17, lookX: 51, lookY: 25, width: 176, height: 166 });
  assert.deepEqual(horsePreviewPose(51, 25), paperdollPose(0, 0));
  assert.match(main, /attachHorsePreview\(kind === "horse" \? container\.horse : null\)/);
});

test('the multiplayer horse window gives the preview the copy\'s look', () => {
  const mob = { type: 'horse', growingAge: -24000, horse: { type: 0, variant: 515, armor: 2, saddled: true } };
  const mobs = { copies: new Map([[9, { mob }]]) };
  const h = previewHorse({ id: 9, type: 0, chested: false, tame: true, saddled: false, armor: 0, items: null }, mobs);
  assert.equal(h.variant, 515); assert.equal(h.armor, 2); assert.equal(h.saddled, true); assert.equal(h.age, -24000);
  const bare = { id: 5, type: 0 };
  assert.equal(previewHorse(bare, mobs), bare);
  const survival = { inventory: { main: Array(36).fill(null), armor: [null, null, null, null], hotbar: 0 } };
  assert.match(readFileSync(new URL('./multiplayer/client-containers.js', import.meta.url), 'utf8'), /previewHorse\(\{ id: m\.horse\.id/);
  assert.match(main, /crafted: \(stack, n\) => statsLive\.crafted\(stack, n\), mobs: remoteMobs/);
  assert.ok(survival && typeof buildWindow === 'function');
});

test('tracker: a riding player is sent look packets only, no position packets (my.a(List) riding branch)', () => {
  const src = readFileSync(new URL('./multiplayer/server-player-tracker.js', import.meta.url), 'utf8');
  assert.match(src, /e\.ridingEntity = target\.mount/);
  assert.ok(ServerPlayerTracker);
});
