// GuiCreateFlatWorld (bcz) and GuiFlatPresets (bdq) as menu-ui.js screens. Layout, strings and behaviour are from the
// 1.7.10 bytecode (public/research/superflat.md): Remove Layer works, Add Layer / Edit Layer are created hidden and
// "(NYI)" in 1.7.10 itself, and the Presets screen edits the generator string directly.
import { t, textWidth, COLOR } from './menu-screens.js';
import { parseFlatInfo, FLAT_PRESETS } from './flat-world.js';
import { ORIGINAL_ITEMS } from './original-items.js';
import { nativeName } from './item-names.js';
import { fromOriginal } from './block-registry.js';

// en_US.lang (recalled; not in the client jar).
export const FLAT_LANG = {
  'createWorld.customize.flat.title': 'Superflat Customization',
  'createWorld.customize.flat.tile': 'Layer material',
  'createWorld.customize.flat.height': 'Height',
  'createWorld.customize.flat.addLayer': 'Add Layer',
  'createWorld.customize.flat.editLayer': 'Edit Layer',
  'createWorld.customize.flat.removeLayer': 'Remove Layer',
  'createWorld.customize.flat.layer.top': 'Top - %d',
  'createWorld.customize.flat.layer.bottom': 'Bottom - %d',
  'createWorld.customize.flat.layer': '%d',
  'createWorld.customize.presets': 'Presets',
  'createWorld.customize.presets.title': 'Select a Preset',
  'createWorld.customize.presets.share': 'Want to share your preset with someone? Use the box below!',
  'createWorld.customize.presets.list': "Alternatively, here's some we made earlier!",
  'createWorld.customize.presets.select': 'Use Preset',
};
const L = (key, n) => FLAT_LANG[key].replace('%d', String(n));

const btn = (x, y, w = 150, h = 20) => ({ x, y, w, h });
const STYLE = `.flat-icon{position:absolute;pointer-events:none;image-rendering:pixelated}
.flat-icon .vanilla-item-icon{display:block;width:100%;height:100%;margin:0;padding:0;filter:none}
.flat-slot{position:absolute;pointer-events:none;background:#8b8b8b;box-shadow:inset calc(var(--u)) calc(var(--u)) #373737,inset calc(-1*var(--u)) calc(-1*var(--u)) #fff}`;
let styled = false;
function ensureStyle() {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = STYLE;
  document.head.append(s);
}
const u = (n) => `calc(var(--u)*${n})`;

// The browser item for an original block id (Item.getItemFromBlock) or null (air, and blocks without an item such as water).
export function layerItem(block, meta) {
  if (!block) return null;
  const live = ORIGINAL_ITEMS[`${block}:${meta}`] ?? ORIGINAL_ITEMS[block] ?? fromOriginal(block, meta)?.id;
  return live ?? null;
}
// bda.a: the layer's display name, "Air" for air and for blocks that have no item.
export function layerName(block, meta) {
  if (!block) return 'Air';
  return nativeName(block, meta) ?? 'Air';
}
// Layer rows top to bottom (list index 0 is the topmost layer) as bda draws them.
export function layerRows(info) {
  const n = info.layers.length;
  return Array.from({ length: n }, (_, i) => {
    const [block, meta, count] = info.layers[n - i - 1];
    return { block, meta, name: layerName(block, meta), label: L(i === 0 ? 'createWorld.customize.flat.layer.top' : i === n - 1 ? 'createWorld.customize.flat.layer.bottom' : 'createWorld.customize.flat.layer', count) };
  });
}

function addIcon(g, parent, x, y, item, damage, icon) {
  ensureStyle();
  // bdq/bda.a(x, y, stack): the 18 x 18 slot frame at (x + 1, y + 1), the item at (x + 2, y + 2).
  const frame = document.createElement('div');
  frame.className = 'flat-slot';
  frame.style.cssText = `left:${u(x + 1)};top:${u(y + 1)};width:${u(18)};height:${u(18)}`;
  parent.append(frame);
  if (item && icon) {
    const holder = document.createElement('div');
    holder.className = 'flat-icon';
    holder.style.cssText = `left:${u(x + 2)};top:${u(y + 2)};width:${u(16)};height:${u(16)}`;
    holder.innerHTML = icon(item, damage);
    parent.append(holder);
  }
}

// GuiCreateFlatWorld. `done(optionsString)` is GuiCreateWorld's field_146334_a = info.toString(); `cancel()` returns unchanged.
export function flatWorldScreen({ show, icon, options, done, cancel }) {
  const state = { info: parseFlatInfo(options), selected: -1, scroll: 0 };
  const screen = {
    id: 'create-flat-world',
    escape: () => cancel(),
    init(g, w, h) {
      const c = Math.trunc(w / 2), rows = layerRows(state.info);
      let list, remove;
      const refresh = () => { remove.enable(state.selected > -1 && state.selected < rows.length); list.refresh(); };
      list = g.slotList({ top: 43, bottom: h - 60, slotHeight: 24, width: 220, scrollbarX: c + 124 }, {
        count: rows.length,
        scroll: state.scroll,
        selected: (i) => i === state.selected,
        entry(i, y, parent, x) {
          const r = rows[i];
          addIcon(g, parent, x, y, layerItem(r.block, r.meta), r.meta, icon);
          g.text(r.name, x + 18 + 5, y + 3, { parent });
          g.text(r.label, x + 2 + 213 - textWidth(r.label), y + 3, { parent });
        },
        click(i) { state.selected = i; refresh(); },
      });
      g.text(FLAT_LANG['createWorld.customize.flat.title'], c, 8, { center: true });
      const left = c - 92 - 16;
      g.text(FLAT_LANG['createWorld.customize.flat.tile'], left, 32, { color: COLOR.label });
      const height = FLAT_LANG['createWorld.customize.flat.height'];
      g.text(height, left + 2 + 213 - textWidth(height), 32, { color: COLOR.label });
      // Add Layer and Edit Layer exist in 1.7.10 but are never shown: their NYI labels are what the class stores.
      g.button(btn(c - 154, h - 52, 100), FLAT_LANG['createWorld.customize.flat.addLayer'] + ' (NYI)', null, { enabled: false }).show(false);
      g.button(btn(c - 50, h - 52, 100), FLAT_LANG['createWorld.customize.flat.editLayer'] + ' (NYI)', null, { enabled: false }).show(false);
      remove = g.button(btn(c - 155, h - 52), FLAT_LANG['createWorld.customize.flat.removeLayer'], () => {
        if (state.selected < 0 || state.selected >= rows.length) return;
        state.scroll = list.scroll;
        // The layer list is stored bottom first: row i is layers[size - i - 1].
        state.info.layers.splice(rows.length - state.selected - 1, 1);
        state.selected = Math.min(state.selected, rows.length - 2);
        state.info.recalc();
        show(screen);
      });
      g.button(btn(c + 5, h - 52), FLAT_LANG['createWorld.customize.presets'], () => { state.scroll = list.scroll; show(presetsScreen({ show, icon, options: state.info.toString(), back: screen, apply: (text) => { state.info = parseFlatInfo(text); state.selected = -1; state.scroll = 0; } })); });
      g.button(btn(c - 155, h - 28), t('gui.done'), () => done(state.info.toString()));
      g.button(btn(c + 5, h - 28), t('gui.cancel'), () => cancel());
      remove.enable(state.selected > -1 && state.selected < rows.length);
    },
  };
  return screen;
}

// GuiFlatPresets: a text box holding the generator string (max 1230) over the eight presets.
export function presetsScreen({ show, icon, options, back, apply }) {
  const state = { text: options, selected: -1, scroll: 0 };
  return {
    id: 'flat-presets',
    escape: () => show(back),
    init(g, w, h) {
      const c = Math.trunc(w / 2);
      let field, use, list;
      const sync = () => { use.enable((state.selected > -1 && state.selected < FLAT_PRESETS.length) || state.text.length > 1); };
      list = g.slotList({ top: 80, bottom: h - 37, slotHeight: 24, width: 220, scrollbarX: c + 124 }, {
        count: FLAT_PRESETS.length,
        scroll: state.scroll,
        selected: (i) => i === state.selected,
        entry(i, y, parent, x) {
          const p = FLAT_PRESETS[i];
          addIcon(g, parent, x, y, ORIGINAL_ITEMS[p.icon] ?? fromOriginal(p.icon, 0)?.id ?? null, 0, icon);
          g.text(p.name, x + 18 + 5, y + 6, { parent });
        },
        click(i) {
          state.selected = i;
          state.text = FLAT_PRESETS[i].string;
          field.value = state.text;
          list.refresh();
          sync();
        },
      });
      g.text(FLAT_LANG['createWorld.customize.presets.title'], c, 8, { center: true });
      g.text(FLAT_LANG['createWorld.customize.presets.share'], 50, 30, { color: COLOR.label });
      g.text(FLAT_LANG['createWorld.customize.presets.list'], 50, 70, { color: COLOR.label });
      field = g.field(btn(50, 40, w - 100), { value: state.text, maxLength: 1230, focus: true, input: (v) => { state.text = v; sync(); } });
      use = g.button(btn(c - 155, h - 28), FLAT_LANG['createWorld.customize.presets.select'], () => { apply(state.text); show(back); });
      g.button(btn(c + 5, h - 28), t('gui.cancel'), () => show(back));
      sync();
    },
  };
}
