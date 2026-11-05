// GuiBeacon (bez): buttons, labels and payment icons over the 230 x 219 beacon.png sheet. Geometry is bytecode-derived
// (public/research/beacon.md): the screen's local primary/secondary picks are sent on Confirm (MC|Beacon).
import { BEACON_TIERS, PAYMENT_ITEMS } from './pyramid.js';
import { POTION_TYPES } from './potions.js';

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
const button = (b, selected, attrs, inner) =>
  `<button class="beacon-btn${b.disabled ? ' off' : ''}${selected ? ' on' : ''}" ${attrs} style="left:calc(${b.x}*var(--u));top:calc(${b.y}*var(--u));--su:${b.disabled ? SPRITE_U.disabled : selected ? SPRITE_U.selected : SPRITE_U.normal}"${b.disabled ? ' aria-disabled="true"' : ''}>${inner}</button>`;

// The local state: `levels` from the tile, `primary`/`secondary` the picks; `payment` whether slot 0 holds an item.
export function beaconDecorationsHtml() {
  return '<span class="beacon-label" style="left:calc(62*var(--u))">Primary Power</span><span class="beacon-label" style="left:calc(169*var(--u))">Secondary Power</span><div id="beacon-ui"></div>';
}
export function beaconUiHtml({ levels, primary, secondary, payment, icon }) {
  if (levels < 0) return '';
  const name = (id, tier) => POTION_TYPES[id]?.name + (tier === 3 && id !== 10 ? ROMAN : '');
  let html = '';
  for (const b of powerButtons(levels)) {
    html += button(b, b.id === primary, `data-beacon="power" data-tier="${b.tier}" data-id="${b.id}" title="${name(b.id, b.tier)}"`, `<i class="beacon-effect" style="${iconPos(POTION_TYPES[b.id].icon)}"></i>`);
  }
  for (const b of secondaryButtons(levels, primary)) {
    html += button(b, b.id === secondary, `data-beacon="power" data-tier="3" data-id="${b.id}" title="${name(b.id, 3)}"`, `<i class="beacon-effect" style="${iconPos(POTION_TYPES[b.id].icon)}"></i>`);
  }
  const confirm = { x: 164, y: 107, disabled: !(payment && primary > 0) };
  html += button(confirm, false, 'data-beacon="confirm" title="Done"', '<i class="beacon-mark" style="--mx:90"></i>');
  html += button({ x: 190, y: 107, disabled: false }, false, 'data-beacon="cancel" title="Cancel"', '<i class="beacon-mark" style="--mx:112"></i>');
  // Payment items drawn at (42, 109), (64, 109), (86, 109), (108, 109): emerald, diamond, gold ingot, iron ingot.
  [367, 303, 304, 302].forEach((id, i) => { html += `<span class="beacon-pay" style="left:calc(${42 + i * 22}*var(--u));top:calc(109*var(--u))">${icon(id)}</span>`; });
  return html;
}
export const BEACON_PAYMENT_IDS = PAYMENT_ITEMS;
