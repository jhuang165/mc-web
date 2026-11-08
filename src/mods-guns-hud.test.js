// Guns mod (not 1.7.10): the ammo counter's state, its lines, the DOM element and the hooks feeding it.
import test from "node:test";
import assert from "node:assert/strict";
import { ammoHudState, ammoHudLines, createAmmoHud, HUD_WHITE, HUD_YELLOW, HUD_RED, HUD_GRAY } from "./mods/guns/hud.js";
import { P320, AKM, M870, AMMO_762X39, AMMO_12G, AMMO_45ACP, GUNS } from "./mods/guns/catalog.js";

test("the counter shows the magazine, the ammo carried and the fire mode", () => {
  assert.equal(ammoHudState({ id: 1, count: 1 }), null);
  assert.equal(ammoHudState(null), null);
  const count = (id) => (id === AMMO_762X39 ? 90 : 0);
  const s = ammoHudState({ id: AKM, count: 1, damage: 4 }, { count, mode: "auto" });
  assert.deepEqual(s, { gunId: AKM, rounds: 26, magazine: 30, reserve: 90, mode: "AUTO", reloading: false, prompt: false, color: HUD_WHITE });
  assert.deepEqual(ammoHudLines(s), [[["26", HUD_WHITE, 2], [" / 90", HUD_GRAY, 1]], [["AUTO", HUD_GRAY, 1]]]);
  // A quarter of the magazine or less is yellow; empty is red with a reload prompt while there is ammo to load.
  assert.equal(ammoHudState({ id: AKM, damage: 22 }, { count }).color, HUD_YELLOW);
  assert.equal(ammoHudState({ id: AKM, damage: 21 }, { count }).color, HUD_WHITE);
  const empty = ammoHudState({ id: AKM, damage: 30 }, { count, mode: "semi" });
  assert.equal(empty.color, HUD_RED);
  assert.deepEqual(ammoHudLines(empty)[1], [["R: Reload", HUD_RED, 1]]);
  // Nothing to load: no prompt, and the empty reserve is red.
  const dry = ammoHudState({ id: M870, damage: GUNS[M870].magazine }, { count: () => 0 });
  assert.equal(dry.prompt, false);
  assert.deepEqual(ammoHudLines(dry), [[["0", HUD_RED, 2], [" / 0", HUD_RED, 1]], [["SEMI", HUD_GRAY, 1]]]);
  // Creative reloads are free: an infinite reserve, and the prompt with no ammo carried.
  const creative = ammoHudState({ id: P320, damage: 12 }, { count: () => 0, creative: true });
  assert.equal(creative.reserve, null);
  assert.equal(creative.prompt, true);
  assert.equal(ammoHudLines(creative)[0][1][0], " / ∞");
  // Reloading replaces the mode line.
  assert.deepEqual(ammoHudLines(ammoHudState({ id: AKM, damage: 30 }, { count, reloading: true }))[1], [["Reloading", HUD_YELLOW, 1]]);
  assert.deepEqual(ammoHudLines(null), []);
});

// A minimal DOM: elements with a class list, attributes and innerHTML.
function fakeDocument() {
  const make = (tag) => {
    const classes = new Set();
    return {
      tag, children: [], attrs: {}, innerHTML: "", textContent: "", id: "",
      set className(v) { classes.clear(); for (const c of v.split(/\s+/).filter(Boolean)) classes.add(c); },
      classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)), contains: (c) => classes.has(c) },
      setAttribute(k, v) { this.attrs[k] = v; },
      appendChild(c) { this.children.push(c); return c; },
    };
  };
  const hud = make("section"), head = make("head");
  return { hud, head, body: make("body"), createElement: make, querySelector: (q) => (q === "#hud" ? hud : null) };
}

test("the element mounts in #hud on first use, hides without a gun and redraws only on change", () => {
  const doc = fakeDocument(), calls = [];
  const text = (t, c) => { calls.push(t); return `<${c.toString(16)}>${t}`; };
  const hud = createAmmoHud(text, doc);
  assert.equal(doc.hud.children.length, 0);
  const s = ammoHudState({ id: AKM, damage: 0 }, { count: () => 60, mode: "auto" });
  hud.update(s);
  const [el] = doc.hud.children;
  assert.equal(el.id, "gun-ammo-hud");
  assert.equal(doc.head.children.length, 1); // its stylesheet
  assert.equal(el.classList.contains("hidden"), false);
  assert.match(el.innerHTML, /class="mc-text x2"><ffffff>30<\/span>/);
  assert.match(el.innerHTML, /<aaaaaa> \/ 60/);
  assert.equal(el.attrs["aria-label"], "30 of 30 rounds");
  const n = calls.length;
  hud.update({ ...s });
  assert.equal(calls.length, n, "same text: no redraw");
  hud.update(null);
  assert.equal(el.classList.contains("hidden"), true);
  assert.equal(doc.hud.children.length, 1);
  createAmmoHud(text, null).update(s); // no document (tests, workers): nothing to draw
});

test("the hooks report the counter every tick and clear it on a world load", async () => {
  const { createGunHooks } = await import("./mods/guns/hooks.js");
  const { Survival, ITEMS, setExtraCrafting } = await import("./survival.js");
  const { CREATIVE_TABS, SEARCH_ORDER } = await import("./creative.js");
  const { setGunsEnabled } = await import("./mods/guns/install.js");
  const opts = { items: ITEMS, combatTab: CREATIVE_TABS[8].items, search: SEARCH_ORDER, setCrafting: setExtraCrafting };
  setGunsEnabled(true, opts);
  try {
    const survival = new Survival({ slots: [{ id: AKM, count: 1, damage: 29 }, { id: AMMO_762X39, count: 45, damage: 0 }, { id: AMMO_12G, count: 3, damage: 0 }] }, "survival");
    const states = [];
    let clock = 0;
    const hooks = createGunHooks({
      survival, world: { get: () => 0, getMeta: () => 0, solid: () => false }, mobs: { pick: () => null, attackEntityFrom: () => true },
      random: () => 0.5, eye: () => ({ origin: [0, 64, 0], dir: [0, 0, -1] }), playerPos: () => ({ x: 0, z: 0 }),
      sneaking: () => false, moving: () => false, breakBlock() {}, renderHotbar() {}, markUnsaved() {}, toast() {},
      now: () => clock, hud: (s) => states.push(s),
    });
    const tick = (n) => { for (let i = 0; i < n; i++) { hooks.tick(); clock += 50; } };
    tick(1);
    assert.deepEqual([states.at(-1).rounds, states.at(-1).reserve, states.at(-1).mode], [1, 45, "AUTO"]);
    tick(Math.ceil(GUNS[AKM].draw / 0.05) + 1);
    hooks.key(34); // G: semi
    tick(1);
    assert.equal(states.at(-1).mode, "SEMI");
    hooks.attack(true); tick(1); hooks.attack(false);
    assert.deepEqual([states.at(-1).rounds, states.at(-1).prompt], [0, true]);
    hooks.key(19); tick(1);
    assert.equal(states.at(-1).reloading, true);
    tick(Math.ceil(GUNS[AKM].reload.empty / 0.05) + 1);
    assert.deepEqual([states.at(-1).rounds, states.at(-1).reserve, states.at(-1).reloading], [30, 15, false]);
    survival.inventory.current = 2; // ammo, not a gun
    tick(1);
    assert.equal(states.at(-1), null);
    hooks.reset();
    assert.equal(states.at(-1), null);
  } finally {
    setGunsEnabled(false, opts);
  }
  assert.ok(AMMO_45ACP);
});
