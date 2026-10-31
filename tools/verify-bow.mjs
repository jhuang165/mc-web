// Records what the unchanged 1.7.10 EntityArrow (zc) does (tools/probes/BowProbe.java:
// seeded setThrowableHeading, the skeleton and player constructors, and onUpdate in
// hand-built block worlds) in public/research/bow-reference.json, with the SHA-256 of
// every original class the bow, arrow and skeleton port was read from; src/bow.test.js
// replays it through src/bow.js. ItemBow, EntitySkeleton, EntityAIArrowAttack, the
// sun AI and the renderers are digested but not run (public/research/bows.md says which
// numbers come from bytecode only). Needs the same JDK, client JAR and library JARs as
// tools/verify-inventory.mjs.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'bow-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/BowProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'BowProbe'],{maxBuffer:1<<28});
const cases=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const count=k=>cases.filter(c=>c.case===k).length;
assert.ok(count('heading')>=100&&count('mob')>=30&&count('player')>=100&&count('flight')>=8);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={zc:'EntityArrow',abm:'ItemBow',yl:'EntitySkeleton',vd:'EntityAIArrowAttack',vf:'EntityAIRestrictSun',ue:'EntityAIFleeSun',bly:'ItemRenderer',bnb:'RenderArrow',bic:'ModelSkeleton',bos:'RenderSkeleton',blk:'EntityPlayerSP',yz:'EntityPlayer',sv:'EntityLivingBase',sa:'Entity'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged original classes after Block registration. heading: EntityArrow.setThrowableHeading (zc.c) with a seeded Entity.rand. mob: the (world, shooter, target, velocity, inaccuracy) constructor with constructor-less EntitySkeleton doubles, the heading seeded by overriding c. player: the (world, shooter, power) constructor on an EntitySkeleton double whose eye height is the 1.62 of EntityPlayerMP (mw.g; EntityPlayer needs authlib and netty to load). flight: EntityArrow.onUpdate (zc.h) per tick in an ahb subclass whose block lookup is a list of boxes (later boxes win; 0 air, 1 stone, 9 water) and whose entity lists are empty; long runs keep ticks 1-6 and 1198 on. Hit and damage paths, ItemBow, EntitySkeleton and the AI tasks are not run.',
 cases};
await writeFile(path.join(root,'../public/research/bow-reference.json'),JSON.stringify(reference)+'\n');
console.log(`${cases.length} bow cases`);
