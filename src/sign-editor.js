// GuiEditSign (bfx): the "Edit sign message" screen opened by placing a sign (and by nothing else: 1.7.10 has no
// right-click re-edit). Constants come from public/research/sign-reference.json "bytecode.gui" and, for where the sign sits on the
// screen, public/research/gui-screens-reference.json "editSign" (sign-layout.js signGuiGeometry): the title at y 40, the sign
// model scaled 93.75 GUI px per block unit and drawn face on (board 93.75 x 46.875 with its top at y 68.36 standing / 97.66 on a
// wall), text at 0.016666668 * 0.6666667 * 93.75 GUI px per font px on lines k * 10 - 20 about the board centre, Done below.
// Up / Down / Enter move the edited line (& 3), Backspace deletes, typed characters are filtered and cut at 15. The blink counter
// is GuiEditSign.updateScreen's (one per client tick, fed by the host's tick), and "> text <" is drawn while counter / 6 % 2 == 0.
import { SignEditModel, SIGN_TEXT, SIGN_POST, MAX_LINE } from './signs.js';
import { signGuiGeometry } from './sign-layout.js';
import { versioned } from './media-version.js';
import { drawFontString, onAtlasChange } from './sign-font.js';
import { getStringWidth } from './font-renderer.js';

const SIGN_TEXTURE = '/media/1.7.10/entity/sign.png';
const G = 8; // canvas pixels per GUI pixel (the board is 750 x 375 canvas pixels)

// Draw the sign as GuiEditSign does: the board's front face (texture 2,2 24 x 12), the stick below it for a standing
// sign, and the four lines; the edited line is "> text <" while the cursor blink is on (ticks / 6 % 2 == 0).
export function drawSignGui(ctx, model, { standing, blink, image }) {
  const S = signGuiGeometry(standing), o = S.bounds;
  const rect = (r) => [(r.x - o.x) * G, (r.y - o.y) * G, r.w * G, r.h * G];
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (image?.complete && image.naturalWidth) {
    ctx.drawImage(image, 2, 2, 24, 12, ...rect(S.board)); // BoardBox front face: u = 2, v = 2, 24 x 12
    if (S.stick) ctx.drawImage(image, 2, 16, 2, 14, ...rect(S.stick)); // stick front: u = 2, v = 16, 2 x 14
  } else {
    ctx.fillStyle = '#9c7f4e';
    ctx.fillRect(...rect(S.board));
  }
  // TileEntitySignRenderer text through the FontRenderer glyphs: colour 0, centred by getStringWidth (int division).
  const scale = S.text.scale * G, x0 = (-o.x * G) / scale, y0 = ((S.text.y - o.y) * G) / scale;
  for (let k = 0; k < 4; k++) {
    const text = k === model.line && blink ? `> ${model.lines[k]} <` : model.lines[k];
    if (text) drawFontString(ctx, text, x0 - Math.trunc(getStringWidth(text) / 2), y0 + k * S.text.lineSpacing - 2 * S.text.lineSpacing, scale, 0);
  }
}

// `host`: {show(title, canvas, { done, standing, tick, closed }), close(), markUnsaved()}; `signs` the Signs store; `tile` the tile.
export function openSignEditor(host, signs, tile, world) {
  const standing = world?.get?.(tile.x, tile.y, tile.z) === SIGN_POST, S = signGuiGeometry(standing);
  const model = new SignEditModel(tile.text), image = new Image();
  image.src = versioned(SIGN_TEXTURE);
  const canvas = document.createElement('canvas');
  canvas.id = 'sign-edit-canvas';
  canvas.width = Math.ceil(S.bounds.w * G);
  canvas.height = Math.ceil(S.bounds.h * G);
  canvas.style.cssText = `width:calc(${canvas.width / G}*var(--u));height:calc(${canvas.height / G}*var(--u));image-rendering:pixelated`;
  const ctx = canvas.getContext('2d');
  let ticks = 0, stopped = false;
  const save = () => { if (signs.update(tile.x, tile.y, tile.z, model.lines)) host.markUnsaved?.(); };
  const paint = () => drawSignGui(ctx, model, { standing, blink: Math.floor(ticks / 6) % 2 === 0, image });
  const stop = () => { if (stopped) return; stopped = true; offAtlas(); window.removeEventListener('keydown', onKey, true); };
  const finish = () => { save(); stop(); host.close(); };
  const onKey = (e) => {
    if (!canvas.isConnected) { stop(); return; }
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
  const offAtlas = onAtlasChange(paint);
  host.show(SIGN_TEXT.edit, canvas, {
    standing,
    done: () => finish(), // the Done button is the native GuiButton drawn by the host (GuiEditSign: gui.done at h/4 + 120)
    tick: () => { ticks++; paint(); }, // GuiEditSign.updateScreen: ++updateCounter
    closed: stop,
  });
  window.addEventListener('keydown', onKey, true);
  image.onload = paint;
  paint();
  return { model, stop, tick: () => { ticks++; paint(); } };
}
export { MAX_LINE };
