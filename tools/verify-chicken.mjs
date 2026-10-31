// Records EntityChicken and EntityEgg behaviour from the unchanged original classes
// (tools/probes/ChickenProbe.java, on the MobMoveProbe world double) in
// public/research/chicken-reference.json; src/chicken.test.js checks the browser port against it. Needs the same JDK, client JAR and library
// JARs as tools/verify-inventory.mjs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'chicken-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/MobMoveProbe.java'),path.join(root,'probes/ChickenProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'ChickenProbe'],{maxBuffer:1<<26});
const lines=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const pick=name=>lines.filter(l=>l.case===name);
const facts=pick('facts')[0],fall=pick('fall')[0],eggtimer=pick('eggtimer'),child=pick('child')[0],drops=pick('drops'),hatch=pick('hatch')[0];
assert.ok(facts&&fall&&child&&hatch);assert.equal(fall.ticks.length,80);assert.equal(eggtimer.length,6);assert.equal(drops.length,600);assert.equal(hatch.chicks.length,4000);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={wg:'EntityChicken',zl:'EntityEgg',zk:'EntityThrowable',rx:'EntityAgeable',sv:'EntityLivingBase'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged original classes after Block/Item registration, on the MobMoveProbe world double (stone below y 0) with a real new wg(world) whose AI task lists are emptied. facts: constructor size, attribute base values and the extremes of the initial egg timer over 4000 constructions. fall: wg.e() each tick while dropping from y 6, with a motionY 0.42 hop after tick 40; each row is the state after the tick (bp wingRotation, bq destPos, br oFlapSpeed, bs oFlap, bt wingRotDelta). eggtimer: bu = 1, seeded Entity.rand, one tick: the plop sound, the dropped egg and the next timer. child: a -24000 chick ticks without laying. drops: wg.b(ZI) (looting 0) for 300 seeded Entity.rand, not burning and burning (item, stack size). hatch: zl.a(MovingObjectPosition) on a block for 4000 Entity.rand seeded i * 2654435761 (consecutive small seeds never roll nextInt(8) == 0): chicks spawned and snowballpoof particles per seed, plus one chick sample (age, position, yaw, pitch).',
 facts,fall,eggtimer,child,drops,hatch};
await writeFile(path.join(root,'../public/research/chicken-reference.json'),JSON.stringify(reference)+'\n');
const tally={};for(const c of hatch.chicks)tally[c]=(tally[c]||0)+1;
console.log('hatch tally',JSON.stringify(tally),'drops',drops.length,'fall rows',fall.ticks.length);
