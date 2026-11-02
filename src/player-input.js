// Snapshot keyboard state once per simulation tick. The result is plain data,
// so the movement rules can also consume recorded inputs without a DOM.
export function captureMovementInput(keys) {
  return {
    forward: (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0),
    strafe: (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0),
    sneak: keys.has('ShiftLeft') || keys.has('ShiftRight'),
    sprint: keys.has('ControlLeft') || keys.has('ControlRight'),
    jump: keys.has('Space'),
  };
}
