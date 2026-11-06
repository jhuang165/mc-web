// Snapshot keyboard state once per simulation tick. The result is plain data,
// so the movement rules can also consume recorded inputs without a DOM.
// `keys` is either a function telling whether a KeyBinding is held (KeyBindings.isDown, the game's
// rebindable keys: MovementInputFromOptions reads key.forward/back/left/right/jump/sneak) or a Set
// of KeyboardEvent codes at the default bindings (recorded inputs and tests).
const DEFAULT_CODES = {
  'key.forward': ['KeyW'], 'key.back': ['KeyS'], 'key.left': ['KeyA'], 'key.right': ['KeyD'],
  'key.jump': ['Space'], 'key.sneak': ['ShiftLeft', 'ShiftRight'], 'key.sprint': ['ControlLeft', 'ControlRight'],
};
export function captureMovementInput(keys) {
  const down = typeof keys === 'function' ? keys : (d) => DEFAULT_CODES[d].some((c) => keys.has(c));
  return {
    forward: (down('key.forward') ? 1 : 0) - (down('key.back') ? 1 : 0),
    strafe: (down('key.right') ? 1 : 0) - (down('key.left') ? 1 : 0),
    sneak: down('key.sneak'),
    sprint: down('key.sprint'),
    jump: down('key.jump'),
  };
}
