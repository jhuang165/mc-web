import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureMovementInput } from './player-input.js';
import { PlayerMotion } from './player-movement.js';

test('keyboard snapshots preserve opposing keys and both modifier sides', () => {
  const codes = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'Space'];
  for (let bits = 0; bits < 2 ** codes.length; bits++) {
    const keys = new Set(codes.filter((_, i) => bits & (1 << i)));
    const input = captureMovementInput(keys);
    assert.deepEqual(input, {
      forward: Number(keys.has('KeyW')) - Number(keys.has('KeyS')),
      strafe: Number(keys.has('KeyD')) - Number(keys.has('KeyA')),
      sneak: keys.has('ShiftLeft') || keys.has('ShiftRight'),
      sprint: keys.has('ControlLeft') || keys.has('ControlRight'),
      jump: keys.has('Space'),
    });
    const recorded = JSON.parse(JSON.stringify(input));
    keys.clear();
    assert.deepEqual(input, recorded, 'snapshot is independent of later key changes');
  }
});

test('recorded movement snapshots replay sprint, sneak, jump and flight state', () => {
  const keys = [[], ['KeyW'], [], ['KeyW', 'Space'], ['KeyW'], ['KeyW', 'Space'],
    ['KeyW', 'ShiftRight'], ['KeyD', 'ControlRight'], [], ['Space']].map(a => new Set(a));
  const recorded = JSON.parse(JSON.stringify(keys.map(captureMovementInput)));
  const run = frames => {
    const motion = new PlayerMotion();
    let flying = false;
    return frames.map(frame => {
      const input = motion.update(frame, { onGround: true, sprintKey: frame.sprint });
      if (motion.toggleFlight(frame.jump, true)) flying = !flying;
      const jump = motion.jump(frame.jump, { onGround: true });
      motion.endMove();
      return { input, sprinting: motion.sprinting, sneaking: motion.sneaking, flying, jump,
        timer: motion.sprintToggleTimer, ySize: motion.ySize };
    });
  };
  const actual = run(recorded);
  assert.deepEqual(actual, run(keys.map(captureMovementInput)));
  assert.equal(actual[3].sprinting, true, 'double-tap forward starts sprinting');
  assert.equal(actual[3].jump, 'jump');
  assert.equal(actual[5].flying, true, 'double-tap jump toggles flight');
  assert.equal(actual[6].sneaking, true);
  assert.equal(actual[6].sprinting, false);
});
