// Records the client copy of a ridden EntityHorse (wi.e(F,F), wi.ac() on a client world double, tools/probes/HorseCopyProbe.java) in
// public/research/horse-copy-reference.json; src/horse-copy-b54.test.js checks the browser port against it. Needs the same JDK and library JARs as tools/verify-horse.mjs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'horse-copy-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','commons-io-','gson-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','assets/minecraft/lang/en_US.lang','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/MobMoveProbe.java'),path.join(root,'probes/ModelProbe.java'),path.join(root,'probes/HorseProbe.java'),path.join(root,'probes/HorseCopyProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'HorseCopyProbe'],{maxBuffer:1<<28});
const lines=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const pick=name=>lines.filter(l=>l.case===name);
assert.equal(pick('steer').length,8);assert.equal(pick('rear').length,20);
assert.equal(pick('sound').length,4);assert.equal(pick('status').length,5);assert.ok(pick('flags').length>60);assert.equal(pick('graze').length,2,'graze rows (see stderr)');
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',
 method:'Unchanged wi (EntityHorse) e(F,F) and ac() on a client world double (ahb.E true) with the HorseProbe rider double; src/horse-copy-b54.test.js replays it. steer: a horse the local player rides, per tick. rear: ac() with a rearing amount. The jump power of the steer case jumpPowerSet is written directly (wi.w(I), which only the server C0B handler calls).',
 steer:pick('steer'),rear:pick('rear')};
await writeFile(path.join(root,'../public/research/horse-copy-reference.json'),JSON.stringify(reference)+'\n');
const sounds={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',
 method:'Batch 57. Unchanged wi (EntityHorse). sound: wi.h() on a client world double (ahb.E true) with a logging Random as Entity.rand, 1500 ticks x 4 scenarios; each tick is [draws joined by space, optional sounds]. flags: the watcher-16 starters on a server world double (ahb.E false), one row each. graze: wi.e() on an all-grass server world, per tick [watcher bits, eating counter bD, draws]. src/horse-sounds-b57.test.js replays it.',
 sound:pick('sound'),flags:pick('flags'),graze:pick('graze')};
await writeFile(path.join(root,'../public/research/horse-sounds-reference.json'),JSON.stringify(sounds)+'\n');
const status={target:'Minecraft Java 1.7.10',tag:'b58hs',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',
 method:'Batch 58. Unchanged wi (EntityHorse) on a client world double (ahb.E true) with a logging Random as Entity.rand: sv.a(byte) status 2 (hurt) and 3 (death) applied before that tick wi.h(), 90 ticks x 5 scenarios; each tick is [status, draws, sounds, health after]. src/vehicles4-b58.test.js replays it.',
 status:pick('status')};
await writeFile(process.env.MC_HORSESTATUS_OUTPUT||path.join(root,'../public/research/horse-status-reference.json'),JSON.stringify(status)+'\n');
console.log('horse copy reference: steer=8 rear=20; horse sounds reference: sound=4 flags='+pick('flags').length+' graze='+pick('graze').length);
