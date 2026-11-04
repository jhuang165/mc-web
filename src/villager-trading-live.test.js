import test from "node:test";
import assert from "node:assert/strict";
import reference from "../public/research/villager-trading-live-reference.json" with { type: "json" };
import { JavaRandom } from "./java-random.js";
import { PlayerInventory, makeStack } from "./inventory.js";
import { MerchantContainer } from "./merchant-ui.js";
import { villagerFields, villagerInteract, villagerClearCustomer, villagerOffers, villagerUseRecipe, villagerHover, tickVillagerRestock } from "./villager.js";

// Replays scripted trading sessions measured on the unchanged EntityVillager (yv), ContainerMerchant (aat),
// InventoryMerchant (aas), SlotMerchantResult (aau) and MerchantRecipe(List) (agn, ago); see
// tools/probes/VillagerTradeLiveProbe.java. The probe's stacks carry original ids, so the container's item
// mapping is the identity here (the browser mapping is covered in merchant-ui.test.js).
const items = new Proxy({}, { get: (_t, id) => ({ id: +id, stack: reference.stackLimits[id] ?? 64 }) });
const live = (s) => (s ? makeStack(s.id, s.count, s.damage ?? 0, undefined, { ...(s.enchantments?.length ? { enchantments: s.enchantments } : {}), ...(s.storedEnchantments?.length ? { storedEnchantments: s.storedEnchantments } : {}) }) : null);
const convert = { id: (s) => s.id, live };
const row = (s) => (s ? [s.id, s.count, s.damage ?? 0] : null);
const sortOffers = (offers) => {
  if (!offers) return offers;
  const copy = structuredClone(offers);
  for (const r of copy) for (const s of [r.buy, r.buyB, r.sell]) s?.enchantments?.sort((a, b) => a.id - b.id);
  return copy;
};

function session({ profession, seed, shuffleSeed, age = 0, egg = false }) {
  const m = {
    e: { ...villagerFields(profession), health: 20, growingAge: age, livingSoundTime: 0, x: 0, y: 0, z: 0, effects: [] },
    rand: new JavaRandom(BigInt(seed)),
    shuffleRandom: new JavaRandom(BigInt(shuffleSeed)),
    ai: { ew: { events: [] } },
  };
  const inv = new PlayerInventory(items);
  const s = { m, inv, container: null, drops: [] };
  s.merchant = { offers: () => villagerOffers(m), useRecipe: (r) => villagerUseRecipe(m, r), hover: (has) => villagerHover(m, has), close: () => villagerClearCustomer(m.e) };
  s.interact = () => {
    const opened = villagerInteract(m, egg);
    if (opened) {
      s.container = new MerchantContainer(inv, s.merchant, { convert });
      villagerOffers(m); // EntityPlayerMP.displayGUIMerchant sends getRecipes(player) after opening
    }
    return opened;
  };
  return s;
}

function snapshot(s) {
  const { m, container } = s, e = m.e;
  const sounds = m.ai.ew.events.splice(0).map((x) => `${x.sound}|${x.volume}|${x.pitch}`);
  const drops = container ? container.drops.splice(0).map(row) : [];
  const regen = e.effects.find((x) => x.id === 10);
  return {
    slots: container ? container.slots.map((slot) => row(slot.stack)) : Array(39).fill(null),
    cursor: row(s.inv.cursor),
    drops,
    sounds,
    offers: sortOffers(e.offers),
    timeUntilReset: e.timeUntilReset,
    needsInit: e.needsInit,
    riches: e.riches,
    livingSoundTime: e.livingSoundTime,
    customer: !!e.customer,
    regen: regen ? regen.duration : null,
    health: e.health,
  };
}
// Java prints the sound as name|volume|pitch with the pitch as a shortest float; compare through float32.
const normalSounds = (list) => list.map((x) => { const [name, vol, pitch] = x.split("|"); return [name, +vol, Math.fround(+pitch)]; });
const same = (actual, expected, label) => {
  const { sounds: a, ...restA } = actual, { sounds: b, ...restB } = expected;
  assert.deepEqual(restA, restB, label);
  assert.deepEqual(normalSounds(a), normalSounds(b), `${label} sounds`);
};

function apply(s, op) {
  const c = s.container;
  switch (op.op) {
    case "interact": return { result: s.interact() };
    case "select": c.select(op.index); break;
    case "put": c.slots[op.slot].put(makeStack(op.id, op.count, op.damage)); break;
    case "click": c.click(op.slot, op.button, op.mode); break;
    case "close": c.close(); break;
    case "tick": for (let i = 0; i < op.count; i++) tickVillagerRestock(s.m); break;
    default: throw new Error(op.op);
  }
  return {};
}

test("interact refusals match EntityVillager.interact (adult opens; child, trading and spawn egg do not)", () => {
  assert.equal(reference.refusals.length, 4);
  for (const r of reference.refusals) {
    const s = session({ profession: r.profession, seed: r.seed, shuffleSeed: r.shuffleSeed, age: r.age, egg: r.egg });
    if (r.alreadyTrading) s.m.e.customer = true;
    const [step] = r.steps, { result } = apply(s, step.step);
    // The spawn-egg case falls through to EntityAgeable.interact, which spawns a baby villager and returns
    // true; that path is not part of trading, so only the customer flag is compared there.
    if (!r.egg) assert.equal(result, step.step.result, r.label);
    same(snapshot(s), step.state, r.label);
  }
});

test("trading sessions replay the native merchant container, useRecipe and restock", () => {
  assert.equal(reference.trading.length, 60);
  assert.deepEqual([...new Set(reference.trading.map((c) => c.profession))].sort(), [0, 1, 2, 3, 4]);
  let steps = 0;
  for (const c of reference.trading) {
    const s = session(c);
    c.steps.forEach((step, i) => {
      const { result } = apply(s, step.step);
      if (step.step.op === "interact") assert.equal(result, step.step.result);
      same(snapshot(s), step.state, `profession ${c.profession} seed ${c.seed} step ${i} ${JSON.stringify(step.step)}`);
      steps++;
    });
    assert.equal(s.m.rand.nextInt(), c.nextEntityInt, `profession ${c.profession} seed ${c.seed} entity Random continuation`);
    assert.equal(s.m.shuffleRandom.nextInt(), c.nextShuffleInt, `profession ${c.profession} seed ${c.seed} shuffle Random continuation`);
  }
  assert.ok(steps > 10000);
});

test("the sessions cover trades, swapped payment, short payment, restock growth and regeneration", () => {
  const all = reference.trading.flatMap((c) => c.steps);
  assert.ok(all.some((s) => s.step.op === "click" && s.state.sounds.some((x) => x.startsWith("mob.villager.yes"))));
  assert.ok(all.some((s) => s.state.timeUntilReset > 0 && s.state.needsInit));
  assert.ok(all.some((s) => s.state.riches > 0));
  assert.ok(all.some((s) => s.state.regen !== null));
  assert.ok(all.some((s) => s.step.op === "close" && s.state.drops.length > 0));
});
