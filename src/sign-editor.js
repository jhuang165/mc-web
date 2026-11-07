// GuiEditSign (bfx): the "Edit sign message" screen opened by placing a sign (and by nothing else: 1.7.10 has no
// right-click re-edit). Constants come from public/research/sign-reference.json "bytecode.gui": the title at the top, the
// sign model scaled 93.75 (block units to GUI pixels) with the board 24 x 12 model pixels, text drawn at
// 0.016666668 * 0.6666667 * 93.75 GUI pixels per font pixel on lines k * 10 - 20 about the board centre, Done below.
// Up / Down / Enter move the edited line (& 3), Backspace deletes, typed characters are filtered and cut at 15.
import { SignEditModel, SIGN_TEXT, SIGN_POST, MAX_LINE } from './signs.js';
import { signLayout } from './sign-layout.js';
import { versioned } from './media-version.js';
import { drawFontString, onAtlasChange } from './sign-font.js';
import { getStringWidth } from './font-renderer.js';

const SIGN_TEXTURE = '/media/1.7.10/entity/sign.png';
const G = 4; // canvas pixels per GUI pixel

// Draw the sign as GuiEditSign does: the board's front face (texture 2,2 24 x 12), the stick below it for a standing
// sign, and the four lines; the edited line is "> text <" while the cursor blink is on (ticks / 6 % 2 == 0).
export function drawSignGui(ctx, model, { standing, blink, image }) {
  const L = signLayout(), w = L.boardGui * G, h = (L.boardGui / 2) * G;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (image?.complete && image.naturalWidth) {
    ctx.drawImage(image, 2, 2, 24, 12, 0, 0, w, h); // BoardBox front face: u = 2, v = 2, 24 x 12
    if (standing) ctx.drawImage(image, 2, 16, 2, 14, w / 2 - (2 * w) / 24 / 2, h, (2 * w) / 24, (14 * w) / 24); // stick front: u = 2, v = 16, 2 x 14
  } else {
    ctx.fillStyle = '#9c7f4e';
    ctx.fillRect(0, 0, w, h);
  }
  // TileEntitySignRenderer text through the FontRenderer glyphs: colour 0, centred by getStringWidth (int division).
  const scale = L.textGui * G;
  for (let k = 0; k < 4; k++) {
    const text = k === model.line && blink ? `> ${model.lines[k]} <` : model.lines[k];
    if (text) drawFontString(ctx, text, w / 2 / scale - Math.trunc(getStringWidth(text) / 2), h / 2 / scale + k * L.lineSpacing - 2 * L.lineSpacing, scale, 0);
  }
}

// `host`: {show(title, html), close(), markUnsaved()}; `signs` the Signs store; `tile` the tile being edited.
export function openSignEditor(host, signs, tile, world) {
  const standing = world?.get?.(tile.x, tile.y, tile.z) === SIGN_POST, L = signLayout();
  const model = new SignEditModel(tile.text), image = new Image();
  image.src = versioned(SIGN_TEXTURE);
  host.show(
    SIGN_TEXT.edit,
    `<div style="display:flex;flex-direction:column;align-items:center;gap:calc(8*var(--u))"><canvas id="sign-edit-canvas" width="${L.boardGui * G}" height="${(L.boardGui / 2 + (standing ? (14 * L.boardGui) / 24 : 0)) * G}" style="width:calc(${L.boardGui}*var(--u));image-rendering:pixelated"></canvas></div>`,
    { done: () => finish() }, // the Done button is the native GuiButton drawn by the host (GuiEditSign: gui.done at h/4 + 120)
  );
  const canvas = document.getElementById('sign-edit-canvas'), ctx = canvas.getContext('2d');
  let ticks = 0;
  const save = () => { if (signs.update(tile.x, tile.y, tile.z, model.lines)) host.markUnsaved?.(); };
  const paint = () => drawSignGui(ctx, model, { standing, blink: Math.floor(ticks / 6) % 2 === 0, image });
  const stop = () => { clearInterval(timer); offAtlas(); window.removeEventListener('keydown', onKey, true); };
  const timer = setInterval(() => { if (!document.getElementById('sign-edit-canvas')) { stop(); return; } ticks++; paint(); }, 50);
  const finish = () => { save(); stop(); host.close(); };
  const onKey = (e) => {
    if (!document.getElementById('sign-edit-canvas')) { stop(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const code = e.key === 'Escape' ? 1 : e.key === 'ArrowUp' ? 200 : e.key === 'ArrowDown' ? 208 : e.key === 'Enter' ? (e.code === 'NumpadEnter' ? 156 : 28) : e.key === 'Backspace' ? 14 : 0;
    if (!code && e.key.length !== 1) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (code) model.keyCode(code); else model.type(e.key);
    if (model.done) { finish(); return; }
    save();
    paint();
  };
  window.addEventListener('keydown', onKey, true);
  image.onload = paint;
  const offAtlas = onAtlasChange(paint);
  paint();
  return { model, stop };
}
export { MAX_LINE };
