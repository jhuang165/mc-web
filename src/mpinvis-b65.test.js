// Batch 65 mpinvis: other players' invisibility and name tags on a connection. Bytecode-read (javap on the 1.7.10 jar): RendererLivingEntity boh.a (renderModel: invisible
// -> nothing unless !isInvisibleToPlayer, then glColor4f(1,1,1,0.15), depthMask off, blend 770/771), boh.b (func_110813_b, passSpecialRender), Render bno.a (func_147906_a),
// RenderPlayer bop.a (belowName, distance squared < 100), EntityPlayer yz.d (isInvisibleToPlayer), Entity sa.d, FontRenderer bbu.b (unshadowed drawString).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { createClientScoreboard, applyScoreboardMessage } from './multiplayer/client-scoreboard.js';
import { invisibleToViewer, tagPlan, tagHeights, paintTagRow, TAG_ROW } from './multiplayer/remote-labels.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const input = () => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });

function server() {
  const world = new World('mp-invis-b65');
  for (let x = 20; x <= 110; x++) for (let z = 58; z <= 70; z++) for (let y = 9; y <= 40; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const sim = new DedicatedSimulation({}, { world, gameMode: 'survival' }), players = [];
  ['Alice', 'Bob'].forEach((n, i) => { const p = sim.addPlayer('p' + i, n, key(i + 1)); p.position.copy({ x: 64.5 + i, y: 10, z: 64.5 }); sim.input('p' + i, input()); players.push(p); });
  for (let i = 0; i < 3; i++) sim.tick();
  return { sim, players };
}

function board(teamOpts = {}, withBelow = false) {
  const b = createClientScoreboard();
  applyScoreboardMessage(b, { type: 'sb', packets: [{ k: 'team', name: 'red', mode: 0, display: 'red', prefix: '', suffix: '', flags: teamOpts.flags ?? 0, players: ['Alice', 'Bob'] }, ...(withBelow ? [{ k: 'obj', name: 'hp', display: 'Hearts', mode: 0 }, { k: 'display', slot: 2, name: 'hp' }] : [])] });
  return b;
}

test('the presence list carries the invisible flag (entity flag 0 bit 5) only while Invisibility is active', () => {
  const { sim, players } = server();
  assert.equal(sim.presence().find(p => p.id === 'p1').invisible, undefined);
  players[1].survival.effects.add({ id: 14, duration: 600, amplifier: 0 });
  const list = sim.presence();
  assert.equal(list.find(p => p.id === 'p1').invisible, true);
  assert.equal(list.find(p => p.id === 'p0').invisible, undefined);
  players[1].survival.effects.remove(14);
  assert.equal(sim.presence().find(p => p.id === 'p1').invisible, undefined);
});

test('isInvisibleToPlayer: only a same-team viewer with seeFriendlyInvisibles sees an invisible player', () => {
  assert.equal(invisibleToViewer(false, 'Bob', 'Alice', null), false);
  assert.equal(invisibleToViewer(true, 'Bob', 'Alice', null), true); // no board / no team
  assert.equal(invisibleToViewer(true, 'Bob', 'Alice', board({ flags: 0 })), true); // same team, flag off
  assert.equal(invisibleToViewer(true, 'Bob', 'Alice', board({ flags: 2 })), false); // flags bit 1 = seeFriendlyInvisibles
  assert.equal(invisibleToViewer(true, 'Bob', 'Carol', board({ flags: 2 })), true); // the viewer is on no team
});

test('name tag: hidden for an invisible player, drawn (with the ghost body) for a teammate who may see it', () => {
  const plain = tagPlan({ invisible: true, name: 'Bob', viewerName: 'Alice', board: board({ flags: 0 }) });
  assert.equal(plain.show, false);
  assert.equal(tagPlan({ invisible: true, name: 'Bob', viewerName: 'Alice', board: board({ flags: 2 }) }).show, true);
  assert.equal(tagPlan({ invisible: false, name: 'Bob', viewerName: 'Alice' }).show, true);
  assert.equal(tagPlan({ name: 'Bob', riddenBy: true }).show, false); // func_110813_b: riddenByEntity == null
});

test('name tag range: 64 blocks, 32 when sneaking; the belowName row only under 10 blocks', () => {
  assert.equal(tagPlan({ distSq: 64 * 64 }).show, true);
  assert.equal(tagPlan({ distSq: 64 * 64 + 1 }).show, false);
  assert.equal(tagPlan({ distSq: 32 * 32, sneak: true }).show, true);
  assert.equal(tagPlan({ distSq: 32 * 32 + 1, sneak: true }).show, false);
  const b = board({}, true);
  assert.equal(tagPlan({ distSq: 99.9, board: b }).below, true);
  assert.equal(tagPlan({ distSq: 100, board: b }).below, false); // bop.a: dcmpg ... < 100.0
  assert.equal(tagPlan({ distSq: 4, board: board() }).below, false); // no objective in slot 2
  assert.equal(tagPlan({ distSq: 4, board: b, invisible: true, name: 'Bob', viewerName: 'Alice' }).below, false); // the score is part of the hidden tag
});

test('sneaking: depth-tested dim name, 0.125 + 0.25 lower; the score row keeps the standing spot below the name', () => {
  assert.equal(tagPlan({ sneak: true }).sneakStyle, true);
  assert.equal(tagPlan({}).sneakStyle, false);
  const stand = tagHeights({ sneak: false, below: false }), sneak = tagHeights({ sneak: true, below: false });
  assert.equal(stand.name, 2.2);
  assert.ok(Math.abs(stand.name - sneak.name - 0.375) < 1e-9);
  const both = tagHeights({ sneak: false, below: true });
  assert.equal(both.score, 2.2);
  assert.ok(Math.abs(both.name - 2.2 - TAG_ROW) < 1e-9); // the name is lifted one row (boh: fontHeight * 1.15 * scale)
});

test('tag rows paint like the native passes: dim = background 0.25 + alpha 0x20 text; bright = text only, no shadow', () => {
  const calls = [];
  const ctx = { clearRect: () => {}, measureText: t => ({ width: t.length * 10 }), fillRect: (...a) => calls.push(['rect', ctx.fillStyle, ...a]), fillText: (t, x) => calls.push(['text', t, ctx.globalAlpha, ctx.fillStyle, x]), set font(v) {}, set textAlign(v) {} };
  const canvas = { getContext: () => ctx };
  paintTagRow(canvas, 'Bob', 'dim');
  assert.deepEqual(calls[0], ['rect', 'rgba(0,0,0,.25)', 128 - 15 - 3, 0, 36, 40]);
  assert.equal(calls[1][0], 'text'); assert.ok(Math.abs(calls[1][2] - 32 / 255) < 1e-9);
  calls.length = 0;
  paintTagRow(canvas, '§cBob', 'bright');
  assert.equal(calls.filter(c => c[0] === 'rect').length, 0);
  assert.deepEqual(calls.map(c => [c[1], c[2], c[3]]), [['Bob', 1, '#ff5555']]);
});

test('the player body shader takes a fade factor on its alpha (the native 0.15 colour alpha)', async () => {
  const { entityMaterial } = await import('./light-material.js');
  const m = entityMaterial({ uniforms: { lightmap: { value: null } } }, {});
  const f = m.fragmentShader.replace('uniform float alphaTest;', 'uniform float alphaTest;uniform float fade;').replace('applyFog(c),1.)', 'applyFog(c),fade)');
  assert.ok(f.includes('uniform float fade;') && f.includes('applyFog(c),fade)')); // the two replacements player-renderer.js makes still match the entity shader text
});
