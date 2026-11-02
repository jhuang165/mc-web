import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MouseFilter, MouseLook, setAngles } from './mouse-look.js';
import { lookCurve } from './settings.js';

const f = Math.fround;
const ref = JSON.parse(await readFile(new URL('../public/research/settings-reference.json', import.meta.url), 'utf8'));
const deg = Math.PI / 180;

test('MouseFilter.smooth follows the qm bytecode step by step', () => {
  const m = new MouseFilter();
  // a = 10, d = (10 - 0) * 0.1 = 1, c = 0 + (1 - 0) * 0.5 = 0.5; d > c, so d = c.
  assert.equal(m.smooth(10, f(0.1)), f(0.5));
  assert.deepEqual([m.a, m.b, m.c], [10, f(0.5), f(0.5)]);
  // a = 10, d = (10 - 0.5) * 0.1 = 0.95, c = 0.5 + 0.45 * 0.5 = 0.725; d > c again.
  const d = f(f(f(10) - f(0.5)) * f(0.1)), c = f(f(0.5) + f(f(d - f(0.5)) * f(0.5)));
  assert.equal(m.smooth(0, f(0.1)), c);
  assert.equal(m.b, f(f(0.5) + c));
  // Once the step falls below the smoothed step, d is returned unchanged.
  const n = new MouseFilter();
  n.c = 5;
  assert.equal(n.smooth(2, f(0.5)), 1);
  assert.equal(n.c, 3);
  // Negative input mirrors positive input.
  const p = new MouseFilter(), q = new MouseFilter();
  for (const x of [7, 0, -3, 0, 0]) assert.equal(q.smooth(-x, f(0.2)), -p.smooth(x, f(0.2)));
  // The output converges on the accumulated input.
  const r = new MouseFilter();
  let sum = r.smooth(20, f(0.05));
  for (let i = 0; i < 400; i++) sum = f(sum + r.smooth(0, f(0.05)));
  assert(Math.abs(sum - 20) < 1e-3, String(sum));
  assert.equal(ref.controls.mouseLook.mouseFilterHalf, 0.5);
});

test('plain mouse look uses the sensitivity curve and the invert multiplier', () => {
  const look = new MouseLook();
  // Default sensitivity: curve 1, so the setAngles arguments are the pixel deltas.
  assert.deepEqual(look.frame(10, 5, 0.3, { sensitivity: 0.5 }), [10, 5]);
  assert.deepEqual(look.frame(10, 5, 0.3, { sensitivity: 0.5, invertMouse: true }), [10, -5]);
  assert.deepEqual(look.frame(-4, 3, 0, { sensitivity: 1 }), [f(-4 * lookCurve(1)), f(3 * lookCurve(1))]);
  assert.equal(ref.controls.mouseLook.invertMultiplier, -1);
  // Without the cinematic camera, ticks do not touch the filters.
  look.tick(0.5, false);
  assert.deepEqual([look.filteredYaw, look.filteredPitch, look.filterX.a], [0, 0, 0]);
});

test('Entity.setAngles turns 0.15 degrees per unit and clamps pitch to +-90 degrees', () => {
  const { setAnglesDegreesPerUnit, pitchClamp } = ref.controls.mouseLook;
  assert.equal(setAnglesDegreesPerUnit, 0.15);
  assert.deepEqual(pitchClamp, [-90, 90]);
  // Mouse right raises rotationYaw (the port's yaw falls); mouse up lowers rotationPitch (looks up).
  const v = setAngles({ yaw: 0, pitch: 0 }, 100, 100);
  assert(Math.abs(v.yaw + 15 * deg) < 1e-12 && Math.abs(v.pitch - 15 * deg) < 1e-12);
  assert.equal(setAngles({ yaw: 0, pitch: 0 }, 0, 1000).pitch, Math.PI / 2);
  assert.equal(setAngles({ yaw: 0, pitch: 0 }, 0, -1000).pitch, -Math.PI / 2);
  assert(Math.abs(setAngles({ yaw: 0, pitch: Math.PI / 2 }, 0, -100).pitch - 75 * deg) < 1e-12);
});

test('the cinematic camera filters per tick and spreads each tick over the partial ticks', () => {
  const opts = { sensitivity: 0.5, smoothCamera: true };
  const look = new MouseLook();
  // Input in a frame is gathered, but the turn uses the filter output of the last tick (0 so far).
  assert.deepEqual(look.frame(40, -20, 0.5, opts), [0, 0]);
  assert.deepEqual([look.smoothYaw, look.smoothPitch], [40, -20]);
  look.tick(0.5, true);
  const k = f(f(ref.controls.mouseLook.smoothFilterFactor) * lookCurve(0.5));
  const x = new MouseFilter(), y = new MouseFilter();
  const mx = x.smooth(40, k), my = y.smooth(-20, k);
  assert.deepEqual([look.filteredYaw, look.filteredPitch, look.partial, look.smoothYaw, look.smoothPitch], [mx, my, 0, 0, 0]);
  // Frames at partial 0.25 and 0.75 turn by M * 0.25 and M * 0.5; inverted pitch is negated.
  assert.deepEqual(look.frame(0, 0, 0.25, opts), [f(mx * 0.25), f(my * 0.25)]);
  assert.deepEqual(look.frame(0, 0, 0.75, { ...opts, invertMouse: true }), [f(mx * 0.5), f(-f(my * 0.5))]);
  // The next tick keeps filtering with no new input, so the camera keeps drifting toward it.
  look.tick(0.5, true);
  assert.equal(look.filteredYaw, x.smooth(0, k));
  assert(look.filteredYaw > 0);
  // Turning the camera off leaves the filter state for the next time it is turned on.
  const before = look.filterX.a;
  look.tick(0.5, false);
  look.frame(5, 5, 0.5, { sensitivity: 0.5 });
  assert.equal(look.filterX.a, before);
});
