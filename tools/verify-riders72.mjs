// b72 riders72: records RidersProbe (rider fall distance, chicken jockey search order, player step while riding) from the unchanged 1.7.10 classes
// into public/research/riders72-reference.json; src/riders72-b72.test.js replays it.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'riders72-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','WolfProbe','ModelProbe','WitherBossProbe','WitherRound3Probe','PlantProbe','PlayerStepProbe','RidersProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout,stderr}=await exec('java',['-Xmx2g','-cp',cp,'RidersProbe'],{maxBuffer:1<<28});
if(stderr.trim())console.error(stderr.slice(0,2000));
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const count=c=>records.filter(r=>r.case===c).length;
assert.equal(count('ride'),56);assert.equal(count('fall'),6);assert.equal(count('jockey'),12);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={sa:'Entity',sv:'EntityLivingBase',yz:'EntityPlayer',yq:'EntityZombie',wg:'EntityChicken',ahb:'World',apx:'Chunk',sj:'IEntitySelector',blk:'EntityPlayerSP'};
await writeFile(path.join(root,'../public/research/riders72-reference.json'),JSON.stringify({target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged classes, no game code patched. fall: updateRidden (sa.ab) on an allocated rider with a dead or live mount and fallDistance 5. jockey: EntityZombie.onSpawnWithEgg (yq.a) with a baby ys group and a world Random whose first nextFloat is 0.01, chickens added to real Chunk lists in the listed order. ride: Entity.moveEntity (sa.d) of an EntityPlayerSP with and without ridingEntity.',
 records})+'\n');
console.log('riders72 records:',JSON.stringify(Object.fromEntries(['ride','fall','jockey'].map(c=>[c,count(c)]))));
