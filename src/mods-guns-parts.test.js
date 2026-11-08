// Guns mod (not 1.7.10): attachments (fit.js), the stack tag they live in (inventory.js modTag) and ammo boxes (ammo-box.js),
// with synthetic parts so no TaCZ pack is needed.
import test from "node:test";
import assert from "node:assert/strict";
import { ITEMS, setExtraCrafting, Survival } from "./survival.js";
import { CREATIVE_TABS, SEARCH_ORDER } from "./creative.js";
import { makeStack, sameStackItem } from "./inventory.js";
import { ORIGINAL_ITEMS } from "./original-items.js";
import { AKM, M870, AMMO_762X39, AMMO_12G, GUNS, ATTACHMENTS, gunOf, roundsLeft } from "./mods/guns/catalog.js";
import { taczAttachment, resolveAllowed, fitGun, fitsGun, refit, readGunTag, stackParts } from "./mods/guns/fit.js";
import { gunSlots, attachmentChoices, partSummary, fitFromInventory } from "./mods/guns/attachment-screen.js";
import { defaultVisibility } from "./mods/guns/bedrock.js";
import { AMMO_BOX_IRON, AMMO_BOX_GOLD, AMMO_BOX_CREATIVE, carriedAmmo, takeAmmo, fillBox, emptyBox, boxContents, boxCapacity, readBoxTag, boxLabel } from "./mods/guns/ammo-box.js";
import { setGunsEnabled, gunCraftingResult } from "./mods/guns/install.js";
import { TACZ_ATTACHMENT_IDS } from "./mods/guns/ids.js";
import { GunController, boltDelay } from "./mods/guns/firing.js";

const tables = () => ({ items: ITEMS, combatTab: CREATIVE_TABS[8].items, search: SEARCH_ORDER, setCrafting: setExtraCrafting });

// Three made-up parts under real pack names (their ids come from ids.js).
const names = Object.keys(TACZ_ATTACHMENT_IDS);
const pick = (prefix) => names.find((n) => n.startsWith(prefix));
const SCOPE = taczAttachment(pick("scope_"), {
  index: { type: "scope", name: "n.scope", sort: 2 },
  data: { ads: { addend: 0.05 }, aim_inaccuracy: { multiplier: 0.5 } },
  display: { zoom: [2.5, 4], fov: 30, scope: true, sounds: { install: "tacz:attach_scope" } },
}, { "n.scope": "§fTest Scope" });
const MAG = taczAttachment(pick("extended_mag_"), { index: { type: "extended_mag", sort: 1 }, data: { extended_mag_level: 2 }, display: {} });
const SILENCER = taczAttachment(pick("muzzle_"), {
  index: { type: "muzzle", sort: 0 }, data: { silence: { use_silence_sound: true }, recoil: { pitch: { multiplier: 0.8 }, yaw: { multiplier: 0.6 } } },
  display: { muzzle_flash_offset: 0.4 },
});

function withParts(fn) {
  const ak = GUNS[AKM], saved = { attachments: ak.attachments, extendedMag: ak.extendedMag, builtinParts: ak.builtinParts };
  for (const a of [SCOPE, MAG, SILENCER]) ATTACHMENTS[a.id] = a;
  Object.assign(ak, { attachments: new Set([SCOPE.key, MAG.key]), extendedMag: [34, 40, 45] });
  delete ak.builtinParts;
  try { fn(ak); } finally {
    for (const a of [SCOPE, MAG, SILENCER]) delete ATTACHMENTS[a.id];
    for (const [k, v] of Object.entries(saved)) if (v === undefined) delete ak[k]; else ak[k] = v;
  }
}

test("a pack attachment: type, name without colour codes, stats and display fields", () => {
  assert.equal(SCOPE.type, "scope");
  assert.equal(SCOPE.name, "Test Scope");
  assert.deepEqual(SCOPE.zoom, [2.5, 4]);
  assert.equal(SCOPE.sounds.install, "attach_scope");
  assert.equal(MAG.stats.extendedMag, 2);
  assert.equal(SILENCER.stats.silence, true);
  assert.equal(SILENCER.flashOffset, 0.4);
  assert.equal(taczAttachment("not_in_ids", { index: { type: "scope" } }), null);
  assert.equal(taczAttachment(SCOPE.key, { index: { type: "bayonet" } }), null);
});

test("allow lists expand nested tags and stop at a loop", () => {
  const tags = { a: ["x", "#tacz:b"], b: ["tacz:y", "#a"] };
  assert.deepEqual([...resolveAllowed(["#tacz:a", "z"], tags)].sort(), ["x", "y", "z"]);
  assert.deepEqual([...resolveAllowed(null, tags)], []);
});

test("fitted parts change the gun: aim time, spread, recoil, magazine, zoom, silence", () => {
  withParts((ak) => {
    const g = fitGun(ak, { scope: SCOPE, extended_mag: MAG, muzzle: SILENCER });
    assert.equal(g.base, ak);
    assert.ok(Math.abs(g.aim - (ak.aim + 0.05)) < 1e-9);
    assert.equal(g.inaccuracy.aim, ak.inaccuracy.aim * 0.5);
    assert.equal(g.inaccuracy.stand, ak.inaccuracy.stand);
    assert.deepEqual(g.recoilScale, [0.8, 0.6]);
    assert.equal(g.magazine, 40); // level 2 of [34, 40, 45]
    assert.equal(g.extendedLevel, 2);
    assert.equal(g.scopeZoom, 2.5);
    assert.equal(g.scopeFov, 30);
    assert.equal(g.silenced, true);
    assert.equal(fitGun(ak, {}), ak); // nothing fitted: the catalog gun itself
    assert.equal(fitsGun(ak, SCOPE), "scope");
    assert.equal(fitsGun(ak, SILENCER), null); // not on this gun's allow list
  });
});

test("gunOf reads the stack tag and caches one fitted gun per set of parts", () => {
  withParts((ak) => {
    const stack = { id: AKM, count: 1, damage: 0, modTag: { attachments: { scope: SCOPE.id } } };
    const g = gunOf(stack);
    assert.equal(g.scopeZoom, 2.5);
    assert.equal(gunOf({ ...stack }), g);
    assert.equal(gunOf({ id: AKM, count: 1, damage: 0 }), ak);
    assert.deepEqual(stackParts({ modTag: { attachments: { scope: MAG.id } } }, ATTACHMENTS), {}); // a part in the wrong slot is ignored
    // A built-in part fills its empty slot.
    ak.builtinParts = { scope: SCOPE.id };
    assert.equal(gunOf({ id: AKM, count: 1, damage: 0 }).scopeZoom, 2.5);
  });
});

test("refitting keeps the rounds loaded; a smaller magazine hands back what it no longer holds", () => {
  withParts(() => {
    const full = { id: AKM, count: 1, damage: 0 };
    const big = refit(full, "extended_mag", MAG, { gunOf, ATTACHMENTS });
    assert.equal(big.removed, null);
    assert.equal(roundsLeft(big.stack), 30); // 30 of 40
    assert.equal(big.stack.damage, 10);
    const loaded = { ...big.stack, damage: 0 }; // 40 of 40
    const back = refit(loaded, "extended_mag", null, { gunOf, ATTACHMENTS });
    assert.equal(back.removed, MAG);
    assert.equal(back.unloaded, 9);
    assert.equal(roundsLeft(back.stack), 31); // the chamber plus the smaller magazine
    assert.deepEqual(back.stack.modTag, { extraRound: true });
  });
});

test("fitting from the inventory takes the part and gives back the old one", () => {
  withParts((ak) => {
    const main = Array(36).fill(null);
    main[0] = { id: AKM, count: 1, damage: 0 };
    main[3] = { id: SCOPE.id, count: 2, damage: 0 };
    main[4] = { id: SILENCER.id, count: 1, damage: 0 };
    assert.deepEqual(gunSlots(ak), ["scope", "extended_mag"]);
    assert.deepEqual(attachmentChoices(ak, "scope", main).map((c) => [c.attachment.id, c.count]), [[SCOPE.id, 2]]);
    assert.deepEqual(attachmentChoices(ak, "muzzle", main), []); // the silencer does not fit
    assert.equal(attachmentChoices(ak, "extended_mag", main, true)[0].count, Infinity);
    const gun = main[0];
    const out = fitFromInventory(main, 0, "scope", SCOPE);
    assert.equal(out.ok, true);
    assert.equal(out.sound, "attach_scope");
    assert.equal(main[0], gun); // changed in place
    assert.equal(main[3].count, 1);
    assert.deepEqual(gun.modTag, { attachments: { scope: SCOPE.id } });
    assert.equal(fitFromInventory(main, 0, "scope", SCOPE).ok, false); // already fitted
    assert.equal(fitFromInventory(main, 0, "extended_mag", MAG).ok, false); // none carried
    assert.equal(fitFromInventory(main, 0, "extended_mag", MAG, { creative: true }).ok, true);
    const off = fitFromInventory(main, 0, "scope", null);
    assert.deepEqual(off.give, [{ id: SCOPE.id, count: 1, damage: 0 }]);
    assert.match(partSummary(SCOPE), /ADS \+0\.05s/);
    assert.match(partSummary(MAG, ak), /Mag 40/);
  });
});

test("the gun tag saves through the item's validator and keeps stacks apart", () => {
  assert.deepEqual(readGunTag({ attachments: { scope: 4400, grip: "x", laser: -1, bogus: 5 } }), { attachments: { scope: 4400 } });
  assert.equal(readGunTag({}), null);
  const a = makeStack(AKM, 1, 0, undefined, { modTag: { attachments: { scope: 4400 } } });
  const b = makeStack(AKM, 1, 0);
  assert.equal(sameStackItem(a, b), false);
  assert.equal(sameStackItem(a, makeStack(AKM, 1, 0, undefined, a)), true);
  const copy = makeStack(AKM, 1, 0, undefined, a);
  copy.modTag.attachments.scope = 4401;
  assert.equal(a.modTag.attachments.scope, 4400); // a deep copy
  setGunsEnabled(true, tables());
  try {
    const s = new Survival({ slots: [a, { id: AMMO_BOX_IRON, count: 1, damage: 0, modTag: { box: { ammo: AMMO_762X39, count: 90 } } },
      { id: 302, count: 1, damage: 0, modTag: { box: 1 } }] }, "survival");
    const saved = new Survival({ slots: s.inventory.serialize() }, "survival").inventory.main;
    assert.deepEqual(saved[0].modTag, { attachments: { scope: 4400 } });
    assert.deepEqual(saved[1].modTag, { box: { ammo: AMMO_762X39, count: 90 } });
    assert.equal(saved[2].modTag, undefined); // a vanilla item drops a mod tag
  } finally {
    setGunsEnabled(false, tables());
  }
});

test("ammo boxes: carried rounds, loose first, then boxes", () => {
  const main = Array(36).fill(null);
  main[0] = { id: AMMO_762X39, count: 20, damage: 0 };
  main[1] = { id: AMMO_BOX_IRON, count: 1, damage: 0, modTag: { box: { ammo: AMMO_762X39, count: 50 } } };
  main[2] = { id: AMMO_BOX_GOLD, count: 1, damage: 0, modTag: { box: { ammo: AMMO_12G, count: 7 } } };
  assert.equal(carriedAmmo(main, AMMO_762X39), 70);
  assert.equal(carriedAmmo(main, AMMO_12G), 7);
  assert.equal(takeAmmo(main, AMMO_762X39, 100), false);
  assert.equal(carriedAmmo(main, AMMO_762X39), 70); // a failed take takes nothing
  assert.equal(takeAmmo(main, AMMO_762X39, 30), true);
  assert.equal(main[0], null);
  assert.deepEqual(boxContents(main[1]), { ammo: AMMO_762X39, count: 40 });
  assert.equal(takeAmmo(main, AMMO_762X39, 40), true);
  assert.equal(boxContents(main[1]), null);
  assert.equal(main[1].modTag, undefined);
  main[5] = { id: AMMO_BOX_CREATIVE, count: 1, damage: 0 };
  assert.equal(carriedAmmo(main, AMMO_762X39), Infinity);
  assert.equal(takeAmmo(main, AMMO_762X39, 500), true);
  assert.equal(carriedAmmo(main, 302), 0); // not ammo
});

test("ammo boxes fill from loose rounds up to their size and empty into stacks", () => {
  const main = Array(36).fill(null);
  main[0] = { id: AMMO_BOX_IRON, count: 1, damage: 0 };
  main[1] = { id: AMMO_12G, count: 36, damage: 0 };
  main[2] = { id: AMMO_762X39, count: 60, damage: 0 };
  main[3] = { id: AMMO_12G, count: 36, damage: 0 };
  main[4] = { id: AMMO_12G, count: 36, damage: 0 };
  main[5] = { id: AMMO_12G, count: 10, damage: 0 };
  assert.equal(boxCapacity(main[0], AMMO_12G), 108); // three stacks of 36
  assert.equal(fillBox(main, 0), 108); // the first ammo found sets the type
  assert.deepEqual(boxContents(main[0]), { ammo: AMMO_12G, count: 108 });
  assert.equal(main[2].count, 60);
  assert.equal(main[5].count, 10);
  assert.equal(fillBox(main, 0), 0); // full
  assert.equal(boxLabel(main[0]), "108/108 12 Gauge Shells");
  assert.deepEqual(emptyBox(main, 0).map((s) => s.count), [36, 36, 36]);
  assert.equal(boxLabel(main[0]), "Empty");
  assert.deepEqual(emptyBox(main, 0), []);
  assert.equal(fillBox([{ id: AMMO_BOX_CREATIVE, count: 1 }, { id: AMMO_12G, count: 5 }], 0), 0);
  assert.deepEqual(readBoxTag({ box: { ammo: AMMO_12G, count: 3.5 } }), null);
  assert.deepEqual(readBoxTag({ box: { ammo: AMMO_12G, count: 5 } }), { box: { ammo: AMMO_12G, count: 5 } });
});

test("box and gun smith recipes use the live crafting table and chest", () => {
  const cells = (rows, keys) => rows.join("").split("").map((c) => (c === " " ? null : { count: 1, damage: 0, id: keys[c] }));
  const chest = ORIGINAL_ITEMS[54], table = ORIGINAL_ITEMS[58];
  assert.equal(ITEMS[table]?.name, "Crafting Table");
  assert.equal(ITEMS[chest]?.name, "Chest");
  assert.equal(gunCraftingResult(cells(["I I", "ICI", "III"], { I: 302, C: chest }), 3)?.id, AMMO_BOX_IRON);
  assert.equal(gunCraftingResult(cells(["G G", "GCG", "GGG"], { G: 304, C: chest }), 3)?.id, AMMO_BOX_GOLD);
  assert.equal(gunCraftingResult(cells(["III", "ICI", "   "], { I: 302, C: table }), 3)?.id, 4300);
  assert.equal(gunCraftingResult(cells(["III", "ICI", "   "], { I: 302, C: 58 }), 3), null); // 58 is not the crafting table here
});

test("a pump or bolt gun waits for its action, whatever its rpm", () => {
  assert.equal(boltDelay(GUNS[M870]), 0.55);
  assert.equal(boltDelay(GUNS[AKM]), 0);
  const c = new GunController(), stack = { id: M870, count: 1, damage: 0 };
  const ctx = { held: stack, slot: 0, creative: true, count: () => 99, take: () => true };
  c.tick(ctx);
  for (let i = 0; i < 10; i++) c.tick(ctx); // past the draw
  c.press();
  assert.ok(c.tick(ctx).some((e) => e.type === "shot"));
  assert.ok(Math.abs(c.cooldown - 0.55) < 1e-9);
});

test("visibility follows the fitted parts: extended mag, scope mount, folded sight, adapters", () => {
  const geo = { bones: ["mag_standard", "mag_extended_1", "mag_extended_2", "mount", "sight", "sight_folded", "carry_handle",
    "muzzle_default", "stock_default", "handguard_default", "handguard_tactical", "attachment_adapter"].map((name) => ({ name }))
    .concat([{ name: "rail_a", parent: "attachment_adapter" }, { name: "rail_b", parent: "attachment_adapter" }]) };
  const none = defaultVisibility(geo, { parts: {} });
  assert.equal(none("mag_standard"), false);
  assert.equal(none("rail_a"), true);
  const hidden = defaultVisibility(geo, { parts: { scope: { ...SCOPE, adapter: "rail_a" }, extended_mag: MAG, muzzle: SILENCER, grip: {} }, extendedLevel: 3 });
  assert.equal(hidden("mag_standard"), true);
  assert.equal(hidden("mag_extended_2"), false); // the highest the model has
  assert.equal(hidden("sight"), true);
  assert.equal(hidden("sight_folded"), false);
  assert.equal(hidden("carry_handle"), true);
  assert.equal(hidden("muzzle_default"), true);
  assert.equal(hidden("stock_default"), false);
  assert.equal(hidden("handguard_default"), true);
  assert.equal(hidden("handguard_tactical"), false);
  assert.equal(hidden("rail_a"), false);
  assert.equal(hidden("rail_b"), true);
});
