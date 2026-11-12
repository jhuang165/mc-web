import test from "node:test";
import assert from "node:assert/strict";
import { entityListReference, replayEntityList, entityListDivergence } from "./entity-list-replay.js";

// public/research/entity-list-reference.json (tools/probes/EntityListProbe.java): the unchanged EntityItem, EntityXPOrb, EntityTNTPrimed, EntityArrow,
// EntityMinecartEmpty, EntityBoat, EntityPainting, EntityPotion, EntitySnowball and EntityWitherSkull (and a cow riding a cart) walked in
// World.loadedEntityList order (index loop, a rider updated right after its mount, spawned-in-pass joins the end, dead removed after), each scenario in both
// list orders.
// arrow-cow: needs a cow whose AI task list is off (the probe's Cow); the record shows the order effect, the port has no such double.
// cart-cow-mount-ba (batch 47: replayed): the cow listed before the cart is taken aboard in its own update and then, natively, updated a second time in the same pass right after
// its mount (World.updateEntities updates a rider after its vehicle), and the cart is still stopped by the cow's box where it stood (the world's collision list has no rider test).
const NOT_REPLAYED = /^(arrow-cow)/;
for (const c of entityListReference.filter((r) => !NOT_REPLAYED.test(r.name))) {
  test(`native entity list ${c.name}`, () => {
    assert.equal(entityListDivergence(c, replayEntityList(c)), null);
  });
}

const by = (n) => entityListReference.find((r) => r.name === n);
const last = (r) => r.rows[r.ticks - 1][0];
// the record row of the entity made from the spec of this kind at x (the rows list entities in creation order, which differs between a pair's two orders)
const entityIndex = (r, kind, x) => r.specs.filter((q) => q[0] !== "set" && q[0] !== "wall").findIndex((q) => q[0] === kind && q[1] === x);
const row = (r, t, kind, x) => r.rows[t][0][entityIndex(r, kind, x)];
const differs = (a, b, kind, x) => a.rows.some((_, t) => JSON.stringify(row(a, t, kind, x)) !== JSON.stringify(row(b, t, kind, x)));

test("the records show the list order: the same entities end differently when listed the other way round", () => {
  assert.equal(entityListReference.length, 93);
  // two equal stacks: the first to update merges into the other, so the list order picks the survivor
  const dead = (r) => last(r).map((e) => e[6]);
  assert.deepEqual(dead(by("items-equal-ab")), [1, 0]);
  assert.deepEqual(dead(by("items-equal-ba")), [1, 0]);
  assert.notDeepEqual(last(by("items-equal-ab"))[1].slice(0, 3), last(by("items-equal-ba"))[0].slice(0, 3));
  // a joined-late item updates after the earlier one whatever the order it was made in
  assert.notDeepEqual(last(by("items-join-late")), last(by("items-join-early")));
  // orbs: the player takes the first orb of the list (7 or 3), the second one two ticks later
  assert.equal(by("orbs-pickup-ab").rows[0][2][0], 7);
  assert.equal(by("orbs-pickup-ba").rows[0][2][0], 3);
  assert.equal(by("orbs-pickup-join").rows[0][2][0], 3); // the 7 joins on tick 1, after the 3
  // the blast pushes a TNT updated after it this tick, one updated before it a tick later; an item likewise
  const tntB = (r) => r.rows[0][0].find((e) => e.length === 8 && e[7] !== -1);
  assert.notEqual(tntB(by("tnt-push-ab"))[0], tntB(by("tnt-push-ba"))[0]);
  assert.notEqual(by("tnt-item-ab").rows[0][0][1][1], by("tnt-item-ba").rows[0][0][0][1]);
  assert.equal(by("tnt-item-ab").rows[0][0][1][6], 1); // blasted dead before its own update
  assert.equal(by("tnt-item-ba").rows[0][0][0][6], 1); // updated first (it moved: its posY differs from the ab record), then killed by the blast
  // the arrow and the cow: the order changes where the cow ends (replayed by neither engine here; the record shows the effect)
  assert.notEqual(last(by("arrow-cow-first"))[1][0], last(by("arrow-cow-after"))[0][0]);
});

test("the batch 44 records show the list order for vehicles, thrown entities and skulls", () => {
  // two carts meet: the one that updates first pushes the other, so the first cart ends elsewhere
  assert.ok(differs(by("carts-collide-ab"), by("carts-collide-ba"), "cart", 0.5));
  // a boat and a cart: the boat is blocked by the cart's box and the cart by the boat's, so who moves first decides how far each gets
  assert.ok(differs(by("boat-cart-ab"), by("boat-cart-ba"), "boat", 0.5));
  assert.ok(differs(by("boat-cart-ab"), by("boat-cart-ba"), "cart", 2.2));
  // the potion lands (hits the cart, harms the rider cow by distance) before or after the cart moves
  assert.ok(differs(by("potion-cart-ab"), by("potion-cart-ba"), "potion", 1.8));
  assert.ok(differs(by("potion-cart-ab"), by("potion-cart-ba"), "cow", 0.5));
  // the snowball flies into the cart before or after it moves away
  assert.ok(differs(by("snowball-cart-ab"), by("snowball-cart-ba"), "snowball", 2.6));
  // the skull's blast (run in its own update) pushes an item updated before it a tick later than one updated after it: the items' ages differ
  const aged = (r) => row(r, 6, "item", 1.5)[8];
  assert.notEqual(aged(by("skull-item-ab")), aged(by("skull-item-ba")));
  assert.deepEqual(by("skull-item-ab").rows[6][1], by("skull-item-ba").rows[6][1]); // the same blast
  assert.equal(by("skull-item-ab").rows[6][1].length, 1);
});

test("a rider updates right after its mount, whichever way round the two are listed", () => {
  const a = by("cart-rider-cart-first"), b = by("cart-rider-cow-first");
  for (let t = 0; t < a.ticks; t++) {
    assert.deepEqual(row(a, t, "cart", 0.5), row(b, t, "cart", 0.5));
    assert.deepEqual(row(a, t, "cow", 0.5), row(b, t, "cow", 0.5));
  }
  // the rider is carried: it stands where the cart does, 0.3 below it
  const cart = row(a, 3, "cart", 0.5), cow = row(a, 3, "cow", 0.5);
  assert.equal(cow[0], cart[0]);
  assert.ok(cart[1] - cow[1] > 0.29 && cart[1] - cow[1] < 0.31);
});

test("a painting that lost its wall breaks at its 100th update and its item joins the end of the list in that pass", () => {
  for (const n of ["painting-wall-first", "painting-wall-last"]) {
    const r = by(n);
    assert.equal(row(r, 1, "painting", 0)[6], 0);
    assert.equal(row(r, 2, "painting", 0)[6], 1); // counter preset to 98: updates 0 and 1 count, the third checks the surface
    assert.equal(r.rows[1][3].length, 0);
    assert.equal(r.rows[2][3].length, 1); // the painting item, spawned in tick 2
    assert.equal(r.rows[2][3][0][8], 1); // and already updated once in that pass (age 1)
    assert.equal(r.rows[2][3][0][9], 9); // pickup delay 10, counted once
  }
});

test("the records need the stamps: without them TNT and items tick in kind groups and the mixed records diverge", async () => {
  const { EntityWorld } = await import("./entities.js");
  const real = EntityWorld.prototype.joined;
  EntityWorld.prototype.joined = function () {};
  try {
    assert.notEqual(entityListDivergence(by("tnt-item-ab"), replayEntityList(by("tnt-item-ab"))), null);
    assert.equal(entityListDivergence(by("tnt-item-ba"), replayEntityList(by("tnt-item-ba"))), null); // items before TNT is also the kind-group order
    // the batch 44 kinds likewise: with no stamps a cart, boat, potion, snowball, skull or painting is walked in a kind group, not where it was listed
    for (const n of ["potion-cart-ba", "snowball-cart-ba", "boat-cart-ab", "boat-cart-ba", "painting-wall-first", "skull-item-ba"]) assert.notEqual(entityListDivergence(by(n), replayEntityList(by(n))), null, n);
  } finally { EntityWorld.prototype.joined = real; }
});

test("an entity spawned during the pass (an item a blast drops) joins the end of the list and updates in that same pass", () => {
  let spawned = null;
  replayEntityList({ ...by("tnt-push-ab"), ticks: 1 }, (items) => { spawned = items.spawn({ id: 3, count: 1, damage: 0 }, 5.5, 0.5, 0.5, { motion: [0, 0, 0] }); });
  assert.equal(spawned.ticks, 1); // ticked once already in the tick that spawned it
});

test("dead entities leave the lists after the pass", () => {
  const c = by("items-equal-ab");
  replayEntityList({ ...c, ticks: 2 }, null);
  // the merged stack: one survivor in the record, and the replay's lists hold only live entities (the divergence check compares the dead one's frozen state)
  assert.equal(last(c).filter((e) => !e[6]).length, 1);
});

// Batch 45
test("a blast pushes and damages carts and boats, and pushes potions and snowballs in flight (Explosion.doExplosionA takes every entity)", () => {
  // a cart or boat 2 blocks from a power 4 TNT takes 53 damage (10 per point, above 40) and breaks, with the knockback still added to its motion; its drop joins the list
  for (const n of ["boom-cart-near-ab", "boom-cart-near-ba", "boom-boat-near-ab", "boom-boat-near-ba"]) {
    const r = by(n);
    assert.equal(last(r)[n.includes("-ab") ? 1 : 0][6], 1, n + " breaks");
    assert.ok(Math.abs(row(r, 0, n.includes("cart") ? "cart" : "boat", 2.5)[3]) > 0.5, n + " is pushed");
    assert.ok(r.rows[0][3].length >= 1, n + " drops its item");
  }
  // 7.8 blocks away the damage is 4 (40 is not above 40): it only wobbles and is pushed
  assert.equal(by("boom-cart-far-ab").rows[0][0][1][6], 0);
  assert.ok(by("boom-boat-far-ab").rows[0][0][1][8] > 0);
  // a ball in flight is pushed whichever way round it and the TNT are listed; listed after, its own update already moved it this tick
  for (const k of ["potion", "snowball"]) assert.ok(differs(by(`boom-${k}-ab`), by(`boom-${k}-ba`), k, 3.5));
  for (const n of ["boom-cart-near-ab", "boom-boat-near-ab", "boom-potion-ab", "boom-snowball-ab"]) {
    assert.notEqual(entityListDivergence(by(n), replayEntityList(by(n), null, "blast")), null, n + " needs the blast to reach the entity");
  }
});

test("a snowball breaks a painting, a potion shatters on it and leaves it standing (EntityThrowable's ray takes every collidable entity)", () => {
  const sb = by("snowball-painting"), po = by("potion-painting");
  assert.equal(last(sb)[0][6], 1, "the painting is dead"); assert.equal(last(sb)[1][6], 1, "the snowball is dead");
  assert.equal(last(po)[0][6], 0, "the painting stands"); assert.equal(last(po)[1][6], 1, "the potion is dead");
  assert.equal(sb.rows[5][3].length, 1, "the painting item joins the end of the list on the hit tick");
  assert.equal(po.rows[7][3].length, 0);
});

test("a cart or boat pushes a mob inside the mob's own update, so the list order changes what the mob and the vehicle do", () => {
  for (const [a, b, kind, x] of [["cart-cow-ab", "cart-cow-ba", "cart", 0.55], ["boat-cow-ab", "boat-cow-ba", "boat", 0.55], ["cart-rider-push-ab", "cart-rider-push-ba", "cow", 0.5]]) {
    assert.ok(differs(by(a), by(b), kind, x), a);
    assert.notEqual(entityListDivergence(by(a), replayEntityList(by(a), null, "mobPush")), null, a + " needs the push in the walk");
  }
});

// Batch 46: balls the player threw (the probe's thrower is an EntityPlayerSP shell; b = Creative). Cart rows end [.., yaw, pitch, damage, rollingAmplitude, rollingDirection],
// boat rows [.., yaw, timeSinceHit, damage]; the ball is the second entity.
test("a snowball, egg or pearl the player throws wobbles a cart or boat without damage; a Creative thrower breaks it; a potion leaves the cart alone", () => {
  const cart = (n) => last(by(n))[0], boat = (n) => last(by(n))[0];
  for (const n of ["pthrow-snowball-cart", "pthrow-egg-cart", "pthrow-pearl-cart"]) { assert.equal(cart(n)[6], 0, n); assert.equal(cart(n)[9], 0, n + " damage 0"); assert.equal(cart(n)[11], -1, n + " rolling direction flips"); assert.ok(cart(n)[10] > 0, n + " rolling"); assert.equal(last(by(n))[1][6], 1, n + " ball dead"); }
  assert.equal(cart("pthrow-snowball-cart-creative")[6], 1, "a Creative thrower breaks the cart"); assert.equal(by("pthrow-snowball-cart-creative").rows[5][3].length, 0, "and no item drops");
  assert.equal(boat("pthrow-snowball-boat")[6], 0); assert.equal(boat("pthrow-snowball-boat")[9], 0); assert.ok(boat("pthrow-snowball-boat")[8] > 0, "the boat's hit timer runs");
  assert.equal(boat("pthrow-snowball-boat-creative")[6], 1); assert.equal(boat("pthrow-pearl-boat-creative")[6], 1);
  assert.equal(cart("pthrow-potion-cart")[10], 0, "a splash potion does not touch the cart"); assert.equal(last(by("pthrow-potion-cart"))[1][6], 1, "but it shatters on it");
  for (const n of ["pthrow-snowball-cart", "pthrow-egg-cart", "pthrow-pearl-cart", "pthrow-snowball-boat", "pthrow-snowball-boat-creative", "pthrow-pearl-boat-creative", "pthrow-snowball-cart-creative"]) assert.notEqual(entityListDivergence(by(n), replayEntityList(by(n), null, "throwTargets")), null, n + " needs the carts and boats among the targets");
});

test("an egg or pearl the player throws breaks a painting like a snowball; a Creative thrower's hit drops nothing", () => {
  for (const n of ["pthrow-snowball-painting", "pthrow-egg-painting", "pthrow-pearl-painting"]) { assert.equal(last(by(n))[0][6], 1, n); assert.equal(by(n).rows[5][3].length, 1, n + " the painting item joins the list on the hit tick"); }
  for (const n of ["pthrow-snowball-painting-creative", "pthrow-pearl-painting-creative"]) { assert.equal(last(by(n))[0][6], 1, n); assert.equal(by(n).rows[7][3].length, 0, n + " no drop"); }
  assert.equal(last(by("pthrow-potion-painting"))[0][6], 0, "a potion leaves the painting standing");
});

// Batch 47: a player's egg hatches (Entity.rand seeds 4096: one chick, 4104: four, 7: none) and an experience bottle's orbs on a cart, boat or painting hit (executed, EntityListProbe).
test("batch 47: the egg's hatch roll and the bottle's orbs on a vehicle or painting hit", () => {
  const spawned = (n) => by(n).rows[by(n).ticks - 1][3].length;
  assert.equal(spawned("pthrow-egg-cart"), 0, "seed 7: nextInt(8) is not 0, no chick");
  assert.equal(spawned("pthrow-egg-cart-hatch"), 1);
  assert.equal(spawned("pthrow-egg-cart-hatch4"), 4, "nextInt(32) == 0: four chicks");
  for (const n of ["pthrow-egg-boat-hatch", "pthrow-egg-cart-creative-hatch"]) assert.equal(spawned(n), 1, n);
  assert.equal(spawned("pthrow-egg-painting-hatch"), 2, "the chick and the broken painting's item");
  for (const n of ["pthrow-expbottle-cart", "pthrow-expbottle-boat", "pthrow-expbottle-painting"]) assert.equal(spawned(n), 2, `${n}: World.rand Random(2) gives 8 xp: orbs of 7 and 1`);
  // the chick and the orbs update in the pass they joined (World.spawnEntityInWorld appends to the list being walked): the first row already has moved them
  const chick = by("pthrow-egg-cart-hatch").rows[3][3][0], orb = by("pthrow-expbottle-cart").rows[3][3][0];
  assert.ok(chick[4] < 0, "the chick has fallen once in its first pass");
  assert.ok(orb[4] < 0.2, "the orb has had one update (gravity on its 0.2 upward motion)");
});

// Batch 47: a pearl thrown by a real EntityPlayerMP subclass (executed: the connection answers isChannelOpen, mw.setPositionAndUpdate and nh.setPlayerLocation run unchanged, the 5.0F fall hit is counted).
test("batch 47: a player's pearl that hits a cart, boat or painting still teleports its owner to the impact point and costs 5 fall damage", () => {
  for (const n of ["pthrow-pearl-mp-cart", "pthrow-pearl-mp-boat", "pthrow-pearl-mp-painting"]) {
    const r = by(n), p = r.rows[r.ticks - 1][0].at(-1);
    assert.equal(p[6], 1, `${n}: the pearl is gone`);
    assert.equal(p[10], 5, `${n}: 5.0 fall damage once`);
    assert.ok(p[7] !== 0 || p[8] !== 0, `${n}: the owner left the origin`);
  }
});
