// Guns mod (not 1.7.10): the ammo counter at the bottom right of the screen, in the 1.7.10 bitmap font (bitmap-text.js).
// It shows the rounds loaded, including the chamber (large), the matching ammo carried, the fire mode, and the reload state, like TaCZ's
// ammo HUD in this project's own layout. The state is pure; the element is made on first use, inside #hud, so it hides
// with the HUD (F1, menus) like the rest of GuiIngame.
import { gunOf, roundsLeft } from "./catalog.js";

// The fire mode as the counter names it: a bolt, pump or lever gun's single shots are its action, not semi-automatic fire.
export const modeLabel = (gun, mode) => gun.bolt === "manual_action" && mode !== "burst" ? (gun.type === "shotgun" ? "PUMP" : "BOLT") : String(mode).toUpperCase();
export const HUD_WHITE = 0xffffff, HUD_YELLOW = 0xffff55, HUD_RED = 0xff5555, HUD_GRAY = 0xaaaaaa;

// stack: the held stack. ctx: { count(id), creative, mode ("auto" | "semi" | "burst"), reloading }. Null without a gun in hand.
// An inventory-fed gun (the minigun) shows only the rounds carried: it has no magazine.
export function ammoHudState(stack, { count = () => 0, creative = false, mode = null, reloading = false } = {}) {
  const gun = gunOf(stack);
  if (!gun) return null;
  const inventoryFed = gun.feed === "inventory";
  const rounds = inventoryFed ? roundsLeft(stack, count, creative) : roundsLeft(stack), carried = count(gun.ammo),
    reserve = creative || inventoryFed || carried === Infinity ? null : carried; // a creative ammo box: no count to show
  return {
    gunId: gun.id, rounds, magazine: gun.magazine,
    reserve, // null: creative reloads are free
    mode: modeLabel(gun, mode ?? gun.modes[0]),
    reloading: !!reloading,
    // Out of rounds with something to load: prompt the reload key.
    prompt: !inventoryFed && !reloading && rounds <= 0 && (creative || reserve > 0), // the minigun has nothing to reload
    color: rounds <= 0 ? HUD_RED : rounds <= Math.ceil(gun.magazine / 4) ? HUD_YELLOW : HUD_WHITE,
  };
}

// The counter's lines as [text, colour, size] (size 2 is the doubled magazine count).
export function ammoHudLines(s) {
  if (!s) return [];
  const reserve = s.reserve == null ? "∞" : String(s.reserve);
  return [
    [[Number.isFinite(s.rounds) ? String(s.rounds) : "∞", s.color, 2], ...(s.magazine > 0 ? [[` / ${reserve}`, s.reserve === 0 ? HUD_RED : HUD_GRAY, 1]] : [])],
    [s.reloading ? ["Reloading", HUD_YELLOW, 1] : s.prompt ? ["R: Reload", HUD_RED, 1] : [s.mode, HUD_GRAY, 1]],
  ];
}

const CSS = `#gun-ammo-hud{position:fixed;right:calc(6*var(--u));bottom:calc(4*var(--u));z-index:4;pointer-events:none;text-align:right;image-rendering:pixelated}
#gun-ammo-hud.hidden{display:none}
#gun-ammo-hud .row{display:flex;justify-content:flex-end;align-items:flex-end}
#gun-ammo-hud .x2{--u:calc(var(--gui-scale)*2px)}
#gun-ammo-hud .row+.row{margin-top:calc(2*var(--u))}
@media(pointer:coarse){#gun-ammo-hud{bottom:auto;top:calc(30*var(--u))}}`;

// A DOM counter: update(state) redraws only when the text changes. `text(s, colour)` is bitmapHtml.
export function createAmmoHud(text, doc = globalThis.document) {
  let el = null, last = "";
  const mount = () => {
    if (el || !doc) return el;
    const style = doc.createElement("style");
    style.textContent = CSS;
    doc.head.appendChild(style);
    el = doc.createElement("div");
    el.id = "gun-ammo-hud";
    el.className = "hidden";
    el.setAttribute("aria-live", "off");
    (doc.querySelector("#hud") ?? doc.body).appendChild(el);
    return el;
  };
  return {
    update(state) {
      const lines = ammoHudLines(state), key = JSON.stringify(lines);
      if (key === last) return;
      last = key;
      if (!mount()) return;
      el.classList.toggle("hidden", !lines.length);
      el.setAttribute("aria-label", !state ? "" : `${state.rounds} rounds loaded`);
      el.innerHTML = lines.map((row) => `<div class="row">${row.map(([t, c, size]) =>
        `<span class="mc-text${size === 2 ? " x2" : ""}">${text(t, c)}</span>`).join("")}</div>`).join("");
    },
  };
}
