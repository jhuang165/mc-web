// GuiBeacon (bez): buttons, labels and payment icons over the 230 x 219 beacon.png sheet. Geometry is bytecode-derived
// (public/research/beacon.md): the screen's local primary/secondary picks are sent on Confirm (MC|Beacon).
import { BEACON_TIERS, PAYMENT_ITEMS } from './pyramid.js';
import { POTION_TYPES } from './potions.js';
import { translate } from './lang.js';

export const BEACON_GUI = Object.freeze({ width: 230, height: 219 });
// Button sprite columns on the sheet row at v = 219: normal, selected, disabled, hover (GuiBeacon.a).
const SPRITE_U = { normal: 0, selected: 22, disabled: 44, hover: 66 };
const ROMAN = ' II';

// Positions of the power buttons (GuiBeacon.func_73866_w_ / updateButtons), relative to the screen origin.
export function powerButtons(levels) {
  const out = [];
  for (let tier = 0; tier < 3; tier++) {
    const ids = BEACON_TIERS[tier], width = ids.length * 22 + (ids.length - 1) * 2;
    ids.forEach((id, i) => out.push({ tier, id, x: 76 + i * 24 - width / 2, y: 22 + tier * 25, disabled: tier >= levels }));
  }
  return out;
}
export function secondaryButtons(levels, primary) {
  const ids = [...BEACON_TIERS[3]], count = ids.length + 1, width = count * 22 + (count - 1) * 2, out = [];
  ids.forEach((id, i) => out.push({ tier: 3, id, x: 167 + i * 24 - width / 2, y: 47, disabled: 3 >= levels }));
  if (primary > 0) out.push({ tier: 3, id: primary, x: 167 + ids.length * 24 - width / 2, y: 47, disabled: 3 >= levels, repeat: true });
  return out;
}
const iconPos = (index) => `--ix:${(index % 8) * 18};--iy:${198 + Math.floor(index / 8) * 18}`;
/**
 * GuiBeacon$Button.drawButton (bfd): field_146123_n is the 22 x 22 Gui hit test whether or not the button is enabled; the sprite column is
 * disabled (44) before selected (22) before hovered (66), else 0. The icon quad is drawn afterwards with plain white, so a disabled
 * button's icon is not dimmed. `x`, `y` are GUI units relative to guiLeft / guiTop.
 */
export function beaconButtonDraw(b, selected, x = -1, y = -1) {
  const hover = x >= b.x && y >= b.y && x < b.x + 22 && y < b.y + 22;
  return { hover, u: b.disabled ? SPRITE_U.disabled : selected ? SPRITE_U.selected : hover ? SPRITE_U.hover : SPRITE_U.normal };
}
const button = (b, selected, attrs, inner, mouse) =>
  `<button class="beacon-btn${b.disabled ? ' off' : ''}${selected ? ' on' : ''}" ${attrs} style="left:calc(${b.x}*var(--u));top:calc(${b.y}*var(--u));--su:${beaconButtonDraw(b, selected, mouse.x, mouse.y).u}"${b.disabled ? ' aria-disabled="true"' : ''}>${inner}</button>`;

// The local state: `levels` from the tile, `primary`/`secondary` the picks; `payment` whether slot 0 holds an item.
export function beaconDecorationsHtml() {
  return `<span class="beacon-label" style="left:calc(62*var(--u))">${translate("tile.beacon.primary", "Primary Power")}</span><span class="beacon-label" style="left:calc(169*var(--u))">${translate("tile.beacon.secondary", "Secondary Power")}</span><div id="beacon-ui"></div>`;
}
const name = (id, tier) => (POTION_TYPES[id] ? translate(POTION_TYPES[id].key, POTION_TYPES[id].name) : undefined) + (tier === 3 && id !== 10 ? ROMAN : '');
export const BEACON_CONFIRM = Object.freeze({ x: 164, y: 107 }), BEACON_CANCEL = Object.freeze({ x: 190, y: 107 });
/**
 * GuiBeacon.drawScreen: the hovered button (field_146123_n, set by drawButton whether or not the button is enabled) draws its
 * drawCreativeTabHoveringText line: the effect name (" II" on the secondary row except Regeneration), gui.done or gui.cancel.
 * `x`, `y` are GUI units relative to guiLeft / guiTop; returns the string or null.
 */
export function beaconTooltip(x, y, { levels, primary }) {
  if (levels < 0) return null;
  const over = (b) => x >= b.x && y >= b.y && x < b.x + 22 && y < b.y + 22;
  for (const b of powerButtons(levels)) if (over(b)) return name(b.id, b.tier);
  for (const b of secondaryButtons(levels, primary)) if (over(b)) return name(b.id, 3);
  if (over(BEACON_CONFIRM)) return translate("gui.done", "Done");
  if (over(BEACON_CANCEL)) return translate("gui.cancel", "Cancel");
  return null;
}
export function beaconUiHtml({ levels, primary, secondary, payment, icon, mouseX = -1, mouseY = -1 }) {
  if (levels < 0) return '';
  const mouse = { x: mouseX, y: mouseY };
  let html = '';
  for (const b of powerButtons(levels)) {
    html += button(b, b.id === primary, `data-beacon="power" data-tier="${b.tier}" data-id="${b.id}" aria-label="${name(b.id, b.tier)}"`, `<i class="beacon-effect" style="${iconPos(POTION_TYPES[b.id].icon)}"></i>`, mouse);
  }
  for (const b of secondaryButtons(levels, primary)) {
    html += button(b, b.id === secondary, `data-beacon="power" data-tier="3" data-id="${b.id}" aria-label="${name(b.id, 3)}"`, `<i class="beacon-effect" style="${iconPos(POTION_TYPES[b.id].icon)}"></i>`, mouse);
  }
  const confirm = { ...BEACON_CONFIRM, disabled: !(payment && primary > 0) };
  html += button(confirm, false, `data-beacon="confirm" aria-label="${translate("gui.done", "Done")}"`, '<i class="beacon-mark" style="--mx:90"></i>', mouse);
  html += button({ ...BEACON_CANCEL, disabled: false }, false, `data-beacon="cancel" aria-label="${translate("gui.cancel", "Cancel")}"`, '<i class="beacon-mark" style="--mx:112"></i>', mouse);
  // Payment items drawn at (42, 109), (64, 109), (86, 109), (108, 109): emerald, diamond, gold ingot, iron ingot.
  [367, 303, 304, 302].forEach((id, i) => { html += `<span class="beacon-pay" style="left:calc(${42 + i * 22}*var(--u));top:calc(109*var(--u))">${icon(id)}</span>`; });
  return html;
}
export const BEACON_PAYMENT_IDS = PAYMENT_ITEMS;
