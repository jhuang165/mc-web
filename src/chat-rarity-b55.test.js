// Replays public/research/chat-rarity-reference.json (tools/probes/ChatRarityProbe.java, the executed 1.7.10 ItemStack.func_151000_E and getRarity).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ORIGINAL_ITEMS } from "./original-items.js";
import { itemComponent, stackRarity, stackNbtText } from "./item-component.js";
import { originalOfLive } from "./item-names.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/chat-rarity-reference.json", import.meta.url)));
const lower = (r) => r.toLowerCase();
const liveFor = (id, damage) => ORIGINAL_ITEMS[`${id}:${damage}`] ?? ORIGINAL_ITEMS[id];

test("rarity of every item the port has, plain, enchanted and with stored enchantments", () => {
  let checked = 0;
  for (const [id, plain, plainDiff, ench, enchDiff, stored, storedDiff] of ref.rarity) {
    const variants = [[plain, plainDiff, {}], [ench, enchDiff, { enchantments: [{ id: 16, lvl: 1 }] }], [stored, storedDiff, { storedEnchantments: [{ id: 16, lvl: 1 }] }]];
    for (const [base, diff, extra] of variants) {
      const expect = (d) => lower(diff.find((x) => x[0] === d)?.[1] ?? base);
      for (const d of [0, 1]) {
        const live = liveFor(id, d);
        if (live === undefined || originalOfLive(live)?.id !== id) continue;
        const pinned = originalOfLive(live).damage;
        if (pinned !== undefined && pinned !== d) continue;
        assert.equal(stackRarity({ id: live, count: 1, damage: pinned !== undefined ? 0 : d, ...extra }), expect(d), `${id}:${d} ${JSON.stringify(extra)}`);
        checked++;
      }
    }
  }
  assert.ok(checked > 300);
});

test("named stacks: colour, sibling layout and hover text equal the executed components", () => {
  const specs = { namedSword: [276, 0, {}], namedGoldenAppleEnchanted: [322, 1, {}], namedEnchantedSword: [276, 0, { enchantments: [{ id: 16, lvl: 1 }] }], namedRecord: [2256, 0, {}], namedBook: [403, 0, { storedEnchantments: [{ id: 16, lvl: 1 }] }], namedNetherStar: [399, 0, {}] };
  for (const [name, json, formatted, unformatted, rarity, nbt] of ref.rows) {
    const spec = specs[name];
    if (!spec) continue;
    const live = liveFor(spec[0], spec[1]);
    const shown = name, nbtFull = JSON.parse(json).hoverEvent.value;
    const stack = { id: live, count: 1, damage: originalOfLive(live)?.damage !== undefined ? 0 : spec[1], displayName: "Sting", ...spec[2] };
    const c = itemComponent(stack, "Sting");
    assert.equal(c.style.color, JSON.parse(json).color, shown);
    assert.equal(stackRarity(stack), lower(rarity), shown);
    assert.equal(c.formatted(), formatted, shown);
    assert.equal(c.unformatted(), unformatted, shown);
    assert.equal(stackNbtText(stack), nbtFull, shown);
    assert.equal(c.style.hover.value.unformatted(), nbtFull, shown);
    assert.equal(c.style.hover.action, "show_item");
    assert.equal(stackNbtText(stack), JSON.parse(json).hoverEvent.value.replace(/Name "\d+""/, 'Sting"').replace(/Name:\\?"Name "\d+""/, 'Name:"Sting"'), shown);
  }
});

test("a renamed stack is not italic", () => {
  assert.ok(ref.rows.every((r) => !JSON.parse(r[1]).italic));
});

test("death messages and /give use the rarity component", async () => {
  const { CombatTracker, damageSource } = await import("./combat-tracker.js");
  const { deathComponent } = await import("./team-names.js");
  const sword = { id: liveFor(276, 0), count: 1, damage: 0, displayName: "Sting", enchantments: [{ id: 16, lvl: 1 }] };
  await import("./death-messages.js"); // registers the known death.* lang keys
  const src = damageSource("a player", "player", { type: "player", isPlayer: true, customName: "Alex", equipment: [sword] }), t = new CombatTracker();
  t.record(src, 20, 20, 0, { alive: false });
  t.noteAttacker(src, 0);
  const c = deathComponent(t, "Steve", { rawName: "Steve" });
  assert.match(c.formatted(), /§b\[§r§bSting§r§b\]§r/);
  assert.match(c.formatted(), /was slain by/);
});
