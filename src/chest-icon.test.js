import test from 'node:test';
import assert from 'node:assert/strict';
import { chestIconTexture, drawChestIcon } from './chest-icon.js';

test('GUI chest icons use variant entity textures, with Christmas only for the normal chest', () => {
  const ordinary = new Date(2026, 10, 7), festive = new Date(2026, 11, 25);
  assert.equal(chestIconTexture(41, ordinary), 'entity/chest/normal');
  assert.equal(chestIconTexture(41, festive), 'entity/chest/christmas');
  for (const date of [ordinary, festive]) {
    for (const id of [162, 1940]) assert.equal(chestIconTexture(id, date), 'entity/chest/trapped');
    for (const id of [163, 1941]) assert.equal(chestIconTexture(id, date), 'entity/chest/ender');
    assert.equal(chestIconTexture(3, date), null);
  }
});

test('GUI chest model samples unpadded ModelBox faces and preserves its silhouette with HD textures', () => {
  for (const scale of [1, 2, 4]) {
    let matrix;
    const calls = [], points = [], source = { width: 64 * scale, height: 64 * scale };
    drawChestIcon({
      save() {}, restore() {}, fillRect() {},
      setTransform(...m) { matrix = m; },
      drawImage(image, sx, sy, sw, sh, x, y, w, h) {
        assert.equal(image, source);
        assert.ok(sx >= 0 && sy >= 0 && sx + sw <= source.width && sy + sh <= source.height);
        assert.equal(sw, w * scale); assert.equal(sh, h * scale);
        calls.push([sx / scale, sy / scale, sw / scale, sh / scale]);
        const [a, b, c, d, e, f] = matrix;
        for (const [px, py] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) points.push([a * px + c * py + e, b * px + d * py + f]);
      },
    }, source);
    assert.deepEqual(calls, [
      [28, 33, 14, 10], [14, 33, 14, 10], [14, 19, 14, 14],
      [28, 14, 14, 5], [14, 14, 14, 5], [14, 0, 14, 14],
      [3, 1, 1, 4], [1, 1, 2, 4], [1, 0, 2, 1],
    ]);
    assert.deepEqual([Math.min(...points.map(p => p[0])), Math.max(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[1]))], [7.5, 56.5, 8, 64]);
  }
});
