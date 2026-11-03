import test from "node:test";
import assert from "node:assert/strict";
import { JavaRandom } from "./java-random.js";
import { attemptDamageItem } from "./enchantments.js";
import { Survival } from "./survival.js";
import { makeStack } from "./inventory.js";

test("live Unbreaking damage replays the native tool and armour random paths", () => {
  for (const [liveId, vanillaId] of [[115, 276], [119, 283], [400, 298], [120,290], [124,294]]) {
    const seed = 8451, state = new JavaRandom(seed).save(), metadata = { enchantments: [{ id: 34, lvl: 2 }] };
    const player = new Survival({ inventoryRandom: state, slots: [makeStack(liveId, 1, 0, undefined, metadata)] });
    const native = { id: vanillaId, count: 1, damage: 0, ...metadata }, expectedRandom = new JavaRandom(seed);
    const broke = attemptDamageItem(native, 1, expectedRandom);
    assert.equal(player.inventory.damage(0), broke, `item ${liveId}`);
    assert.equal(player.inventory.main[0]?.damage ?? 0, native.damage, `item ${liveId}`);
    assert.deepEqual(player.inventory.random.save(), expectedRandom.save(), `item ${liveId} RNG`);
  }
});

test("unenchanted and protected durability do not consume the inventory random stream", () => {
  const player = new Survival({ slots: [makeStack(115), makeStack(115, 1, 0, undefined, { unbreakable: true })] });
  const before = player.inventory.random.save();
  assert.equal(player.inventory.damage(0), false);
  assert.equal(player.inventory.main[0].damage, 1);
  assert.equal(player.inventory.damage(1), false);
  assert.equal(player.inventory.main[1].damage, 0);
  assert.deepEqual(player.inventory.random.save(), before);
  player.inventory.creative = true;
  assert.equal(player.inventory.damage(0), false);
  assert.deepEqual(player.inventory.random.save(), before);
});

test("inventory random state resumes from the player save", () => {
  const metadata = { enchantments: [{ id: 34, lvl: 3 }] };
  const player = new Survival({ slots: [makeStack(103, 1, 0, undefined, metadata)] });
  player.inventory.damage(0);
  const saved = player.serialize(), resumed = new Survival(saved);
  assert.deepEqual(resumed.inventory.random.save(), player.inventory.random.save());
  const direct = new Survival(saved);
  for (let i = 0; i < 12; i++) {
    const a = resumed.inventory.damage(0), b = direct.inventory.damage(0);
    assert.equal(a, b);
    assert.deepEqual(resumed.inventory.main[0], direct.inventory.main[0]);
  }
});
