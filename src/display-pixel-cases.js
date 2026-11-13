// Batch 57 (b57dp): the display cases rendered by tools/display-pixel/harness.js (headless Chrome) and replayed by display-pixel-b57.test.js. Shared so the recorded
// result file and the test agree on the case list.
export const FACE_NORMALS = Object.freeze({ up: [0, 1, 0], down: [0, -1, 0], east: [1, 0, 0], west: [-1, 0, 0], south: [0, 0, 1], north: [0, 0, -1] });
// [sky, block] light levels; the lightmap coordinates are 16 per level (block in the low half, sky in the high half)
export const LIGHTS = Object.freeze([[15, 0], [0, 15], [4, 4], [10, 2], [0, 0]]);
export const LIGHTMAPS = Object.freeze({ day: [1, 0, 0], dusk: [0.35, 0.5, 0] });
export const TEXEL = Object.freeze([200, 150, 100]);
export const LEAF_TINT = Object.freeze([0x48 / 255, 0xb5 / 255, 0x18 / 255]);
export const packedOf = (sky, block) => block * 16 + sky * 16 * 65536;
// Held item: three camera [pitch, yaw] in radians (FirstPerson.render takes the world camera); the normals are in eye space.
export const HELD_VIEWS = Object.freeze([[0, 0], [-0.5, 1.2], [0.7, -2.4], [-1.2, 3.0]]);

export function renderCases() {
  const cases = [];
  const add = (c) => cases.push(c);
  for (const [lname, lm] of Object.entries(LIGHTMAPS))
    for (const [sky, block] of LIGHTS)
      for (const [fname, normal] of Object.entries(FACE_NORMALS)) {
        const base = { texel: TEXEL, packed: packedOf(sky, block), normal, lightmap: lm, lname, fname, sky, block };
        add({ ...base, kind: "drop" }); // dropped item, item frame content, held-block quads: glColor 1
        add({ ...base, kind: "cart", brightness: 0.37 }); // minecart display block: glColor = tint * Entity.getBrightness
        add({ ...base, kind: "cart tinted", brightness: 0.37, tint: LEAF_TINT }); // a leaves display block (item tint 48b518)
        add({ ...base, kind: "item tinted", tint: LEAF_TINT }); // a leaves block item in a hand or on the ground
      }
  for (const [pitch, yaw] of HELD_VIEWS)
    for (const [fname, normal] of Object.entries(FACE_NORMALS))
      add({ kind: "held", texel: TEXEL, packed: packedOf(15, 0), normal, lightmap: LIGHTMAPS.day, lname: "day", fname, sky: 15, block: 0, view: { pitch, yaw } });
  return cases;
}
