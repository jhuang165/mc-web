// GuiIngame.renderPlayerStats (bbv.a(int, int)): the heart and food rows with the hurt blink, the low-health jiggle, the
// Regeneration wave, Poison / Wither textures, Absorption hearts and the saturation-0 hunger shake. The blink container
// is the sprite at U 25 instead of 16 while hurtResistantTime / 3 % 2 == 1 and hurtResistantTime >= 10.
// The "previous health" ghost hearts (U +54 / +63) need EntityLivingBase.prevHealth, which the client player never sets
// (only attackEntityFrom writes it, and that returns at once on a client world), so they never draw (damage-fx.md).
// Pure: returns sprite lists; heartsHtml / foodHtml turn them into the DOM the HUD CSS draws with icons.png.
import { JavaRandom } from "./java-random.js";

const f = Math.fround;
export const REGENERATION = 10, HUNGER_EFFECT = 17, POISON_EFFECT = 19, WITHER_EFFECT = 20;
const ceil = (v) => Math.ceil(f(v));

// Whether the white-outline container shows: the client player's hurtResistantTime.
export const heartsBlink = (hurtResistantTime) => hurtResistantTime >= 10 && Math.trunc(hurtResistantTime / 3) % 2 === 1;

// The hearts, from the last to the first as drawn (so the Random draws match): one record per heart index with the
// sprite (U, V in icons.png pixels) layers bottom to top, and the offset up (GUI pixels) from the base row.
export function heartLayout({ health, maxHealth = 20, absorption = 0, hurtResistantTime = 0, updateCounter = 0, poison = false, wither = false, regeneration = false, hardcore = false }, random = new JavaRandom(Math.imul(updateCounter, 312871))) {
  const blink = heartsBlink(hurtResistantTime), shownHealth = ceil(health), total = ceil(f(f(maxHealth + absorption) / 2));
  const rows = ceil(f(f(f(maxHealth + absorption) / 2) / 10)), spacing = Math.max(10 - (rows - 2), 3);
  const lift = (rows - 1) * spacing; // the armour row sits above the topmost row
  const wave = regeneration ? updateCounter % ceil(f(maxHealth + 5)) : -1;
  const base = poison ? 52 : wither ? 88 : 16, v = hardcore ? 45 : 0;
  let remaining = absorption;
  const hearts = [];
  for (let i = total - 1; i >= 0; i--) {
    const row = ceil(f((i + 1) / 10)) - 1;
    let up = row * spacing;
    if (shownHealth <= 4) up -= random.nextInt(2);
    if (i === wave) up += 2;
    const layers = [[16 + (blink ? 9 : 0), v]];
    if (remaining > 0) {
      layers.push([base + (remaining === absorption && absorption % 2 === 1 ? 153 : 144), v]);
      remaining = f(remaining - 2);
    } else {
      if (i * 2 + 1 < shownHealth) layers.push([base + 36, v]);
      if (i * 2 + 1 === shownHealth) layers.push([base + 45, v]);
    }
    hearts.push({ index: i, x: (i % 10) * 8, up, layers });
  }
  hearts.reverse();
  return { hearts, rows, lift, spacing };
}

// The food row (right to left from the right edge): the Hunger effect adds 36 to the fill U and uses the container at
// U 16 + 13 * 9; with saturation <= 0 every food icon jumps by nextInt(3) - 1 whenever updateCounter % (food * 3 + 1) == 0.
export function foodLayout({ food, saturation = 0, updateCounter = 0, hunger = false }, random = new JavaRandom(0)) {
  const icons = [];
  for (let i = 0; i < 10; i++) {
    let up = 0;
    if (saturation <= 0 && updateCounter % (food * 3 + 1) === 0) up = -(random.nextInt(3) - 1);
    const layers = [[16 + (hunger ? 13 * 9 : 0), 27]], fill = hunger ? 52 : 16;
    if (i * 2 + 1 < food) layers.push([fill + 36, 27]);
    if (i * 2 + 1 === food) layers.push([fill + 45, 27]);
    icons.push({ index: i, up, layers });
  }
  return icons;
}

// GuiIngame consumes one Random for both rows: seeded updateCounter * 312871, the hearts' jiggle first, then the food's.
export function vitalsLayout(state) {
  const random = new JavaRandom(Math.imul(state.updateCounter, 312871));
  const hearts = heartLayout(state, random), food = foodLayout(state, random);
  return { ...hearts, food };
}

const px = (v) => `calc(${v}*var(--u))`;
// Layers listed top first for CSS backgrounds.
const background = (layers) => {
  const top = layers.slice().reverse();
  return `background-image:${top.map(() => "url('/media/1.7.10/gui/icons.png')").join(",")};background-position:${top.map(([u, v]) => `${px(-u)} ${px(-v)}`).join(",")}`;
};
export const heartsHtml = (hearts) =>
  hearts.map((h) => `<span style="left:${px(h.x)};bottom:${px(h.up)};${background(h.layers)}"></span>`).join("");
export const foodHtml = (food) =>
  food.map((h) => `<span style="${h.up ? `transform:translateY(${px(-h.up)});` : ""}${background(h.layers)}"></span>`).join("");
