import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { bookTexturePixels, buildBook, guiBookCamera } from './enchanting-book-renderer.js';
import { BOOK_PART_ORDER, bookAngles } from './enchanting-book.js';

test('the original book texture paints every UV region of the seven boxes', () => {
  const px = bookTexturePixels(), alpha = (x, y) => px[(y * 64 + x) * 4 + 3];
  for (const [u, v, w, h] of [[0, 0, 6, 10], [6, 0, 6, 10], [16, 0, 6, 10], [22, 0, 6, 10], [12, 0, 4, 10], [1, 11, 5, 8], [7, 11, 5, 8], [13, 11, 5, 8], [19, 11, 5, 8], [24, 10, 10, 8]])
    for (let y = v; y < v + h; y++) for (let x = u; x < u + w; x++) assert.equal(alpha(x, y), 255, `texel ${x},${y}`);
  assert.deepEqual([...bookTexturePixels()], [...px], 'deterministic');
});

test('the book model keeps only its drawable faces and applies ModelBook angles in Z, Y, X order', () => {
  const book = buildBook(new THREE.MeshBasicMaterial());
  // Flat boxes keep their front and back quads (12 vertices); the two 1-deep page blocks keep all six faces (36).
  const counts = BOOK_PART_ORDER.map((n) => book.parts[n].children[0].geometry.attributes.position.count);
  assert.deepEqual(counts, [6 * 2, 6 * 2, 6 * 2, 36, 36, 6 * 2, 6 * 2]);
  book.pose(100, 0.3, 0.6, 0.8);
  const angles = bookAngles(100, 0.3, 0.6, 0.8);
  BOOK_PART_ORDER.forEach((n) => {
    const [px, py, pz, ax, ay, az] = angles[n], g = book.parts[n];
    assert.ok(Math.abs(g.position.x - px / 16) < 1e-6 && Math.abs(g.position.z - pz / 16) < 1e-6 && py === 0);
    assert.deepEqual([g.rotation.x, g.rotation.y, g.rotation.z, g.rotation.order], [ax, ay, az, 'ZYX']);
  });
});

test('the GUI book projection is the 1.7.10 perspective shifted in clip space', () => {
  const camera = guiBookCamera(), e = camera.projectionMatrix.elements;
  // gluPerspective(90, 4/3, 9, 80): x scale 1 / (tan 45 * 4/3), y scale 1, w = -z; then glTranslatef(-0.34, 0.23, 0) adds shift * w.
  assert.ok(Math.abs(e[0] - 0.75) < 1e-6 && Math.abs(e[5] - 1) < 1e-6 && e[11] === -1, 'perspective kept');
  assert.ok(Math.abs(e[8] - 0.34) < 1e-6 && Math.abs(e[9] + 0.23) < 1e-6, 'clip-space shift');
  // The book's centre (eye space z = -16) lands inside the viewport.
  const p = new THREE.Vector3(0, 3.3, -16).applyMatrix4(camera.projectionMatrix);
  assert.ok(Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && p.z > -1 && p.z < 1);
});
