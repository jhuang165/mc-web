// Reads the non-container GUI constants of batch 25 straight from the unchanged 1.7.10 client JAR (javap -c -p -constants; nothing is
// executed) and writes public/research/gui-screens-reference.json. Every value is taken from a numeric-constant run (int, float and
// double constants in bytecode order) that is asserted to occur contiguously in the named method, so a wrong guess fails here instead
// of being recorded. src/gui-screens.test.js replays the JSON against sign-layout.js, modal-dialogs.js, achievements-ui.js,
// menu-ui.js and loading-screen.js.
// Classes (obfuscated, joined-1.7.10.srg): bfx GuiEditSign, bmr TileEntitySignRenderer, beh GuiAchievement, bdc GuiGameOver,
// bcw GuiYesNo, bcd GuiTextField, bfh GuiCommandBlock, bdh GuiErrorScreen, bdx GuiSelectWorld, bdt GuiScreenWorking.
// Needs a JDK (javap) and minecraft-1.7.10.jar in tools/research or MC_RESEARCH.
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
const jarSha1 = createHash('sha1').update(readFileSync(jar)).digest('hex');
assert.equal(jarSha1, 'e80d9b3bf5085002218d4be59e668bac718abbc6');

const NAMES = { bfx: 'GuiEditSign', bmr: 'TileEntitySignRenderer', beh: 'GuiAchievement', bdc: 'GuiGameOver', bcw: 'GuiYesNo', bcd: 'GuiTextField', bfh: 'GuiCommandBlock', bdh: 'GuiErrorScreen', bdx: 'GuiSelectWorld', bdt: 'GuiScreenWorking' };
const texts = {}, consts = {}, sha256 = {};
for (const cls of Object.keys(NAMES)) {
  const txt = execFileSync('javap', ['-c', '-p', '-constants', '-cp', jar, cls], { encoding: 'utf8', maxBuffer: 1 << 26 });
  sha256[cls] = createHash('sha256').update(txt).digest('hex');
  const methods = {}, bodies = {};
  let cur = null;
  for (const line of txt.split('\n')) {
    const m = /^ {2}(?:public |protected |private |static |final |abstract |synchronized )*(?:[\w.$[\]]+ )?([\w$<>]+\([^)]*\));/.exec(line);
    if (m) { cur = m[1]; methods[cur] = []; bodies[cur] = ''; continue; }
    if (!cur) continue;
    bodies[cur] += line + '\n';
    let k;
    if ((k = /\b[ifdl]const_(m1|\d)\b/.exec(line))) methods[cur].push(k[1] === 'm1' ? -1 : +k[1]);
    else if ((k = /\b[bs]ipush\s+(-?\d+)/.exec(line))) methods[cur].push(+k[1]);
    else if ((k = /\bldc(?:2_w|_w)?\s+#\d+\s+\/\/ (?:int|float|double|long) (-?[\d.E-]+)[fdl]?\b/.exec(line))) methods[cur].push(+k[1]);
  }
  consts[cls] = methods; texts[cls] = bodies;
}
/** The contiguous run `seq` in cls.method's numeric constants (asserted); returns it. */
function run(cls, method, seq) {
  const all = consts[cls][method];
  assert.ok(all, `${cls}.${method} missing`);
  for (let i = 0; i + seq.length <= all.length; i++) if (seq.every((v, j) => all[i + j] === v)) return seq;
  assert.fail(`${cls}.${method}: run ${JSON.stringify(seq)} not found in ${JSON.stringify(all)}`);
}
/** `first` appears before `second` in the method's bytecode text. */
function before(cls, method, first, second) {
  const body = texts[cls][method], a = body.indexOf(first), b = body.indexOf(second, a + 1);
  assert.ok(a >= 0 && b >= 0, `${cls}.${method}: ${first} before ${second}`);
  return true;
}
const hex = (n) => '0x' + (n >>> 0).toString(16).toUpperCase().padStart(8, '0');

// GuiEditSign.drawScreen: title at (w/2, 40) white; glTranslatef(w/2, 0, 50); glScalef(-93.75) x3; glRotatef(180, 0, 1, 0); the
// block turn (meta * 360 / 16 standing; 180 / 90 / -90 for wall metadata 2 / 4 / 5) and glTranslatef(0, -1.0625, 0) on both branches;
// the edited line is set while updateCounter / 6 % 2 == 0; the renderer runs at (-0.5, -0.75, -0.5) with partial 0.
const S = 'a(int, int, float)';
run('bfx', S, [0, 2, 40, 16777215, 2, 0, 50, 93.75, 180, 0, 1, 0]);
run('bfx', S, [360, 16, 0, 1, 0, 0, -1.0625, 0]);
run('bfx', S, [0, 2, 180, 4, 90, 5, -90, 0, 1, 0, 0, -1.0625, 0]);
run('bfx', S, [6, 2, -0.5, -0.75, -0.5, 0, -1]);
before('bfx', S, 'glTranslatef', 'glScalef'); before('bfx', S, 'glScalef', 'glRotatef'); before('bfx', S, 'glPopMatrix', 'Method bdw.a:(IIF)V');
run('bfx', 'b()', [0, 2, 100, 4, 120]); // Done at (w/2 - 100, h/4 + 120)
run('bfx', 'e()', [1]); // updateScreen: ++updateCounter
// TileEntitySignRenderer: f1 = 0.6666667; translate(x + 0.5, y + 0.75 f1, z + 0.5); wall translate(0, -0.3125, -0.4375); text scale
// 0.016666668 f1 after translate(0, 0.5 f1, 0.07 f1); lines j * 10 - 4 * 5.
const R = 'a(apm, double, double, double, float)';
run('bmr', R, [0.6666667, 0.5, 0.75, 0.5]);
run('bmr', R, [-0.3125, -0.4375]);
run('bmr', R, [0.016666668, 0, 0.5, 0.07]);
run('bmr', R, [2, 10, 5]);

// GuiAchievement: get = (achievement.get, name), hint = (name, description) at systemTime + 2500; draw: (now - start) / 3000, the
// permanent hint clamped at 0.5; e = d * 2, mirrored above 1, e * 4, 1 - e, clamped at 0, squared twice; x = width - 160,
// y = -(int)(e * 36); achievement_background (96, 202) 160 x 32; hint: drawSplitString(desc, x + 30, y + 7, 120, -1); get: title at
// (x + 30, y + 7) 0xFFFFFF00 and name at (x + 30, y + 18) 0xFFFFFFFF (drawString without shadow); the icon at (x + 8, y + 8).
run('beh', 'b(pb)', [2500]);
const slide = run('beh', 'a()', [3000, 0, 1, 0, 0.5, 0.5, 2929, 0, 2, 1, 2, 4, 1, 0, 0, 160, 0, 36, 1, 1, 1, 1, 3553, 2896, 96, 202, 160, 32]);
const hintText = run('beh', 'a()', [30, 7, 120, -1]);
const getText = run('beh', 'a()', [30, 7, -256, 30, 18, -1]);
run('beh', 'a()', [8, 8]);
before('beh', 'a()', 'Method bbu.b:(Ljava/lang/String;III)I', 'Method bny.b:(Lbbu;Lbqf;Ladd;II)V');
assert.ok(/String textures\/gui\/achievement\/achievement_background\.png/.test(texts.beh['<clinit>()'] ?? Object.values(texts.beh).join('')));
run('beh', 'c()', [1000, 3000]); // glOrtho(0, scaledWidth, scaledHeight, 0, 1000, 3000) over the ScaledResolution

// GuiGameOver.updateScreen: ++counter == 20 enables every button; initGui ends by disabling every button and never stores the counter.
run('bdc', 'e()', [1, 20, 1]);
assert.ok(!/putfield\s+#\d+\s+\/\/ Field a:I/.test(texts.bdc['b()']), 'GuiGameOver.initGui does not reset the counter');
run('bdc', 'b()', [0]);
// GuiYesNo: setButtonDelay(n) stores n and disables the buttons; updateScreen enables them when --counter reaches 0.
run('bcw', 'b(int)', [0]);
run('bcw', 'e()', [1, 1]);
before('bcw', 'e()', 'isub', 'ifne');

// GuiTextField: enabledColor 0xE0E0E0 and disabledColor 0x707070 (constructor), drawTextBox picks one by isEnabled; GuiCommandBlock
// disables the Previous Output field with setEnabled(false).
const tfColors = run('bcd', 'bcd(bbu, int, int, int, int)', [14737632, 7368816]);
before('bcd', 'f()', 'Field p:Z', 'Field u:I');
assert.ok(/iconst_0\s*\n\s*\d+: invokevirtual\s+#\d+\s+\/\/ Method bcd\.c:\(Z\)V/.test(texts.bfh['b()']), 'GuiCommandBlock: output field setEnabled(false)');

// GuiErrorScreen: gradient 0xFF402020 -> 0xFF501010, title y 90, message y 110, Cancel at (w/2 - 100, 140); GuiSelectWorld opens it
// with "Unable to load worlds" when loadSaves throws.
const err = run('bdh', S, [0, 0, -12574688, -11530224, 2, 90, 16777215, 2, 110, 16777215]);
run('bdh', 'b()', [0, 2, 100, 140]);
assert.ok(Object.values(texts.bdx).some((b) => /String Unable to load worlds[\s\S]*?bdh\."<init>"/.test(b)), 'GuiSelectWorld -> GuiErrorScreen');
// GuiScreenWorking: title at (w/2, 70), "<message> <progress>%" at (w/2, 90).
run('bdt', S, [2, 70, 16777215]);
run('bdt', S, [2, 90, 16777215]);

// Derived GuiEditSign geometry (GUI px about x = w/2): the board and stick rectangles under the transforms above.
const f = Math.fround, f1 = f(0.6666667), scale = 93.75, unit = scale * f1 * 0.0625;
const signGeometry = (standing) => {
  const Y = -1.0625 + f(-0.75 + f(0.75 * f1)) + (standing ? 0 : -0.3125), oy = -scale * Y;
  const box = (x, y, w, h) => ({ x: unit * x, y: oy + unit * y, w: unit * w, h: unit * h });
  return { origin: oy, board: box(-12, -14, 24, 12), stick: standing ? box(-1, -2, 2, 14) : null, textY: oy - scale * f(0.5 * f1), textScale: scale * f(f(0.016666668) * f1) };
};

const out = {
  source: 'javap -c -p -constants of the unchanged 1.7.10 client jar (bytecode-read, nothing executed); tools/verify-gui-screens.mjs',
  jarSha1, classes: NAMES, classSha256: sha256,
  editSign: { titleY: 40, done: ['w/2-100', 'h/4+120'], translate: ['w/2', 0, 50], scale: -93.75, rotateY: 180, lift: -1.0625, tile: [-0.5, -0.75, -0.5], blinkDivisor: 6, standing: signGeometry(true), wall: signGeometry(false) },
  achievementToast: { windowMs: slide[0], hintDelayMs: 2500, hintClamp: 0.5, curve: 'e = 2d (2 - 2d above 1); e = max(0, 1 - 4e); e = e^4; y = -(int)(e * 36)', width: 160, height: 32, slide: 36, texture: { path: 'textures/gui/achievement/achievement_background.png', u: 96, v: 202, w: 160, h: 32 }, icon: [8, 8], hint: { x: hintText[0], y: hintText[1], wrap: hintText[2], color: hex(hintText[3]) }, get: { title: [getText[0], getText[1], hex(getText[2])], name: [getText[3], getText[4], hex(getText[5])], shadow: false }, x: 'scaledWidth - 160' },
  gameOver: { delayTicks: 20, counterResetInInit: false },
  yesNo: { delayDecrementsTo: 0, initGuiEnables: true },
  textField: { enabledColor: hex(tfColors[0]).replace('0x00', '0x'), disabledColor: hex(tfColors[1]).replace('0x00', '0x'), commandBlockOutputEnabled: false },
  errorScreen: { gradient: [hex(err[2]), hex(err[3])], titleY: err[5], messageY: err[8], cancel: ['w/2-100', 140], selectWorldTitle: 'Unable to load worlds' },
  workingScreen: { titleY: 70, lineY: 90 },
};
const file = path.join(root, '../public/research/gui-screens-reference.json');
writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
console.log('ok', path.relative(process.cwd(), file));
