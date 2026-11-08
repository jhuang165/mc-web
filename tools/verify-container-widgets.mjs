// Reads the widget geometry of the 1.7.10 container screens straight from the unchanged client JAR (javap -c -p -constants; nothing
// is executed) and writes it to the "widgets" section of public/research/container-screens-reference.json. Each value is taken from an
// integer-constant run that is asserted to occur, in order and contiguously, in the named method, so a wrong guess fails here instead of
// being recorded. src/container-widgets.test.js replays the JSON against src/container-widgets.js.
// Classes (obfuscated names, joined-1.7.10.srg): bex GuiContainer, bey GuiRepair, bcd GuiTextField, bfq GuiEnchantment, bfv GuiMerchant,
// bfw GuiMerchant.MerchantButton, bez GuiBeacon, bfd/bfc/bfb/bfa GuiBeacon.Button/PowerButton/ConfirmButton/CancelButton,
// bft GuiScreenHorseInventory, bfe GuiScreenBook. Needs a JDK (javap) and tools/research/minecraft-1.7.10.jar (or MC_RESEARCH).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const root = path.dirname(fileURLToPath(import.meta.url));
const dirs = [process.env.MC_RESEARCH, path.join(root, 'research'), path.join(root, '../../tools/research')].filter(Boolean);
const research = dirs.find((d) => existsSync(path.join(d, 'minecraft-1.7.10.jar')));
if (!research) throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar = path.join(research, 'minecraft-1.7.10.jar');
assert.equal(createHash('sha1').update(readFileSync(jar)).digest('hex'), 'e80d9b3bf5085002218d4be59e668bac718abbc6');

const NAMES = { bex: 'GuiContainer', bey: 'GuiRepair', bcd: 'GuiTextField', bfq: 'GuiEnchantment', bfv: 'GuiMerchant', bfw: 'GuiMerchant.MerchantButton', bez: 'GuiBeacon', bfd: 'GuiBeacon.Button', bfc: 'GuiBeacon.PowerButton', bfb: 'GuiBeacon.ConfirmButton', bfa: 'GuiBeacon.CancelButton', bft: 'GuiScreenHorseInventory', bfe: 'GuiScreenBook' };
const texts = {}, consts = {};
for (const cls of Object.keys(NAMES)) {
  const txt = execFileSync('javap', ['-c', '-p', '-constants', '-cp', jar, cls], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const methods = {}, bodies = {};
  let cur = null;
  for (const line of txt.split('\n')) {
    const m = /^ {2}(?:public |protected |private |static |final |abstract |synchronized )*(?:[\w.$[\]]+ )?([\w$<>]+\([^)]*\));/.exec(line);
    if (m) { cur = m[1]; methods[cur] = []; bodies[cur] = ''; continue; }
    if (!cur) continue;
    bodies[cur] += line + '\n';
    let k;
    if ((k = /\biconst_(m1|\d)\b/.exec(line))) methods[cur].push(k[1] === 'm1' ? -1 : +k[1]);
    else if ((k = /\b[bs]ipush\s+(-?\d+)/.exec(line))) methods[cur].push(+k[1]);
    else if ((k = /\bldc(?:_w)?\s+#\d+\s+\/\/ int (-?\d+)/.exec(line))) methods[cur].push(+k[1]);
  }
  consts[cls] = methods; texts[cls] = bodies;
}
/** The contiguous run `seq` in cls.method's integer constants (asserted); returns it. */
function run(cls, method, seq) {
  const all = consts[cls][method];
  assert.ok(all, `${cls}.${method} missing`);
  for (let i = 0; i + seq.length <= all.length; i++) if (seq.every((v, j) => all[i + j] === v)) return seq;
  assert.fail(`${cls}.${method}: run ${JSON.stringify(seq)} not found in ${JSON.stringify(all)}`);
}
/** `first` appears before `second` in the method's bytecode text. */
function before(cls, method, first, second) {
  const body = texts[cls][method], a = body.indexOf(first), b = body.indexOf(second);
  assert.ok(a >= 0 && b >= 0 && a < b, `${cls}.${method}: ${first} before ${second}`);
  return true;
}
const hex = (n) => '0x' + (n >>> 0).toString(16).toUpperCase().padStart(8, '0');

// GuiContainer: hover gradient in drawScreen after the slot loop (RGB-only colour mask), drag rect inside drawSlot before the item;
// isPointInRegion (c(IIIIII)) pads the 16 x 16 slot box by 1 on every side.
const [, , hoverArgb] = run('bex', 'a(int, int, float)', [16, 16, -2130706433, -2130706433]);
const [, , dragArgb] = run('bex', 'a(aay)', [16, 16, -2130706433]);
before('bex', 'a(aay)', '// int -2130706433', 'Method bny.b:(Lbbu;Lbqf;Ladd;II)V');
before('bex', 'a(int, int, float)', 'glColorMask', '// int -2130706433');
run('bex', 'a(aay, int, int)', [16, 16]);
run('bex', 'c(int, int, int, int, int, int)', [1, 1, 1, 1, 1, 0]);
before('bex', 'a(aay)', 'Set.size:()I', 'Method bny.b:(Lbbu;Lbqf;Ladd;II)V');

// GuiRepair
const field = run('bey', 'b()', [62, 24, 103, 12, -1, -1, 0, 40]);
const fg = run('bey', 'b(int, int)', [60, 6, 4210752, 8453920, 1]);
run('bey', 'b(int, int)', [40, 0, 16736352]);
const cost = run('bey', 'b(int, int)', [-16777216, 16579836, 2, -16777216, 8, 67, 3, 2, 7, 10, -16777216, 2, 1, 8, 9, -12895429, 1, 1, 1, 1]);
const bg = run('bey', 'a(float, int, int)', [59, 20, 0, 0, 0, 16, 110, 16, 0, 1, 2, 99, 45, 0, 28, 21]);
// GuiTextField.drawTextBox: background frame/fill, the 6-tick blink, (x + 4, y + (h - 8) / 2) with a background, the 0xFFD0D0D0 bar.
const tf = run('bcd', 'f()', [-6250336, -16777216, 1, 0, 6, 2, 1, 0, 4, 8, 2]);
const bar = run('bcd', 'f()', [-3092272]);

// GuiEnchantment.drawGuiContainerBackgroundLayer: three 108 x 19 buttons at (60, 14 + 19 i).
const off = run('bfq', 'a(float, int, int)', [60, 14, 19, 0, 185, 108, 19, 6839882]);
const poor = run('bfq', 'a(float, int, int)', [60, 14, 19, 0, 185, 108, 19, 62, 16, 19, 104, 16711422, 1, 4226832, 62, 104, 16, 19, 7]);
const hover = run('bfq', 'a(float, int, int)', [60, 14, 19, 0, 204, 108, 19, 16777088]);
const normal = run('bfq', 'a(float, int, int)', [60, 14, 19, 0, 166, 108, 19, 62, 16, 19, 104, 8453920, 62, 104, 16, 19, 7]);
const clickBox = run('bfq', 'a(int, int, int)', [3, 60, 14, 19, 108, 19]);
const enchantTitle = run('bfq', 'b(int, int)', [12, 5, 4210752]);
const blits = (texts.bfq['a(float, int, int)'].match(/Method b:\(IIIIII\)V/g) || []).length;
assert.equal(blits, 5, 'GuiEnchantment background: the sheet plus the off, poor, hover and normal button blits, no lapis/level icons');

// GuiMerchant
const next = run('bfv', 'b()', [120, 27, 24, 1, 1]);
const prev = run('bfv', 'b()', [36, 19, 24, 1, 0]);
const mbtn = run('bfw', 'bfw(int, int, int, boolean)', [12, 19]);
const mtex = run('bfw', 'a(bao, int, int)', [176, 2]);
const cross = run('bfv', 'a(float, int, int)', [83, 21, 212, 0, 28, 21, 83, 51, 212, 0, 28, 21]);
const offers = run('bfv', 'a(int, int, float)', [36, 24, 16, 16, 62, 24, 16, 16, 120, 24, 16, 16]);
const mtitle = run('bfv', 'b(int, int)', [2, 2, 6, 4210752]);

// GuiBeacon
const bsize = run('bez', 'bez(yx, aoq)', [230, 219]);
const ok = run('bez', 'b()', [164, 107, -2, 190, 107]);
const prim = run('bez', 'e()', [22, 1, 2, 0, 8, 76, 24, 2, 22, 25]);
const sec = run('bez', 'e()', [8, 167, 24, 2, 47]);
const pay = run('bez', 'a(float, int, int)', [42, 109, 42, 22, 109, 42, 44, 109, 42, 66, 109]);
const blabels = run('bez', 'b(int, int)', [62, 10, 14737632, 0, 169, 10, 14737632]);
const bbtn = run('bfd', 'bfd(int, int, int, bqx, int, int)', [22, 22]);
const bdraw = run('bfd', 'a(bao, int, int)', [219, 0, 2, 1, 3, 2, 2, 18, 18]);
const picon = run('bfc', 'bfc(bez, int, int, int, int, int)', [8, 18, 198, 8, 18]);
const cancel = run('bfa', 'bfa(bez, int, int, int)', [112, 220]);
const confirm = run('bfb', 'bfb(bez, int, int, int)', [90, 220]);

// GuiScreenHorseInventory
const horse = run('bft', 'a(float, int, int)', [79, 17, 0, 90, 54, 7, 35, 0, 54, 18, 18, 51, 60, 17, 51, 75, 50]);
const horseLabels = run('bft', 'b(int, int)', [8, 6, 4210752, 0, 8, 96, 2, 4210752]);

// GuiScreenBook: 192 x 192 page at ((width - 192) / 2, 2); buttons at width / 2 - 100 and width / 2 + 2, y 4 + 192.
const bookSize = run('bfe', 'bfe(yz, add, boolean)', [192, 192]);
const bookButtons = run('bfe', 'b()', [3, 2, 100, 4, 98, 20, 0, 0, 2, 2, 4, 98, 20]);
const bookDone = run('bfe', 'b()', [0, 2, 100, 4, 200, 20]);
const bookDraw = run('bfe', 'a(int, int, float)', [2, 2, 0, 0]);

const sha = (c) => createHash('sha256').update(execFileSync('unzip', ['-p', jar, c + '.class'], { maxBuffer: 1 << 24 })).digest('hex');
const widgets = {
  evidence: 'bytecode-read: integer-constant runs asserted in javap -c -p -constants output of the unchanged 1.7.10 jar by tools/verify-container-widgets.mjs (nothing executed); class sha256 below',
  classes: Object.fromEntries(Object.entries(NAMES).map(([c, n]) => [c, { name: n, sha256: sha(c) }])),
  slot: {
    hover: { argb: hoverArgb, hex: hex(hoverArgb), size: 16, draw: 'drawGradientRect(x, y, x + 16, y + 16) after every slot is drawn, colour mask RGB only, over the item and its count' },
    drag: { argb: dragArgb, hex: hex(dragArgb), size: 16, draw: 'drawRect inside drawSlot before renderItemAndEffectIntoGUI (under the item), for a slot taking part in a split of two or more slots; with one dragged slot drawSlot returns early and that slot draws nothing' },
    hitPad: 1, hitSize: 16, hit: 'isPointInRegion(x, y, 16, 16): x - 1 <= mx < x + 16 + 1, same for y; first matching slot in list order',
  },
  anvil: {
    title: { x: fg[0], y: fg[1], color: fg[2] },
    field: { x: field[0], y: field[1], width: field[2], height: field[3], textColor: field[4], disabledTextColor: field[5], background: field[6] === 1, maxLength: field[7], shadow: true, blinkTicks: tf[4], blinkPeriod: tf[5], cursorBar: bar[0], cursorBarHex: hex(bar[0]), backgroundTextOffset: { x: tf[8], heightLess: tf[9], div: tf[10] } },
    cost: { color: fg[3], expensiveAt: 40, tooExpensiveColor: 16736352, shadowMask: cost[1], shadowShift: cost[2], right: cost[4], y: cost[5], copies: [[0, 1], [1, 0], [1, 1]],
      unicodeRects: [{ dx0: -cost[6], dy0: -cost[7], xSizeLess: cost[8], dy1: cost[9], color: cost[10] }, { dx0: -cost[11], dy0: -cost[12], xSizeLess: cost[13], dy1: cost[14], color: cost[15] }],
      rule: 'cost > 0: green "container.repair.cost"; cost >= 40 and not creative: red "container.repair.expensive" (drawn without an output); else no output: nothing; output not takeable: red' },
    nameBackground: { x: bg[0], y: bg[1], u: bg[2], vWithInput: 166, vEmpty: 166 + bg[5], width: bg[6], height: bg[7] },
    error: { x: bg[11], y: bg[12], u: 176, v: bg[13], width: bg[14], height: bg[15], rule: '(slot 0 or slot 1 filled) and slot 2 empty' },
  },
  enchanting: {
    title: { x: enchantTitle[0], y: enchantTitle[1], color: enchantTitle[2] },
    button: { x: off[0], y: off[1], pitch: off[2], width: off[5], height: off[6], u: off[3] },
    clickBox: { x: clickBox[1], y: clickBox[2], pitch: clickBox[3], width: clickBox[4], height: clickBox[5] },
    v: { off: off[4], poor: poor[4], hover: hover[4], normal: normal[4] },
    name: { dx: poor[7] - off[0], dy: poor[8] - off[1], width: poor[10], color: off[7], hoverColor: hover[7], poorColorMask: poor[11], poorColorShift: poor[12] },
    level: { right: poor[14] + poor[15] - off[0], dy: poor[16] - off[1] + poor[18], color: normal[11], poorColor: poor[13], shadow: true },
    rule: 'level 0: v 185 only; experienceLevel < level and not creative: v 185, name (0x685E4A & 0xFEFEFE) >> 1, level 0x407F10; else v 204 under the mouse (name 0xFFFF80) or v 166 (name 0x685E4A), level 0x80FF20',
    icons: 'none: five drawTexturedModalRect calls (the sheet and the off, poor, hover, normal button blits); the 1.8 lapis/level icons do not exist in 1.7.10',
  },
  merchant: {
    title: { y: mtitle[2], color: mtitle[3], centered: true },
    next: { x: next[0] + next[1], y: next[2] - next[3], forward: next[4] === 1 },
    previous: { x: prev[0] - prev[1], y: prev[2] - prev[3], forward: prev[4] === 1 },
    button: { width: mbtn[0], height: mbtn[1], u: mtex[0], hoverU: mtex[0] + mbtn[0], disabledU: mtex[0] + mtex[1] * mbtn[0], backwardV: mbtn[1] },
    cross: [{ x: cross[0], y: cross[1] }, { x: cross[6], y: cross[7] }], crossUV: { u: cross[2], v: cross[3], width: cross[4], height: cross[5] },
    offers: { buy: [offers[0], offers[1]], buyB: [offers[4], offers[5]], sell: [offers[8], offers[9]], size: offers[2] },
  },
  beacon: {
    xSize: bsize[0], ySize: bsize[1],
    confirm: { x: ok[0], y: ok[1], u: confirm[0], v: confirm[1] }, cancel: { x: ok[3], y: ok[4], u: cancel[0], v: cancel[1] },
    button: { width: bbtn[0], height: bbtn[1], v: bdraw[0], states: 'disabled u + 2w, selected u + w, hover u + 3w', icon: { dx: bdraw[5], dy: bdraw[6], size: bdraw[7] } },
    primary: { x: prim[5], step: prim[6], y: prim[8], tierStep: prim[9], buttonWidth: prim[0], gap: prim[2] },
    secondary: { x: sec[1], step: sec[2], y: sec[4] },
    powerIcon: { columns: picon[0], size: picon[1], v: picon[2] },
    payment: { x: pay[0], y: pay[1], step: pay[3] },
    labels: [{ centerX: blabels[0], y: blabels[1], color: blabels[2] }, { centerX: blabels[4], y: blabels[5], color: blabels[6] }],
    tooltips: 'drawCreativeTabHoveringText: power name (+ " II" on the secondary row except regeneration), gui.done, gui.cancel; disabled buttons too',
  },
  horse: {
    labels: [{ x: horseLabels[0], y: horseLabels[1], color: horseLabels[2] }, { x: horseLabels[4], y: '-96 + 2 from ySize', color: horseLabels[7] }],
    chest: { x: horse[0], y: horse[1], u: horse[2], v: 166, width: horse[3], height: horse[4] },
    armor: { x: horse[5], y: horse[6], u: horse[7], v: 166 + horse[8], width: horse[9], height: horse[10] },
    preview: { x: horse[11], y: horse[12], scale: horse[13], mouseX: horse[14], mouseY: horse[15] - horse[16] },
  },
  book: {
    width: bookSize[0], height: bookSize[1], top: bookDraw[1],
    left: '(width - 192) / 2 of the ScaledResolution width (no fixed box)',
    buttons: { left: -bookButtons[2], right: bookButtons[9], y: bookButtons[3] + bookSize[1], width: bookButtons[4], doneWidth: bookDone[4], height: bookButtons[5] },
  },
};
// Its own file next to container-screens-reference.json (whose screens / native positions this does not rewrite).
const file = path.join(root, '../public/research/container-widgets-reference.json');
writeFileSync(file, JSON.stringify({ source: 'tools/verify-container-widgets.mjs: javap -c -p of the unchanged 1.7.10 client jar (sha1 e80d9b3b...), integer runs asserted per method', widgets }, null, 2) + '\n');
console.log(`container widgets: ${Object.keys(NAMES).length} classes read; hover ${hex(hoverArgb)}, anvil field ${field.slice(0, 4)}, enchant rows v ${[off[4], hover[4], normal[4]]}, merchant arrows ${widgets.merchant.next.x}/${widgets.merchant.previous.x}`);
