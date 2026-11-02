// Test-only deterministic worlds and recorded controls for the pre-extraction
// player movement regression. These are browser-port traces, not a Java oracle.
import { World, WATER, LAVA, LADDER } from './world.js';
import { PlayerMotion } from './player-movement.js';

export function vector(x, y, z) {
  return { x, y, z, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; },
    copy(v) { return this.set(v.x, v.y, v.z); }, clone() { return vector(this.x, this.y, this.z); } };
}

export function playerFixture(name) {
  const world = new World('player-physics-boundary');
  for (let x = 55; x <= 73; x++) for (let z = 53; z <= 70; z++) {
    for (let y = 9; y <= 19; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  }
  for (let x = 60; x <= 68; x++) for (let y = 10; y <= 12; y++) world.put(x, y, 60, 3, 0, false);
  for (let x = 60; x <= 68; x++) for (let z = 55; z <= 58; z++)
    for (let y = 10; y <= 12; y++) world.put(x, y, z, WATER, 0, false);
  if (name === 'lava') for (let x = 60; x <= 68; x++) for (let z = 55; z <= 58; z++)
    for (let y = 10; y <= 12; y++) world.put(x, y, z, LAVA, 0, false);
  if (name === 'ladder') for (let y = 10; y <= 17; y++) world.put(64, y, 61, LADDER, 3, false);
  const start = ['water', 'lava'].includes(name) ? [64.5, 10, 57.5] : name === 'ladder' ? [64.5, 11, 61.65] : name === 'edge' ? [0.32, 90, 64.5] :
    name === 'ceiling' ? [64.5, world.height + 41, 64.5] : [64.5, 10, 65.5];
  const position = vector(...start), previous = vector(...start), velocity = vector(0, 0, 0);
  const state = { world, position, previous, velocity, motion: new PlayerMotion(), grounded: name === 'land' || name === 'web',
    collidedH: false, flying: name === 'edge', fallDistance: 0, landedFall: 0, yaw: 0,
    survival: { creative: !['land', 'lava', 'ladder', 'web'].includes(name), food: 20, exhaustion: 0, exhaust(n) { this.exhaustion += n; } },
    eating: null, toasts: [] };
  if (name === 'web') state.motion.inWeb = true;
  return state;
}

export function playerInputs(name) {
  const count = name === 'land' ? 90 : ['water', 'lava'].includes(name) ? 60 : name === 'ladder' ? 40 : 15;
  return Array.from({ length: count }, (_, i) => ({
    forward: name === 'land' ? (i < 65 ? 1 : 0) : ['water', 'lava'].includes(name) ? (i < 40 ? 1 : -1) : ['ladder', 'web'].includes(name) ? 1 : 0,
    strafe: name === 'edge' ? -1 : name === 'land' && i >= 65 ? 1 : 0,
    sneak: name === 'land' && i >= 52 && i < 65 || name === 'ladder' && i >= 25,
    sprint: name === 'land' && i < 30,
    jump: name === 'land' ? i >= 14 && i < 17 : ['water', 'lava'].includes(name) && (i === 2 || i === 4 || i >= 30 && i < 38),
  }));
}

export function playerSnapshot(s, result) {
  const xyz = v => [v.x, v.y, v.z];
  return { position: xyz(s.position), previous: xyz(s.previous), velocity: xyz(s.velocity), grounded: s.grounded,
    collidedH: s.collidedH, flying: s.flying, fallDistance: s.fallDistance, landedFall: s.landedFall,
    exhaustion: s.survival.exhaustion, motion: { ...s.motion }, toasts: [...s.toasts],
    result: { ...result, oldPosition: xyz(result.oldPosition) } };
}
