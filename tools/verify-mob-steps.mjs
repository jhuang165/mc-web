// Records the footstep and fall sounds of every browser mob from the unchanged 1.7.10 classes
// (tools/probes/MobStepProbe.java on the HorseProbe/MobMoveProbe world double) in public/research/mob-steps-reference.json;
// src/mob-steps.test.js replays it. Needs a JDK, the pinned client JAR (tools/research or MC_RESEARCH) and the library JARs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const clientSha1='e80d9b3bf5085002218d4be59e668bac718abbc6';
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'mob-step-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),clientSha1);
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','commons-io-','gson-'].map(library));
const classes=path.join(out,'classes'),probe=path.join(out,'probe');
await rm(out,{recursive:true,force:true});await mkdir(classes,{recursive:true});await mkdir(probe,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','assets/minecraft/lang/en_US.lang','-d',classes],{maxBuffer:1<<24});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ModelProbe','HorseProbe','MobStepProbe'].map(n=>path.join(root,`probes/${n}.java`))]);
const {stdout}=await exec('java',['-cp',cp,'MobStepProbe'],{maxBuffer:1<<28});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const by=c=>records.filter(r=>r.case===c);
assert.ok(by('facts').length>=30,'facts');assert.ok(by('step').length>300,'step');assert.equal(by('cadence').length,by('facts').length);assert.equal(by('fall').length,by('facts').length*7);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={sa:'Entity',sv:'EntityLivingBase',wi:'EntityHorse',yq:'EntityZombie',yn:'EntitySpider',wo:'EntityPig',wh:'EntityCow',wp:'EntitySheep',wg:'EntityChicken',wv:'EntityWolf'};
const classDigests={};for(const [c,n] of Object.entries(names)){try{classDigests[c]={name:n,sha256:await digest(c)};}catch{}}
const reference={target:'Minecraft Java 1.7.10',clientSha1,classes:classDigests,
 method:'Each mob is built by EntityList.createEntityByName (sg.a) with its real constructor on the HorseProbe/MobMoveProbe world double (stone floor below y 0, Random(1), at (64.5, 0, 64.5)). step: Entity.func_145780_a (sa.a(int,int,int,aji)) on the named block at (64,0,64), with a snow layer (78) at (64,1,64) when snowAbove. cadence: 200 ticks of the unchanged Entity.moveEntity (sa.d) at dx 0.1 per tick; stepTicks are the ticks (0-based) that played a sound, distance is sa.Q (distanceWalkedOnStepModified) and nextStep the private int sa.d. fall: Entity.fall (sa.b(F)) via EntityLivingBase.fall onto stone. Sounds are "name|volume|pitch" with float values. No game classes patched.',
 records};
await writeFile(path.join(root,'../public/research/mob-steps-reference.json'),JSON.stringify(reference)+'\n');
console.log(`${records.length} records`);
