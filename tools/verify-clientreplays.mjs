// Batch 65 clientreplays: native 1.7.10 client-copy replays run by probes/FishLineProbe.java (RenderFish's line endpoint, bytecode order with the
// real Vec3/MathHelper classes) and probes/Dragon*Probe/Effect order probes when present. Writes public/research/clientreplays-reference.json,
// replayed by src/clientreplays-b65.test.js. Needs the pinned 1.7.10 JAR, a JDK and the probe libraries (guava, log4j-api, commons-lang3).
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const exec = promisify(execFile), root = path.dirname(fileURLToPath(import.meta.url)), exists = p => access(p).then(() => true, () => false);
const dirs = [process.env.MC_RESEARCH, path.join(root, 'research'), path.join(root, '../../tools/research')].filter(Boolean);
let research; for (const d of dirs) if (await exists(path.join(d, 'minecraft-1.7.10.jar'))) { research = d; break; }
if (!research) throw new Error('Set MC_RESEARCH to the directory containing minecraft-1.7.10.jar.');
const jar = path.join(research, 'minecraft-1.7.10.jar'), sha1 = createHash('sha1').update(await readFile(jar)).digest('hex');
assert.equal(sha1, 'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix) {
  for (const p of (process.env.MC_PROBE_LIBS || '').split(path.delimiter).filter(Boolean)) if (path.basename(p).startsWith(prefix)) return p;
  for (const d of [path.join(os.homedir(), 'Library/Application Support/minecraft/libraries'), path.join(os.homedir(), '.minecraft/libraries'), path.join(os.homedir(), '.gradle/caches'), path.join(research, 'libs-1.7.10')]) {
    if (!await exists(d)) continue;
    const { stdout } = await exec('find', [d, '-name', prefix + '*.jar', '-not', '-name', '*sources*'], { maxBuffer: 1 << 24 });
    const p = stdout.split('\n').filter(Boolean).sort()[0]; if (p) return p;
  }
  throw new Error(`Missing ${prefix}*.jar; pass library JARs in MC_PROBE_LIBS.`);
}
const libs = await Promise.all(['guava-', 'log4j-api-', 'commons-lang3-', 'gson-'].map(library));
const out = path.join(research, 'clientreplays-b65-probe'), classes = path.join(out, 'classes'), probe = path.join(out, 'probe');
await rm(out, { recursive: true, force: true }); await mkdir(classes, { recursive: true }); await mkdir(probe, { recursive: true });
await exec('unzip', ['-q', '-o', jar, '*.class', '-d', classes], { maxBuffer: 1 << 24 });
await mkdir(path.join(probe, 'src/com/mojang/authlib'), { recursive: true });
await writeFile(path.join(probe, 'src/com/mojang/authlib/GameProfile.java'), 'package com.mojang.authlib; public class GameProfile {}\n');
const cp = [probe, classes, ...libs].join(path.delimiter);
const run = async (name, extra = []) => {
  await exec('javac', ['-nowarn', '-cp', cp, '-d', probe, path.join(probe, 'src/com/mojang/authlib/GameProfile.java'), ...extra.map(n => path.join(root, `probes/${n}.java`)), path.join(root, `probes/${name}.java`)], { maxBuffer: 1 << 24 });
  const { stdout } = await exec('java', ['-cp', cp, name], { maxBuffer: 1 << 28 });
  return stdout.trim().split('\n').filter(s => s.startsWith('{')).map(JSON.parse);
};
const digest = async name => createHash('sha256').update((await exec('unzip', ['-p', jar, name + '.class'], { encoding: 'buffer', maxBuffer: 1 << 24 })).stdout).digest('hex');
const reference = { target: 'Minecraft Java 1.7.10', clientSha1: sha1 };
const only = process.argv[2];
if (!only || only === 'fishline') {
  const rows = await run('FishLineProbe');
  reference.fishLine = {
    classes: Object.fromEntries(await Promise.all(Object.entries({ bns: 'RenderFish', azw: 'Vec3', qh: 'MathHelper', yz: 'EntityPlayer', bll: 'EntityOtherPlayerMP' }).map(async ([c, n]) => [c, { name: n, sha256: await digest(c) }]))),
    method: 'RenderFish.doRender (bns.a(xe,DDDFF)) transcribed statement by statement from javap -c -p, in float and double as the bytecode does; the unchanged azw.a(F)/b(F) rotations, qh sin/cos table and EntityPlayer.getEyeHeight run for real. The Tessellator and GL calls are not run.',
    rows,
  };
}
const file = path.join(root, '../public/research/clientreplays-reference.json');
let old = {}; if (await exists(file)) old = JSON.parse(await readFile(file, 'utf8'));
await writeFile(file, JSON.stringify({ ...old, ...reference }) + '\n');
console.log(`clientreplays: ${Object.keys(reference).filter(k => !['target', 'clientSha1'].includes(k)).join(', ')} written`);
