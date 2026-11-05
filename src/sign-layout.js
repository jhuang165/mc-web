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
