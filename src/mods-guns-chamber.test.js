import test from "node:test";
import assert from "node:assert/strict";
import { GUNS, ATTACHMENTS, P320, AKM, M870, gunOf, roundsLeft } from "./mods/guns/catalog.js";
import { GunController } from "./mods/guns/firing.js";
import { hasChamber, setLoadedRounds } from "./mods/guns/ammo.js";
import { setGunPack, setGunsEnabled } from "./mods/guns/install.js";
import { refit, readGunTag, taczAttachment } from "./mods/guns/fit.js";
import { TACZ_GUN_IDS, TACZ_ATTACHMENT_IDS } from "./mods/guns/ids.js";
import { ammoHudState, ammoHudLines } from "./mods/guns/hud.js";
import { Survival, ITEMS, setExtraCrafting } from "./survival.js";
import { CREATIVE_TABS, SEARCH_ORDER } from "./creative.js";

function harness(id, { left = 1, ammo = 1000, creative = false } = {}) {
  const stack = { id, count: 1, damage: 0 }, gun = GUNS[id], c = new GunController();
  setLoadedRounds(gun, stack, left);
  let reserve = ammo;
  const ctx = { held: stack, slot: 0, creative, count: () => reserve,
    take: (_, n) => { assert.ok(n >= 0 && n <= reserve); reserve -= n; return true; } };
  const run = (n) => Array.from({ length: n }, () => c.tick(ctx)).flat();
  run(100); // draw
  const reload = () => {
    assert.equal(c.startReload(ctx), true);
    return run(300);
  };
  return { stack, c, ctx, run, reload, reserve: () => reserve };
}

for (const id of [P320, AKM, M870]) test(`${GUNS[id].name}: nonempty reload keeps +1, an empty reload fills the nominal capacity`, () => {
  const gun = GUNS[id], h = harness(id);
  h.reload();
  assert.equal(roundsLeft(h.stack), gun.magazine + 1);
  assert.equal(h.reserve(), 1000 - gun.magazine);
  assert.equal(h.c.startReload(h.ctx), false); // cannot stack extra rounds with repeated reloads
  const hud = ammoHudState(h.stack);
  assert.equal(hud.rounds, gun.magazine + 1);
  assert.equal(ammoHudLines(hud)[0][0][0], String(gun.magazine + 1));
  let shots = 0;
  for (let i = 0; i < 1000; i++) {
    h.c.release(); h.c.press();
    shots += h.run(1).filter((e) => e.type === "shot").length;
  }
  h.c.release();
  assert.equal(shots, gun.magazine + 1);
  assert.equal(roundsLeft(h.stack), 0);
  assert.equal(h.stack.damage, gun.magazine);
  assert.equal(h.stack.modTag, undefined);
  h.reload();
  assert.equal(roundsLeft(h.stack), gun.magazine);
  assert.equal(h.reserve(), 1000 - 2 * gun.magazine);
  h.reload(); // top off a full nominal magazine by adding just one round
  assert.equal(roundsLeft(h.stack), gun.magazine + 1);
  assert.equal(h.reserve(), 999 - 2 * gun.magazine);
});

test("limited reserve, creative reloads and cancellation never create a free chamber round", () => {
  const limited = harness(P320, { left: 10, ammo: 2 });
  limited.reload();
  assert.equal(roundsLeft(limited.stack), 12);
  assert.equal(limited.stack.modTag, undefined);
  assert.equal(limited.c.startReload(limited.ctx), false);
  for (const left of [0, 1, 12]) {
    const h = harness(P320, { left, creative: true, ammo: 0 });
    h.reload();
    assert.equal(roundsLeft(h.stack), left ? 13 : 12);
    assert.equal(h.reserve(), 0);
  }
  const cancelled = harness(AKM, { left: 29 });
  assert.equal(cancelled.c.startReload(cancelled.ctx), true);
  cancelled.run(1);
  cancelled.ctx.slot++;
  cancelled.run(300);
  assert.equal(roundsLeft(cancelled.stack), 29);
  assert.equal(cancelled.reserve(), 1000);
});

// Synthetic pack data exercises the same classification used for every installed gun, without needing private assets.
test("pack bolt/feed settings control +1 for pistols, rifles, manual actions and exclusions", () => {
  const guns = {};
  const configs = [
    ["glock_17", "closed_bolt", "magazine", true], ["m4a1", "closed_bolt", "magazine", true],
    ["ai_awp", "manual_action", "magazine", true], ["uzi", "open_bolt", "magazine", false],
    ["aa12", "open_bolt", "magazine", false], ["rhino357", "open_bolt", "magazine", false],
    ["db_long", "open_bolt", "magazine", false], ["rpg7", "open_bolt", "magazine", false],
    ["minigun", "open_bolt", "inventory", false],
  ];
  for (const [key, bolt, type] of configs) guns[key] = { index: {}, display: {},
    data: { ammo: "tacz:9mm", ammo_amount: 6, bolt, reload: { type }, fire_mode: ["semi"] } };
  try {
    setGunPack({ guns, ammo: {}, recipes: [] });
    for (const [key, , feed, extra] of configs) {
      const id = TACZ_GUN_IDS[key], gun = GUNS[id];
      assert.equal(hasChamber(gun), extra, key);
      const h = harness(id);
      if (feed === "inventory") { assert.equal(h.c.startReload(h.ctx), false); continue; }
      h.reload();
      assert.equal(roundsLeft(h.stack), gun.magazine + Number(extra), key);
      const empty = harness(id, { left: 0 });
      empty.reload();
      assert.equal(roundsLeft(empty.stack), gun.magazine, key);
    }
  } finally { setGunPack(null); }
});

test("extra rounds survive inventory serialization, with or without attachments; old saves keep their counts", () => {
  const tables = { items: ITEMS, combatTab: CREATIVE_TABS[8].items, search: SEARCH_ORDER, setCrafting: setExtraCrafting };
  setGunsEnabled(true, tables);
  try {
    const h = harness(AKM, { left: 29 }); h.reload();
    const attached = { ...h.stack, modTag: { ...h.stack.modTag, attachments: { scope: 4400 } } };
    const s = new Survival({ slots: [h.stack, attached, { id: AKM, count: 1, damage: 0 }] }, "survival");
    const saved = new Survival({ slots: JSON.parse(JSON.stringify(s.inventory.serialize())) }, "survival");
    assert.deepEqual(saved.inventory.main.slice(0, 3).map((s) => roundsLeft(s)), [31, 31, 30]);
    assert.deepEqual(saved.inventory.main[1].modTag, attached.modTag);
    const held = saved.inventory.main[0];
    const c = new GunController(), ctx = { held, slot: 0, count: () => 0 };
    for (let i = 0; i < 100; i++) c.tick(ctx);
    c.press(); c.tick(ctx);
    assert.equal(roundsLeft(held), 30);
    assert.equal(held.modTag, undefined); // the extra round can only be spent once
    assert.deepEqual(readGunTag({ extraRound: true, junk: 1 }), { extraRound: true });
    assert.equal(readGunTag({ extraRound: 1 }), null);
  } finally { setGunsEnabled(false, tables); }
});

test("extended magazines reload to their capacity +1 and refitting conserves loaded and returned ammo", () => {
  const gun = GUNS[AKM], oldExtended = gun.extendedMag;
  const key = Object.keys(TACZ_ATTACHMENT_IDS).find((k) => k.startsWith("extended_mag_"));
  const part = taczAttachment(key, { index: { type: "extended_mag" }, data: { extended_mag_level: 1 } });
  ATTACHMENTS[part.id] = part; gun.extendedMag = [40];
  try {
    const h = harness(AKM, { left: 30 }); h.reload(); // 31
    const fitted = refit(h.stack, "extended_mag", part, { gunOf, ATTACHMENTS });
    assert.equal(roundsLeft(fitted.stack), 31);
    assert.equal(fitted.unloaded, 0);
    h.ctx.held = fitted.stack;
    h.reload();
    assert.equal(roundsLeft(fitted.stack), 41);
    assert.equal(h.reserve(), 989); // 1 top-off round, then 10 more
    const removed = refit(fitted.stack, "extended_mag", null, { gunOf, ATTACHMENTS });
    assert.equal(roundsLeft(removed.stack), 31);
    assert.equal(removed.unloaded, 10);
    assert.deepEqual(removed.stack.modTag, { extraRound: true });
  } finally {
    if (oldExtended === undefined) delete gun.extendedMag; else gun.extendedMag = oldExtended;
    delete ATTACHMENTS[part.id];
  }
});
