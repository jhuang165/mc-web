// Polish track evidence (batch 7). Writes public/research/polish-reference.json.
//  - bytecode: javap -c of the unchanged 1.7.10 client classes; the GL transform calls and float constants of the
//    wearable-head branch (RenderPlayer bop.a(blg, float)) and the map branch of ItemRenderer.
//  - probe: tools/probes/PolishProbe.java drives the original firework entity / NBT classes (see that file).
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const exec = promisify(execFile), root = path.dirname(fileURLToPath(import.meta.url)), exists = (p) => access(p).then(() => true, () => false);
const dirs = [process.env.MC_RESEARCH, path.join(root, 'research'), path.join(root, '../../tools/research')].filter(Boolean);
let research; for (const d of dirs) if (await exists(path.join(d, 'minecraft-1.7.10.jar'))) { research = d; break; }
if (!research) throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar = path.join(research, 'minecraft-1.7.10.jar');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'), 'e80d9b3bf5085002218d4be59e668bac718abbc6');
const javap = async (cls) => (await exec('javap', ['-c', '-p', '-constants', '-cp', jar, cls], { maxBuffer: 1 << 26 })).stdout;
// The GL calls (and the push instructions before each) of one method, in order. `ops` keeps constants, local loads and
// negations; calls other than GL11 and the skull renderer's render method reset the argument list.
function glCalls(text, header, from = 0, to = 1e9) {
  const start = text.indexOf(header); assert.ok(start >= 0, header);
  const end = text.indexOf('\n\n', start), body = text.slice(start, end < 0 ? undefined : end).split('\n');
  const calls = []; let ops = [];
  for (const line of body) {
    const m = line.match(/^\s*(\d+):\s+(\S+)(.*)$/); if (!m) continue;
    const pc = +m[1], op = m[2], rest = m[3];
    if (op.startsWith('fconst')) ops.push(op); else if (op === 'fneg' || op.startsWith('fload') || op === 'iconst_1' || op === 'iconst_0') ops.push(op + (op.startsWith('fload') ? rest.trim() : ''));
    else if (op === 'bipush' || op === 'sipush') ops.push('int ' + rest.trim());
    else if (op === 'ldc2_w') { const d = rest.match(/\/\/ double (-?[\d.E-]+)d/); if (d) ops.push('ldc2 ' + d[1]); }
    else if (op === 'dconst_0' || op === 'dconst_1') ops.push(op);
    else if (op === 'ldc') { const f = rest.match(/\/\/ float (-?[\d.]+)f/); if (f) ops.push('ldc ' + f[1]); }
    else if (op === 'invokestatic' || op === 'invokevirtual') {
      const gl = rest.match(/GL11\.(\w+)/), skull = rest.match(/Method bms\.a:/) || rest.match(/Method bmh\.a:\(DDDDD\)V/);
      if (gl || skull) { if (pc >= from && pc <= to) calls.push({ pc, call: gl ? gl[1] : rest.includes('bmh.a') ? 'Tessellator.addVertexWithUV' : 'TileEntitySkullRenderer.func_152674_a', ops: ops.slice() }); }
      ops = [];
    }
  }
  return calls;
}
const player = await javap('bop');
const headBranch = glCalls(player, 'protected void a(blg, float);', 31, 249);
const item = await javap('bly');
const frameText = await javap('bnx'), mapRender = await javap('bbz');
const records = [
  { case: 'headBranch', class: 'bop (RenderPlayer)', method: 'a(blg, float) offsets 31-249', calls: headBranch },
  { case: 'mapFirstPerson', class: 'bly (ItemRenderer)', method: 'a(float), filled-map branch offsets 368-960', calls: glCalls(await javap('bly'), 'public void a(float);', 368, 960) },
  { case: 'frameMap', class: 'bnx (RenderItemFrame)', method: 'd(st) offsets 48-352', calls: glCalls(frameText, 'private void d(st);', 48, 352) },
  { case: 'mapIcons', class: 'bbz (MapItemRenderer.Instance)', method: 'a(boolean)', calls: glCalls(mapRender, 'private void a(boolean);', 0, 520) },
];
const reference = { target: 'Minecraft Java 1.7.10', clientSha1: 'e80d9b3bf5085002218d4be59e668bac718abbc6', method: 'javap -c of unchanged client classes (bytecode-derived GL calls); firework/command-cart records from PolishProbe.', records };
const probeOut = path.join(root, 'polish-probe-records.json');
if (await exists(probeOut)) reference.records.push(...JSON.parse(await readFile(probeOut, 'utf8')));
await writeFile(path.join(root, '../public/research/polish-reference.json'), JSON.stringify(reference) + '\n');
console.log(`${reference.records.length} polish records`);
