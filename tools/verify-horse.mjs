// Records EntityHorse, EntityAnimal and ModelHorse behaviour from the unchanged original classes
// (tools/probes/HorseProbe.java and ModelProbe.java, on the MobMoveProbe world double) in
// public/research/horse-reference.json; src/horse.test.js checks the browser port against it. Needs the same JDK,
// client JAR and library JARs as tools/verify-inventory.mjs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'horse-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/MobMoveProbe.java'),path.join(root,'probes/ModelProbe.java'),path.join(root,'probes/HorseProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'HorseProbe'],{maxBuffer:1<<28});
const lines=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const pick=name=>lines.filter(l=>l.case===name);
const cases=['spawn','spawnGroup','feed','interact','tame','jump','ride','child','mate','mateState','drops','dropItem','xp','sound','soundFixed','step','fall','armor','nbtWrite','nbtRead','nbtLegacy','anim'];
const expected={spawn:400,spawnGroup:60,feed:432,interact:280,tame:150,jump:26,ride:20,child:560,mate:25,mateState:128,drops:960,dropItem:5,xp:60,sound:200,soundFixed:5,step:32,fall:16,armor:8,nbtWrite:4,nbtRead:4,nbtLegacy:4,anim:4};
for(const c of cases)assert.equal(pick(c).length,expected[c],c);
const facts=pick('facts')[0],model=pick('model')[0];assert.ok(facts&&model);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={wi:'EntityHorse',wf:'EntityAnimal',rx:'EntityAgeable',bhs:'ModelHorse',vg:'EntityAIRunAroundLikeCrazy',wk:'EntityHorse.GroupData',zt:'AnimalChest'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged original classes after Block/Item registration, on the MobMoveProbe world double with a real new wi(world) (seeded Entity.rand) and a constructor-less EntityPlayer double (inventory, abilities, UUID, sneak flag, recorded mount/GUI). facts: size, attribute bases, scale by age, armour values. spawn/spawnGroup: wi.a(sy) onSpawnWithEgg. feed/interact: wi.a(yz). tame: vg.e() (updateTask) ticked per seed. jump: w(int). ride: e(F,F) and ac() with a rider. child: a(rx). mate: a(wf) and cT. drops: u(), b(boolean,int), e(yz). sound: t(), aT(), aU(), cv(), step. fall: b(F), a(ro,F). nbt*: b(dh)/a(dh). anim: h() timers and p/q/r. model: ModelHorse parts at rest (setLivingAnimations is NOT probed; it needs GL-free but input-heavy state, see horses.md Gaps).',
 facts,spawn:pick('spawn'),spawnGroup:pick('spawnGroup'),feed:pick('feed'),interact:pick('interact'),creativeFeed:pick('creativeFeed')[0],tame:pick('tame'),jump:pick('jump'),ride:pick('ride'),child:pick('child'),mate:pick('mate'),mateState:pick('mateState'),mateSelf:pick('mateSelf')[0],dropItem:pick('dropItem'),drops:pick('drops'),xp:pick('xp'),sound:pick('sound'),soundFixed:pick('soundFixed'),step:pick('step'),fall:pick('fall'),armor:pick('armor'),riderHit:pick('riderHit')[0],playerHit:pick('playerHit')[0],nbtWrite:pick('nbtWrite'),nbtRead:pick('nbtRead'),nbtLegacy:pick('nbtLegacy'),anim:pick('anim'),model};
await writeFile(path.join(root,'../public/research/horse-reference.json'),JSON.stringify(reference)+'\n');
console.log('horse reference:',Object.entries(expected).map(([k,v])=>k+'='+v).join(' '));
