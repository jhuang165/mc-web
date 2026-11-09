import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FirstPerson } from './first-person.js';
import { PlayerRenderer } from './player-renderer.js';

test('skin changes reach the bare hand, existing gun/knife arms and arms built later, then reset to Steve', () => {
  const steve = new THREE.Texture(), custom = new THREE.Texture();
  const view = Object.create(FirstPerson.prototype);
  Object.assign(view, { skinMap: steve, defaultSkinMap: steve, skinMaterials: new Set(), material: opts => new THREE.ShaderMaterial({ uniforms: { map: { value: opts.map } } }) });
  const hand = view.skinMaterial(), gunArm = view.packArm(false);
  view.setSkin(custom);
  assert.equal(hand.uniforms.map.value, custom); assert.equal(gunArm.material.uniforms.map.value, custom);
  const knifeArm = view.packArm(true); assert.equal(knifeArm.material.uniforms.map.value, custom);
  knifeArm.material.dispose(); assert.equal(view.skinMaterials.size, 2);
  view.setSkin(null); assert.equal(hand.uniforms.map.value, steve); assert.equal(gunArm.material.uniforms.map.value, steve);
});

test('third-person and inventory renderers can swap skins without changing armour or losing their default map', () => {
  const steve = new THREE.Texture(), custom = new THREE.Texture();
  const view = Object.create(PlayerRenderer.prototype); view.base = { uniforms: { map: { value: steve } } };
  view.setSkin(custom); assert.equal(view.base.uniforms.map.value, custom);
  view.setSkin(null); assert.equal(view.base.uniforms.map.value, steve);
});
