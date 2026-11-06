// GuiScreenBook drawn in the browser: the 192 x 192 textures/gui/book.png page, the native font wrap (books.js listFormatted),
// the next / previous page arrows (bff, 23 x 13 at u 0 / 23, v 192 forward / 205 back), Done, Sign, Sign and Close and Cancel.
// The state machine is books.js BookScreen; this file only places the pixels and routes keys. One GUI unit is var(--u).
import { BookScreen, BOOK_GUI as G, LANG, listFormatted, stringWidth, pageIndicator, byAuthor } from './books.js';
import { textHtml } from './menu-ui.js';

const u = (n) => `calc(${n}*var(--u))`;
const at = (x, y, w, h) => `left:${u(x)};top:${u(y)};width:${u(w)};height:${u(h)}`;
const text = (s, x, y, color = 0) => `<div class="mc-text flat" style="left:${u(x)};top:${u(y)}">${textHtml(s, color)}</div>`;
const lines = (s, x, y, w, color = 0) => listFormatted(s, w).map((l, i) => text(l, x, y + 9 * i, color)).join('');
const centred = (s, x, w, y, color = 0) => text(s, x + Math.trunc((w - stringWidth(s)) / 2), y, color);
const arrow = (id, x, y, forward) => `<button class="book-arrow" data-id="${id}" style="position:absolute;${at(x, y, 23, 13)};padding:0;border:0;background:url('/media/1.7.10/gui/book.png') 0 ${u(-(192 + (forward ? 0 : 13)))}/${u(256)} ${u(256)};image-rendering:pixelated;--hover:${u(-23)}"></button>`;
const button = (id, label, x, y, w, enabled = true) => `<button class="mc-button${enabled ? '' : ' disabled'}" data-id="${id}" style="${at(x, y, w, 20)};--hw:${Math.trunc(w / 2)}"><span class="mc-text" style="position:absolute;left:0;width:100%;text-align:center;top:${u(6)};color:var(--c);text-shadow:${u(1)} ${u(1)} 0 var(--cs)">${label}</span></button>`;

// `host`: { show(title, html), close(), markUnsaved() }; `options`: { stack, editable, playerName, send(channel, packet) }.
export function openBookUi(host, { stack, editable, playerName = 'Player', send }) {
  const width = 320, x = Math.trunc((width - G.width) / 2);
  const screen = new BookScreen({ item: stack, editable, playerName, send: (c, p) => { send?.(c, p); host.markUnsaved?.(); }, close: () => stop() });
  const root = () => document.getElementById('book-screen');
  let closed = false;
  const draw = () => {
    const el = root();
    if (!el) { stop(); return; }
    const b = screen.buttons(), w = G.width;
    let h = `<div class="book-page" style="position:absolute;${at(x, G.top, w, G.height)};background:url('/media/1.7.10/gui/book.png') 0 0/${u(256)} ${u(256)};image-rendering:pixelated"></div>`;
    if (screen.signing) {
      h += centred(LANG['book.editTitle'], x + G.textX, G.textWidth, G.titleLabelY) + centred(screen.titleText(), x + G.textX, G.textWidth, G.titleY);
      h += centred(byAuthor(playerName), x + G.textX, G.textWidth, G.authorY, 0x555555);
      h += lines(LANG['book.finalizeWarning'], x + G.textX, G.warningY, G.textWidth);
    } else {
      const indicator = pageIndicator(screen.page + 1, screen.total);
      h += text(indicator, x - stringWidth(indicator) + w - G.indicatorRight, G.top + G.indicatorY) + lines(screen.pageText(), x + G.textX, G.textY, G.textWidth);
    }
    if (b.next.visible) h += arrow(1, x + G.nextX, G.top + G.pageButtonY, true);
    if (b.prev.visible) h += arrow(2, x + G.prevX, G.top + G.pageButtonY, false);
    const cx = width / 2;
    if (editable) {
      if (b.sign.visible) h += button(3, LANG['book.signButton'], cx - 100, G.buttonY, 98);
      if (b.done.visible) h += button(0, LANG['gui.done'], cx + 2, G.buttonY, 98);
      if (b.finalize.visible) h += button(5, LANG['book.finalizeButton'], cx - 100, G.buttonY, 98, b.finalize.enabled);
      if (b.cancel.visible) h += button(4, LANG['gui.cancel'], cx + 2, G.buttonY, 98);
    } else h += button(0, LANG['gui.done'], cx - 100, G.buttonY, 200);
    el.innerHTML = h;
    for (const btn of el.querySelectorAll('[data-id]')) btn.onclick = () => { screen.click(Number(btn.dataset.id)); draw(); };
  };
  const stop = () => {
    if (closed) return;
    closed = true;
    clearInterval(timer);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('paste', onPaste, true);
    host.close();
  };
  const onPaste = (e) => { if (!root()) return; e.preventDefault(); screen.paste((e.clipboardData?.getData('text') ?? '').replace(/[\u0000-\u001f\u007f§]/g, '')); draw(); };
  const onKey = (e) => {
    if (!root()) { stop(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const code = e.key === 'Escape' ? 1 : e.key === 'Backspace' ? 14 : e.key === 'Enter' ? (e.code === 'NumpadEnter' ? 156 : 28) : 0;
    if (!code && e.key.length !== 1) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    screen.keyTyped(code ? '\0' : e.key, code);
    draw();
  };
  const timer = setInterval(() => { screen.tick(); if (editable) draw(); }, 50);
  host.show('', `<div id="book-screen" class="mc-screen" style="position:relative;width:${u(width)};height:${u(G.buttonY + 24)};margin:0 auto"></div>`);
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('paste', onPaste, true);
  draw();
  return screen;
}
