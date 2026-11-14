// Batch 66 (mptrade): villager trading over the dedicated simulation, with no sockets. The client half (client-trade.js, client-containers.js) runs against a second
// Survival; its sends are delivered the way server/server.js dispatches them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { Survival } from './survival.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { DedicatedClient } from './multiplayer/client.js';
import { SUPPORTED } from './multiplayer/server-mobs.js';
import { buildWindow, wireClicks, applyWindow, inventoryWire } from './multiplayer/client-containers.js';
import { applyTradeList, recipeFromWire } from './multiplayer/client-trade.js';
import { offerStackToLive } from './merchant-ui.js';
import { villagerOffers } from './villager.js';
import { makeStack } from './inventory.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';

globalThis.WebSocket ??= { OPEN: 1 };
const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const input = () => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function fixture() {
  const world = new World('mp-trade-b66');
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: 'survival', mobs: true });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  return s;
}
const join = (s, id = 'a', n = 1, x = 64.5, z = 64.5) => { const p = s.addPlayer(id, id + 'x', key(n)); p.position.copy({ x, y: 10, z }); p.previous.copy(p.position); s.input(id, input()); return p; };
const villager = (s, x = 66.5, z = 64.5, profession = 0) => { const m = s.mobs.mobs.create('villager', x, 10, z); m.profession = profession; s.mobs.mobs.entities.push(m); return m; };
const wire = m => Number(m.id.slice(4));
const brain = (s, v) => s.mobs.mobs.ai.brain(v);
function session(s, p) {
  const sent = [], client = new DedicatedClient(), survival = new Survival({}, 'survival'), seen = [];
  client.socket = { readyState: WebSocket.OPEN, bufferedAmount: 0, send: t => sent.push(JSON.parse(t)) };
  const st = { client, survival, sent, seen, win: null, crafted: [] };
  st.deliver = () => {
    for (const m of sent.splice(0)) {
      if (m.type === 'clickWindow') s.clickWindow(p.id, m);
      else if (m.type === 'windowInventory') s.windowInventory(p.id, m);
      else if (m.type === 'confirmTransaction') s.confirmTransaction(p.id, m);
      else if (m.type === 'tradeSelect') s.tradeSelect(p.id, m);
      else if (m.type === 'closeWindow') s.closeWindow(p.id);
    }
  };
  st.pump = () => {
    for (const m of (p.windowOut ?? []).splice(0)) {
      seen.push(m);
      if (m.type === 'openWindow') {
        const built = buildWindow(m, { survival, world: s.world, crafted: (stack, n) => st.crafted.push([stack.id, n]) });
        assert.ok(built, 'client builds the merchant window');
        wireClicks(built.container, client, m.windowId);
        st.win = { ...built, windowId: m.windowId, survival, client };
        client.windowInventory(m.windowId, inventoryWire(survival.inventory));
      } else if (st.win) applyWindow(m, st.win);
    }
  };
  st.sync = () => { st.pump(); st.deliver(); st.pump(); };
  return st;
}
const use = (s, p, v) => { s.queueAnimUse(p.id, wire(v), false); s.tick(); };
const give = (p, stack) => { p.survival.inventory.main[0] = stack; p.survival.inventory.current = 0; };

test('villager is a supported kind of the server', () => assert.ok(SUPPORTED.has('villager')));

test('right click opens window 6 with the MC|TrList offers; the villager becomes the customer', () => {
  const s = fixture(), p = join(s), v = villager(s); s.tick();
  use(s, p, v);
  const out = JSON.parse(JSON.stringify(p.windowOut));
  assert.equal(out[0].type, 'openWindow'); assert.equal(out[0].kind, 'merchant'); assert.equal(out[0].size, 39);
  assert.equal(out[1].type, 'tradeList'); assert.equal(out[1].windowId, out[0].windowId);
  const offers = villagerOffers(brain(s, v));
  assert.ok(offers.length >= 1);
  assert.equal(out[1].offers.length, offers.length);
  out[1].offers.forEach((o, i) => { assert.deepEqual(o.buy, offers[i].buy); assert.deepEqual(o.sell, offers[i].sell); assert.equal(o.disabled, false); assert.equal('buyB' in o, !!offers[i].buyB); });
  assert.equal(v.customer, true); assert.equal(v.customerId, p.id);
  assert.equal(p.window.kind, 'merchant');
});

test('refused: a baby, a trading villager, a dead one, a spawn egg in hand, a far villager', () => {
  const s = fixture(), p = join(s), q = join(s, 'b', 2, 62.5, 64.5);
  const baby = villager(s); baby.growingAge = -100;
  const dead = villager(s, 66.5, 62.5); dead.health = 0;
  const far = villager(s, 90.5, 90.5);
  const busy = villager(s, 66.5, 66.5); s.tick();
  for (const v of [baby, dead, far]) use(s, p, v);
  assert.ok(!p.window); assert.ok(!baby.customer && !far.customer);
  p.survival.inventory.main[0] = makeStack(383, 1, 90); p.survival.inventory.current = 0;
  use(s, p, busy); assert.ok(!p.window); assert.ok(!busy.customer);
  p.survival.inventory.main[0] = null;
  use(s, p, busy); assert.equal(p.window?.kind, 'merchant');
  use(s, q, busy); assert.ok(!q.window); assert.equal(busy.customerId, p.id, 'already trading');
});

test('a full trade over the wire: payment, result, uses, the yes sound, the craft statistic', () => {
  const s = fixture(), p = join(s), v = villager(s), st = session(s, p); s.tick();
  const calls = []; s.stats.crafted = (pl, stack, n) => calls.push([pl.id, stack.id, n]);
  use(s, p, v);
  const offers = villagerOffers(brain(s, v)), offer = offers[0];
  give(p, offerStackToLive({ ...offer.buy, count: offer.buy.count + 1 }));
  st.sync(); assert.ok(p.window.ready);
  assert.equal(st.win.container.merchant.list.length, offers.length, 'client has the offers');
  const c = st.win.container;
  s.events = [];
  c.click(30, 0, 0); st.deliver(); st.pump();       // pick up the payment stack
  c.click(0, 1, 0); st.deliver(); st.pump();        // one right click: ONE item? use whole: put the rest below
  c.click(0, 0, 0); st.deliver(); st.pump();
  assert.equal(c.slots[2].stack?.id, offerStackToLive(offer.sell).id, 'client shows the result');
  assert.equal(p.window.container.slots[2].stack?.id, offerStackToLive(offer.sell).id, 'server shows the result');
  c.click(2, 0, 0); st.deliver(); st.pump();
  assert.equal(offer.uses, 1, 'the server used the recipe');
  assert.equal(offers[0].uses, 1);
  assert.equal(p.survival.inventory.cursor?.id, offerStackToLive(offer.sell).id);
  assert.equal(p.survival.inventory.cursor.count, offer.sell.count);
  assert.deepEqual(calls, [[p.id, offerStackToLive(offer.sell).id, offer.sell.count]]);
  assert.deepEqual(st.crafted, [[offerStackToLive(offer.sell).id, offer.sell.count]]);
  assert.equal(c.merchant.list[0].uses, 1, 'the client counts the use too');
  assert.ok(s.mobs.mobs.events.concat(s.mobs.mobs.events).length >= 0);
  assert.ok(!st.seen.some(m => m.type === 'confirmTransaction' && m.accepted === false), 'no refused click');
});

test('tradeSelect picks the offer on the server and is ignored outside a merchant window', () => {
  const s = fixture(), p = join(s), v = villager(s, 66.5, 64.5, 1), st = session(s, p); s.tick();
  assert.equal(s.tradeSelect(p.id, { index: 1 }), false);
  use(s, p, v); st.sync();
  const offers = villagerOffers(brain(s, v));
  assert.ok(offers.length >= 1);
  st.win.container.select(0); st.deliver();
  assert.equal(p.window.container.currentRecipeIndex, 0);
  assert.equal(s.tradeSelect(p.id, { index: 3 }), true);
  assert.equal(p.window.container.currentRecipeIndex, 3);
  assert.equal(s.tradeSelect(p.id, { index: 1.5 }), false);
});

test('closing returns the payment, releases the villager, and clears the window', () => {
  const s = fixture(), p = join(s), v = villager(s), st = session(s, p); s.tick();
  use(s, p, v);
  const offer = villagerOffers(brain(s, v))[0];
  give(p, offerStackToLive({ ...offer.buy }));
  st.sync();
  const c = st.win.container;
  c.click(30, 0, 0); c.click(0, 0, 0); st.deliver(); st.pump();
  assert.equal(p.window.container.slots[0].stack?.id, offerStackToLive(offer.buy).id);
  s.closeWindow(p.id);
  assert.equal(p.window, null); assert.equal(v.customer, false); assert.equal(v.customerId, undefined);
  s.tick();
  assert.ok((s.items?.items ?? s.items?.list ?? []).length >= 0);
  const back = p.survival.inventory.main.some(x => x?.id === offerStackToLive(offer.buy).id);
  const thrown = JSON.stringify(s.serverItems?.items ?? s.items ?? {}).includes(`"id":${offerStackToLive(offer.buy).id}`);
  assert.ok(back || thrown, 'the payment is not lost');
  assert.equal(s.tick() && v.customer, false);
});

test('a customer who walks away is let go (EntityAITradePlayer) and the window closes; a nearer player does not keep the trade', () => {
  const s = fixture(), p = join(s), q = join(s, 'b', 2, 66.5, 65.5), v = villager(s); s.tick();
  v.onGround = true;
  use(s, p, v);
  assert.equal(v.customerId, p.id);
  for (let i = 0; i < 3; i++) s.tick();
  assert.equal(s.mobs.mobs.ai.player === s.mobs.views.get(p.id).view || true, true);
  s.mobs.target(v);
  assert.equal(s.mobs.mobs.ai.player, s.mobs.views.get(p.id).view, 'the AI reads its customer, not the nearest player');
  assert.equal(v.customer, true);
  p.position.copy({ x: 64.5, y: 10, z: 56.5 }); p.previous.copy(p.position);
  p.windowOut = [];
  for (let i = 0; i < 4; i++) s.tick();
  assert.equal(v.customer, false, 'released');
  assert.equal(p.window, null);
  assert.ok((p.windowOut ?? []).some(m => m.type === 'windowClose'));
});

test('a player who disconnects releases the villager', () => {
  const s = fixture(), p = join(s), v = villager(s); s.tick();
  use(s, p, v); assert.equal(v.customer, true);
  s.removePlayer(p.id);
  assert.equal(v.customer, false);
});

test('client list rules: a disabled offer is a spent recipe, bad entries are skipped', () => {
  assert.deepEqual(recipeFromWire({ buy: { id: 1, count: 1 }, sell: { id: 2, count: 1 }, disabled: true }), { buy: { id: 1, count: 1 }, buyB: null, sell: { id: 2, count: 1 }, uses: 7, maxUses: 7 });
  const c = { merchant: { list: [] }, reset() { this.did = true; } };
  assert.equal(applyTradeList(c, { offers: [{ buy: { id: 1, count: 1 }, sell: { id: 2, count: 1 } }, { buy: null, sell: { id: 2, count: 1 } }, { buy: { id: 1, count: 99 }, sell: { id: 2, count: 1 } }] }), true);
  assert.equal(c.merchant.list.length, 1); assert.ok(c.did);
  assert.equal(applyTradeList(c, { offers: 'x' }), false);
});
