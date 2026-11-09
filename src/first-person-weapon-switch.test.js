import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FirstPerson } from './first-person.js';

test('outgoing gun and knife models never render with a vanilla item matrix between hotbar states', () => {
  const oldWidth = globalThis.innerWidth, oldHeight = globalThis.innerHeight;
  globalThis.innerWidth = 1280; globalThis.innerHeight = 800;
  try {
    for (const type of ['gunId', 'meleeId']) {
      const item = new THREE.Group(); let posed = 0;
      item.userData = { pack: true, [type]: 4700, view: { fov: () => 70, update: () => { posed++; return new THREE.Matrix4(); } } };
      const renderer = { autoClear: true, clear() {}, render() { assert.equal(item.visible, this.expected); }, expected: false };
      const first = Object.create(FirstPerson.prototype);
      Object.assign(first, { select() {}, item, pivot: new THREE.Group(), camera: new THREE.PerspectiveCamera(), materials: [], renderer, scene: new THREE.Scene() });
      const pose = { item: 4700, meta: 0, equip: 0, swing: {x:0,y:0,z:0,rx:0,ry:0,rz:0}, pitch: 0, bob: {x:0,y:0,rx:0,rz:0}, sway: null };
      first.render(pose, { gun: null });
      first.render(pose, { gun: { [type]: 4701, aim: 0 } });
      assert.equal(posed, 0);
      renderer.expected = true;
      first.render(pose, { gun: { [type]: 4700, aim: 0 } });
      assert.equal(posed, 1);
      // A subsequent mismatch must hide the previously visible model as well.
      renderer.expected = false; first.render(pose, { gun: null });
    }
  } finally { globalThis.innerWidth = oldWidth; globalThis.innerHeight = oldHeight; }
});
