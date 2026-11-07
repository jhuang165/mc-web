import test from 'node:test';
import assert from 'node:assert/strict';
import { commandBlockLayout, lastOutputText } from './command-block-screen.js';

test('GuiCommandBlock layout follows the 1.7.10 bytecode (bfh)', () => {
  const L = commandBlockLayout(427, 240);
  assert.deepEqual(L.title, [213, 20]);
  assert.deepEqual([L.command, L.output], [{ x: 63, y: 50, w: 300, h: 20 }, { x: 63, y: 135, w: 300, h: 20 }]);
  assert.deepEqual([L.done, L.cancel], [{ x: 59, y: 192, w: 150, h: 20 }, { x: 217, y: 192, w: 150, h: 20 }]);
  assert.deepEqual([L.commandLabel, L.hints, L.outputLabel], [[63, 37], [[63, 75], [63, 84], [63, 93]], [63, 122]]);
});
test('the previous output is the stored chat component text', () => {
  assert.equal(lastOutputText(null), '');
  assert.equal(lastOutputText('{"text":"hi"}'), 'hi');
  assert.equal(lastOutputText('plain'), 'plain');
});
