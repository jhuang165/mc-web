import test from 'node:test';
import assert from 'node:assert/strict';
import { localMountYaw, windowHorseMob, horseLook, horseLookKey, ridingPose, riderYaws } from './multiplayer/client-rider-pose.js';

const pig = (prev, cur) => ({ horse: true, entity: { prevRenderYawOffset: prev, renderYawOffset: cur } });
const mobs = (mob) => ({ copies: new Map([[7, { mob, client: { prevRenderYawOffset: 10, renderYawOffset: 30 } }]]) });

test('a ridden pig or horse gives the mount body yaw, interpolated', () => {
  assert.equal(localMountYaw({ vehicle: pig(10, 30) }, 0.5), 20);
  assert.equal(localMountYaw({ vehicle: pig(10, 30) }, 1), 30);
});
test('boats and carts are not clamped (not EntityLivingBase)', () => {
  assert.equal(localMountYaw({ vehicle: { boat: true, yaw: 40 } }, 1), null);
  assert.equal(localMountYaw({ vehicle: { slots: [] } }, 1), null);
  assert.equal(localMountYaw({ riding: 'b3', mobs: mobs({}) }, 1), null);
  assert.equal(localMountYaw({}, 1), null);
});
test('multiplayer self uses the mount copy by seat key', () => {
  assert.equal(localMountYaw({ riding: 'm7', mobs: mobs({}) }, 1), 30);
  assert.equal(localMountYaw({ riding: 'm9', mobs: mobs({}) }, 1), null);
});
test('local pose gets the same clamp as a remote rider', () => {
  const pose = { bodyYaw: 0, headYaw: 120, x: 1 };
  const out = ridingPose(pose, 0), r = riderYaws(120, 0);
  assert.equal(out.bodyYaw, r.body);
  assert.ok(Math.abs(r.body - 52) < 1e-4); // 120 - 85, plus 85 * 0.2 past 50 degrees
  assert.equal(ridingPose(pose, null), pose);
});
test('horse window finds the live mob: single player record or mp copy', () => {
  const rec = { type: 'horse' };
  assert.equal(windowHorseMob({ horseMob: rec }, null), rec);
  const m = { type: 'horse' };
  assert.equal(windowHorseMob({ container: { horse: { id: 7 } } }, mobs(m)), m);
  assert.equal(windowHorseMob({ container: { horse: { id: 7 } } }, mobs({ type: 'pig' })), null);
  assert.equal(windowHorseMob({}, mobs(m)), null);
});
test('horse look follows armour, saddle and growth while the window is open', () => {
  const h = { type: 0, variant: 3, items: [null, null], saddled: false, armor: 0 };
  const mob = { growingAge: -24000, horse: { type: 0, variant: 3, saddled: true, armor: 2 } };
  let look = horseLook(h, mob);
  assert.deepEqual([look.saddled, look.armor, look.age], [false, 0, -24000]); // the window's stacks win
  h.saddled = true; h.armor = 3; mob.growingAge = -100;
  look = horseLook(h, mob);
  assert.deepEqual([look.saddled, look.armor, look.age], [true, 3, -100]);
  h.saddled = false; h.armor = 0;
  assert.deepEqual([horseLook(h, mob).saddled, horseLook(h, mob).armor], [false, 0]);
});
test('without stacks the live mob flags apply, and a coat change changes the key', () => {
  const h = { type: 0, variant: 1 }, mob = { growingAge: 0, horse: { type: 0, variant: 1, saddled: true, armor: 1 } };
  const a = horseLook(h, mob);
  assert.deepEqual([a.saddled, a.armor], [true, 1]);
  mob.horse.variant = 2;
  assert.notEqual(horseLookKey(horseLook(h, mob)), horseLookKey(a));
  assert.equal(horseLook(h, null).age, 0);
});
