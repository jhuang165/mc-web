// Batch 53 digfinish: ItemInWorldManager's dig timer (b53df, executed: tools/probes/DigFinishProbe.java on the real EntityPlayerMP and
// ItemInWorldManager) replayed through src/server-dig.js, plus the port's own rate for the dug blocks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServerDig } from './server-dig.js';

const ref = JSON.parse(readFileSync(new URL('../public/research/dig-finish-reference.json', import.meta.url), 'utf8'));
const num = (v) => (v === 'Infinity' ? Infinity : v);
const CELL = [10, 5, 10];

// Replays one record: the world is the single dug cell; the server dig answers the packets as the probe's did.
function replay(rec) {
  const dig = createServerDig();
  let cell = rec.block, rate = null, results = []; const other = {};
  for (const step of rec.steps) {
    if (step.o === 't') {
      const breaks = [];
      for (let j = 1; j <= step.n; j++) {
        const hit = dig.tick(() => (cell === 0 ? null : rate));
        if (hit) { assert.deepEqual(hit, CELL); breaks.push(j + ':remove|' + cell); cell = 0; rate = null; }
      }
      const expected = step.e.filter((e) => /:remove\|/.test(e));
      assert.deepEqual(breaks, expected, `${rec.name} ticks`);
      assert.equal(cell, step.c, `${rec.name} cell after ticks`);
      assert.equal(dig.state.cur, step.cur, `${rec.name} curblockDamage`);
      results.push({ ticks: step.n, breaks });
      continue;
    }
    if (step.s.op === 't') { // detail records (cracks-stone) keep every tick as a step
      assert.equal(dig.tick(() => (cell === 0 ? null : rate)), null);
      assert.equal(dig.state.cur, step.s.cur);
      continue;
    }
    const op = step.s.op, [kind, x, y, z] = op.split(':'), pos = [+x, +y, +z], events = step.s.events;
    const before = num(step.r);
    if (kind === 's') {
      // A block with relative hardness >= 1 breaks at once on the server (not this timer); air and the rest start the dig.
      if (before !== null && before >= 1) { assert.ok(events.some((e) => e.startsWith('remove')), `${rec.name} instant`); cell = 0; }
      else { dig.start(pos); assert.ok(!events.some((e) => e.startsWith('remove')), `${rec.name} start`); }
    } else if (kind === 'f') {
      const r = dig.finish(pos, before), s23 = events.find((e) => e.startsWith('S23'));
      assert.equal(r === 'break', events.some((e) => e.startsWith('remove')), `${rec.name} break at ${op}`);
      if (r === 'break') cell = 0;
      const at = pos[0] === 10 ? cell : (other[pos[0]] ?? 0); // the probe sets one other cell (11,5,10) in finish-other-cell
      assert.equal(at !== 0, !!s23, `${rec.name} resend at ${op}`);
      if (s23) assert.equal(s23, `S23|${pos.join('|')}|${at}`);
      results.push(r);
    } else if (kind === 'set') { if (pos[0] === 10) cell = Number(op.split(':')[4]); else other[pos[0]] = Number(op.split(':')[4]); }
    assert.equal(cell, step.c, `${rec.name} ${op} cell`);
    rate = num(step.ra);
  }
  return results;
}

test('every executed dig scenario replays through the server dig timer', () => {
  const cases = ref.records.filter((r) => r.case === 'dig');
  assert.ok(cases.length > 1500);
  for (const rec of cases) replay(rec);
});

test('a finish at 0.7 of the damage breaks at once, below it waits for damage 1 (dirt, bare hand: 0.0667 a tick)', () => {
  const dirt = (k) => ref.records.find((r) => r.name === `finish-k${k}` && r.block === 3 && r.tool === 0 && r.steps[2].s.op === 'ground:1');
  // 12 ticks: 0.0667 * 13 = 0.87 >= 0.7: the block breaks on the finish. 8 ticks: 0.6: resent, broken 6 ticks later (damage 1 at 15 ticks).
  assert.ok(dirt(12).steps[3].s.events.includes('remove|3'));
  assert.deepEqual(dirt(8).steps[3].s.events, ['S23|10|5|10|3']);
  assert.deepEqual(dirt(8).steps.at(-1).e, ['6:aux|2001|3', '6:remove|3']);
  // a finish in the air (rate 0.2x) waits much longer
  const air = ref.records.find((r) => r.name === 'finish-k8' && r.block === 3 && r.tool === 0 && r.steps[2].s.op === 'ground:0');
  assert.ok(Number(air.steps.at(-1).e[0].split(':')[0]) > 6);
});

test('the server breaks a softer block at the cell that the client did not dig', () => {
  const rec = ref.records.find((r) => r.name === 'swap-1-3-k10');
  assert.equal(rec.block, 1); // stone dug with a bare hand, dirt in the cell at the finish
  assert.equal(rec.steps[3].s.events.at(-1), 'remove|3');
  assert.equal(rec.steps[3].c, 0);
  // a harder block (obsidian, bedrock) is left alone and resent
  for (const name of ['swap-3-49-k160', 'swap-1-7-k160']) {
    const r = ref.records.find((x) => x.name === name);
    assert.ok(r.steps.some((s) => s.s?.events?.some((e) => e.startsWith('S23'))), name);
    assert.equal(r.steps.at(-1).c, r.steps[2].c, name);
  }
});

test('a finish at another cell, with no start or after an abort, breaks nothing', () => {
  for (const name of ['finish-other-cell', 'finish-no-start']) {
    const rec = ref.records.find((r) => r.name === name);
    assert.ok(!rec.steps.some((s) => (s.s?.events ?? []).some((e) => e.startsWith('remove'))), name);
  }
  assert.equal(replay(ref.records.find((r) => r.name === 'finish-other-cell'))[1], 'ignore');
});
