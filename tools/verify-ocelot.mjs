// Records EntityOcelot, EntityTameable, EntityAIOcelotSit, BlockChest's ocelot check, ModelOcelot and the creeper's task list
// from the unchanged original classes (tools/probes/OcelotProbe.java and ModelProbe.java, on the MobMoveProbe world double) in
// public/research/ocelot-reference.json; src/ocelot.test.js checks the browser port against it. Needs the same JDK, client JAR
// and library JARs as tools/verify-wolf.mjs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'ocelot-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/MobMoveProbe.java'),path.join(root,'probes/ModelProbe.java'),path.join(root,'probes/OcelotProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'OcelotProbe'],{maxBuffer:1<<27});
const lines=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const pick=name=>lines.filter(l=>l.case===name);
const facts=pick('facts')[0],tasks=pick('tasks')[0],interact=pick('interact'),sound=pick('sound'),spawn=pick('spawn'),speed=pick('speed'),model=pick('model');
assert.ok(facts&&tasks&&model.length>=13);assert.equal(interact.filter(r=>r.kind==='fish').length,300);assert.equal(sound.length,180);assert.equal(speed.length,12);assert.equal(spawn.length,8*7*3);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={wn:'EntityOcelot',tg:'EntityTameable',wf:'EntityAnimal',xz:'EntityCreeper',bht:'ModelOcelot',bom:'RenderOcelot',vk:'EntityAITempt',tw:'EntityAIAvoidEntity',uw:'EntityAIOcelotSit',uv:'EntityAIOcelotAttack',vh:'EntityAISit',ug:'EntityAIFollowOwner',um:'EntityAILeapAtTarget',vr:'EntityAITargetNonTamed',ajx:'BlockChest'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged original classes after Block/Item registration, on the MobMoveProbe world double with a real new wn(world) and a constructor-less EntityPlayer. facts, tasks (reflection over the real task lists), interact (wn.a(yz): 300 seeded taming rolls), sound (t()), spawn (by()), speed (bp()), sit* (EntityAIOcelotSit), chestOcelot (BlockChest.o), attack/hurt/fall/child/mate/egg, avoid (tw.a on a creeper), model (ModelOcelot).',
 facts,despawn:pick('despawn')[0],tasks,interact,sound,spawn,spawnSeeds:pick('spawnSeeds')[0],speed,sitValid:pick('sitValid'),sitSearch:pick('sitSearch'),sitStart:pick('sitStart')[0],sitStartGate:pick('sitStartGate'),sitDuration:pick('sitDuration')[0],chestOcelot:pick('chestOcelot'),attack:pick('attack')[0],hurt:pick('hurt'),fall:pick('fall')[0],child:pick('child'),mate:pick('mate'),egg:pick('egg')[0],avoid:pick('avoid'),model};
await writeFile(path.join(root,'../public/research/ocelot-reference.json'),JSON.stringify(reference)+'\n');
console.log('ocelot reference:',interact.length,'interact rows,',sound.length,'sound rows,',spawn.length,'spawn rows,',model.length,'model rows,',reference.sitValid.length,'sit validity rows,',reference.mate.length,'mate rows');
