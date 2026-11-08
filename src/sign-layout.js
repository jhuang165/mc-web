// TileEntitySignRenderer (bmr), GuiEditSign (bfx) and ModelSign (bhz) constants, from public/research/sign-reference.json
// "bytecode.render" and "bytecode.gui" (javap constants of the unchanged client jar).
export const SIGN_SCALE = Math.fround(0.6666667); // TileEntitySignRenderer: f1 = 2 / 3
export const SIGN_RENDER = Object.freeze({
  scale: SIGN_SCALE,
  // Standing: translate(x + 0.5, y + 0.75 * scale, z + 0.5), rotate -(meta * 360 / 16). Wall: angle 180, 0, 90, -90 for
  // metadata 2, 3, 4, 5 and translate (0, -0.3125, -0.4375), the stick hidden.
  wallAngle: Object.freeze({ 2: 180, 3: 0, 4: 90, 5: -90 }),
  wallTranslate: Object.freeze([0, -0.3125, -0.4375]),
  // ModelSign: the board box(-12, -14, -1, 24, 12, 2) at UV (0, 0) and the stick box(-1, -2, -1, 2, 14, 2) at UV (0, 14),
  // model scale 0.0625, texture 64 x 32.
  board: Object.freeze({ box: [-12, -14, -1, 24, 12, 2], uv: [0, 0] }),
  stick: Object.freeze({ box: [-1, -2, -1, 2, 14, 2], uv: [0, 14] }),
  modelScale: 0.0625,
  textureSize: [64, 32],
  // Text: scale 0.016666668 * scale per font pixel, translate(0, 0.5 * scale, 0.07 * scale), line k at y = k * 10 - 4 * 5.
  textScale: Math.fround(0.016666668 * 0.6666667),
  textTranslate: Object.freeze([0, 0.5, 0.07]),
  lineSpacing: 10,
  maxDistanceSquared: 4096,
});
// GuiEditSign: the model is scaled 93.75 GUI pixels per block unit; the board is 24 model pixels wide.
export const signLayout = () => ({
  boardGui: 93.75,
  textGui: 0.016666668 * 0.6666667 * 93.75,
  lineSpacing: SIGN_RENDER.lineSpacing,
});

// GuiEditSign.drawScreen (bfx.a(int, int, float)), bytecode-read: glTranslatef(w / 2, 0, 50), glScalef(-93.75, -93.75, -93.75),
// glRotatef(180, 0, 1, 0), the block's own turn (meta * 360 / 16 standing; 180 / 90 / -90 / 0 for wall metadata 2 / 4 / 5 / 3, which
// TileEntitySignRenderer turns back), glTranslatef(0, -1.0625, 0), then the renderer at (-0.5, -0.75, -0.5). The GUI projection is
// orthographic, so a model point lands at (w / 2 + 93.75 X, -93.75 Y): the board is drawn face on, 93.75 x 46.875 GUI px, its top at
// y 68.36 for a standing sign and 97.66 for a wall sign (the renderer's extra -0.3125 drop), and the stick hangs below a standing one.
export const SIGN_GUI = Object.freeze({ translate: Object.freeze([0, 50]), scale: 93.75, lift: -1.0625, tile: Object.freeze([-0.5, -0.75, -0.5]) });
/** Rectangles relative to (w / 2, 0) in GUI px: board, stick (standing only), bounds; text: the font origin y and GUI px per font px. */
export function signGuiGeometry(standing) {
  const S = SIGN_GUI.scale, f1 = SIGN_SCALE, unit = S * f1 * SIGN_RENDER.modelScale; // GUI px per model pixel
  // Y of the sign origin: the lift, the tile offset plus the renderer's translate (y + 0.75 * f1), and the wall drop.
  const Y = SIGN_GUI.lift + Math.fround(SIGN_GUI.tile[1] + Math.fround(0.75 * f1)) + (standing ? 0 : SIGN_RENDER.wallTranslate[1]);
  const oy = -S * Y;
  // ModelSign boxes under glScalef(f1, -f1, -f1): model y grows down the screen, x to the right.
  const box = ([x, y, , w, h]) => ({ x: unit * x, y: oy + unit * y, w: unit * w, h: unit * h });
  const board = box(SIGN_RENDER.board.box), stick = standing ? box(SIGN_RENDER.stick.box) : null;
  const bottom = stick ? stick.y + stick.h : board.y + board.h;
  return {
    origin: oy, board, stick,
    bounds: { x: board.x, y: board.y, w: board.w, h: bottom - board.y },
    // glTranslatef(0, 0.5 * f1, 0.07 * f1) then glScalef(f4, -f4, f4) with f4 = 0.016666668 * f1; lines at k * 10 - 20 font px.
    text: { y: oy - S * Math.fround(0.5 * f1), scale: S * SIGN_RENDER.textScale, lineSpacing: SIGN_RENDER.lineSpacing },
  };
}
