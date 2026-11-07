// Records the wither round 3 evidence (head target selection, head particles, ModelWither boxes and pose) from the unchanged 1.7.10 classes into
// public/research/wither-targets-reference.json and wither-model-reference.json; see probes/WitherRound3Probe.java and public/research/wither-boss.md.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'wither-round3-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','netty-','commons-io-','lwjgl-2'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const stub=path.join(out,'stub');await rm(stub,{recursive:true,force:true});await mkdir(stub,{recursive:true});
await exec('javac',['-nowarn','-d',stub,path.join(root,'probes/gl/org/lwjgl/opengl/GL11.java')],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await rm(probe,{recursive:true,force:true});await mkdir(probe,{recursive:true});
const cp=[stub,probe,classes,jar,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','WolfProbe','ModelProbe','WitherBossProbe','WitherRound3Probe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout,stderr}=await exec('java',['-Xmx2g','-cp',cp,'WitherRound3Probe'],{maxBuffer:1<<29});
if(/Exception|Caused by:/.test(stderr))throw new Error(stderr);
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const count=c=>records.filter(r=>r.case===c).length;
for(const [c,n] of Object.entries({targets:8,particles:3,boxes:6,pose:6}))assert.equal(count(c),n,`records of ${c}`);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={xc:'EntityWither',bin:'ModelWither',bix:'ModelRenderer',bis:'ModelBox',bpc:'RenderWither',ahb:'World',apx:'Chunk',xd:'EntityWither.attackEntitySelector'};
const head={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}])))};
const pick=(...c)=>records.filter(r=>c.includes(r.case));
await writeFile(path.join(root,'../public/research/wither-targets-reference.json'),JSON.stringify({...head,
 method:'Unchanged EntityWither.bn() (Invul 0, ticksExisted set per tick, the AI task lists emptied so super.bn draws nothing) on a world double whose entity query is the genuine World.getEntitiesWithinAABB over real Chunk objects (candidates added in the listed order), the genuine selector, the genuine canEntityBeSeen/rayTrace (a wall plane at x when set). draws are the entity Random calls in order (iN:value nextInt(N), d nextDouble, f nextFloat, g nextGaussian); heads are the datawatcher head targets as candidate indexes after the tick. particles: EntityWither.e() on a client-flagged world (ahb.E) with the entity Random and the world Random logged, every spawnParticle call recorded (post-move state).',
 records:pick('targets','particles')})+'\n');
await writeFile(path.join(root,'../public/research/wither-model-reference.json'),JSON.stringify({...head,
 method:'Unchanged ModelWither built for real; org.lwjgl.opengl.GL11 is the headless stub of tools/probes/gl (float modelview stack). boxes: ModelBox corners, sizes, texture offsets (read from the quads), mirror flag and the rotation point per ModelRenderer. pose: EntityWither with set body yaw and head yaw/pitch arrays, setLivingAnimations + render at two partial ticks; calls are the display-list calls [part, 16 column-major modelview floats] in render order and parts the six renderers rotation point and angles.',
 records:pick('boxes','pose')})+'\n');
console.log('wither round3 records:',JSON.stringify(Object.fromEntries(['targets','particles','boxes','pose'].map(c=>[c,count(c)]))));
