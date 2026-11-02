import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Survival } from './survival.js';
import { tickPlayerMining } from './player-mining.js';

const STONE = 3, DIRT = 1, BLOCK = [4, 12, 7];
function fixture({ block = DIRT, tool = 0, held = tool, mineHeld = true, mining = null, cooldown = 0,
  target = { block: [...BLOCK], adjacent: [BLOCK[0], BLOCK[1] + 1, BLOCK[2]] }, aimedEntity = null,
  playing = true, time = 0, grounded = true } = {}) {
  const cells = new Map([[BLOCK.join(','), block]]), survival = new Survival({ slots: tool ? [{ id: tool, count: 1 }] : [] });
  survival.time = time;
  const state = { playing, mineHeld, target, aimedEntity, mining, cooldown, survival, heldTool: held, grounded };
  return { state, survival, cells,
    getBlock: (...p) => cells.get(p.join(',')) || 0,
    setBlock: (p, id) => id ? cells.set(p.join(','), id) : cells.delete(p.join(',')),
  };
}

test('non-playing ticks leave cooldown and mining alone and emit no hit particles', () => {
  const f = fixture({ playing: false, cooldown: 3, mining: { block: [...BLOCK], type: DIRT, progress: 0.2, tool: 0, auto: false } });
  const calls = [];
  tickPlayerMining(f.state, { getBlock: f.getBlock, hitParticles: () => calls.push('hit') });
  assert.equal(f.state.cooldown, 3);
  assert.equal(f.state.mining.progress, 0.2);
  assert.deepEqual(calls, []);
});

test('cooldown decrements without progress while hit particles still run on the current face', () => {
  const mine = { block: [...BLOCK], type: DIRT, progress: 0.2, tool: 0, auto: false };
  const f = fixture({ cooldown: 2, mining: mine });
  const calls = [];
  tickPlayerMining(f.state, {
    getBlock: f.getBlock,
    swing: () => calls.push('swing'),
    hitParticles: (...args) => calls.push(['hit', ...args]),
  });
  assert.equal(f.state.cooldown, 1);
  assert.equal(f.state.mining.progress, 0.2);
  assert.deepEqual(calls, [['hit', ...BLOCK, 1]]);
});

test('entity targeting cancels current mining and suppresses hit particles', () => {
  const f = fixture({ aimedEntity: { id: 'cow' }, mining: { block: [...BLOCK], type: DIRT, progress: 0.4, tool: 0, auto: false } });
  const calls = [];
  tickPlayerMining(f.state, { getBlock: f.getBlock, hitParticles: () => calls.push('hit') });
  assert.equal(f.state.mining, null);
  assert.deepEqual(calls, []);
});

test('edit(false) can synchronously start mining and the first progress step follows in the same tick', () => {
  const f = fixture({ mining: null, time: 0 }), calls = [];
  tickPlayerMining(f.state, {
    getBlock: f.getBlock,
    edit: (place, state) => {
      calls.push(`edit:${place}`);
      state.mining = { block: [...BLOCK], type: DIRT, progress: 0, tool: 0, auto: false };
      return { mining: state.mining, cooldown: state.cooldown };
    },
    eyeInWater: () => { calls.push('eye'); return false; },
    swing: () => calls.push('swing'),
    digSound: () => calls.push('dig'),
    hitParticles: () => calls.push('hit'),
  });
  assert.deepEqual(calls, ['edit:false', 'eye', 'swing', 'dig', 'hit']);
  assert.equal(f.state.mining.progress, Math.fround(f.survival.mining(DIRT, 0, false, true).progress));
});

test('real Survival progress accumulates as float32, swings before periodic sound, then breaks and starts cooldown', () => {
  const f = fixture({ mining: { block: [...BLOCK], type: DIRT, progress: 0, tool: 0, auto: false }, time: 4 }),
    calls = [], result = f.survival.mining(DIRT, 0).progress;
  let expected = 0;
  for (let i = 0; i < 30 && f.state.mining; i++) {
    f.survival.time = 4 + i;
    tickPlayerMining(f.state, {
      getBlock: f.getBlock,
      swing: () => calls.push(`swing:${i}`),
      digSound: () => calls.push(`sound:${i}`),
      breakBlock: (p) => { calls.push(`break:${p.join(',')}`); f.setBlock(p, 0); },
      hitParticles: () => calls.push(`hit:${i}`),
    });
    expected = Math.fround(expected + result);
    if (expected >= 1) break;
    assert.equal(f.state.mining.progress, expected);
  }
  assert.equal(f.state.mining, null);
  assert.equal(f.state.cooldown, 5);
  assert.equal(f.getBlock(...BLOCK), 0);
  assert.equal(calls[0], 'swing:0');
  assert.equal(calls[1], 'sound:0');
  assert.equal(calls.at(-1), `break:${BLOCK.join(',')}`, 'post-progress hit particles see the broken cell as air');
  assert.equal(calls.filter((v) => v.startsWith('break:')).length, 1);
});

test('automatic mining keeps progressing after release, while ordinary held mining cancels', () => {
  const auto = fixture({ mineHeld: false, mining: { block: [...BLOCK], type: DIRT, progress: 0, tool: 0, auto: true } });
  tickPlayerMining(auto.state, { getBlock: auto.getBlock });
  assert.ok(auto.state.mining.progress > 0);

  const held = fixture({ mineHeld: false, mining: { block: [...BLOCK], type: DIRT, progress: 0, tool: 0, auto: false } });
  tickPlayerMining(held.state, { getBlock: held.getBlock });
  assert.equal(held.state.mining, null);
});

test('target, live block, and held-tool changes invalidate the mining state', () => {
  const cases = [
    fixture({ target: null, mining: { block: [...BLOCK], type: DIRT, progress: 0, tool: 0, auto: true } }),
    fixture({ target: { block: [5, 12, 7] }, mining: { block: [...BLOCK], type: DIRT, progress: 0, tool: 0, auto: true } }),
    fixture({ block: STONE, mining: { block: [...BLOCK], type: DIRT, progress: 0, tool: 0, auto: true } }),
    fixture({ held: 108, mining: { block: [...BLOCK], type: DIRT, progress: 0, tool: 0, auto: true } }),
  ];
  for (const f of cases) {
    tickPlayerMining(f.state, { getBlock: f.getBlock });
    assert.equal(f.state.mining, null);
  }
});

test('instant edit can remove the block and set cooldown before the later hit-particle query', () => {
  const f = fixture({ mining: null }), calls = [];
  tickPlayerMining(f.state, {
    getBlock: f.getBlock,
    edit: (_place, state) => {
      calls.push('edit');
      f.setBlock(BLOCK, 0);
      state.cooldown = 5;
      return { mining: state.mining, cooldown: state.cooldown };
    },
    hitParticles: () => calls.push('hit'),
  });
  assert.deepEqual(calls, ['edit']);
  assert.equal(f.state.cooldown, 5);
  assert.equal(f.state.mining, null);

  tickPlayerMining(f.state, { getBlock: f.getBlock, hitParticles: () => calls.push('hit') });
  assert.equal(f.state.cooldown, 4);
  assert.deepEqual(calls, ['edit']);
});

test('edit(false) can synchronously break a real zero-hardness block without starting progress', () => {
  const f = fixture({ block: 37, mining: null }), calls = [];
  tickPlayerMining(f.state, {
    getBlock: f.getBlock,
    edit: (_place, state) => {
      calls.push('edit');
      if (f.survival.mining(37, state.heldTool).progress >= 1) f.setBlock(BLOCK, 0);
      else state.mining = { block: [...BLOCK], type: 37, progress: 0, tool: state.heldTool, auto: false };
      return { mining: state.mining, cooldown: state.cooldown };
    },
    swing: () => calls.push('swing'),
    hitParticles: () => calls.push('hit'),
  });
  assert.deepEqual(calls, ['edit']);
  assert.equal(f.getBlock(...BLOCK), 0);
  assert.equal(f.state.mining, null);
  assert.equal(f.state.cooldown, 0, 'the existing Survival instant-break path does not add a hit delay');
});

test('hit face follows the live click-face axis precedence', () => {
  const f = fixture({ cooldown: 1, adjacent: undefined });
  const result = [];
  f.state.target = { block: [...BLOCK], adjacent: [BLOCK[0] - 1, BLOCK[1] + 1, BLOCK[2] - 1] };
  tickPlayerMining(f.state, { getBlock: f.getBlock, hitParticles: (_x, _y, _z, side) => result.push(side) });
  assert.deepEqual(result, [1], 'Y has priority over Z then X');
});
