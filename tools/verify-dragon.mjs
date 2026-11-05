// Records the unchanged 1.7.10 EntityDragon (xa), EntityDragonPart (wy) and EntityEnderCrystal (wz); see probes/DragonProbe.java and public/research/dragon.md.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'dragon-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','netty-','commons-io-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await rm(probe,{recursive:true,force:true});await mkdir(probe,{recursive:true});
const cp=[probe,classes,jar,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['TerrainProbe','DecorationFeatureProbe','SpringProbe','EndProbe','DragonProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout,stderr}=await exec('java',['-Xmx2g','-cp',cp,'DragonProbe'],{maxBuffer:1<<29});
if(/Exception|Caused by:/.test(stderr))throw new Error(stderr);
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const count=c=>records.filter(r=>r.case===c).length;
const expect={facts:1,flight:5,ring:1,damage:112,damageMain:1,hurtWindow:1,crystal:4,collide:8,collideHurt:1,destroy:32,destroyTicks:1,death:2};
for(const [c,n] of Object.entries(expect))assert.equal(count(c),n,`records of ${c}`);
assert.equal(records.length,Object.values(expect).reduce((a,b)=>a+b),'no stray records');
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={xa:'EntityDragon',wy:'EntityDragonPart',wz:'EntityEnderCrystal',sw:'EntityLiving',sv:'EntityLivingBase'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged EntityDragon on the End probe World double (real Chunk storage, real World.setBlock; entity lists, particles, world events and xp orbs are logged). flight: onLivingUpdate (xa.e) ticks with the entity Random seeded, no players or one/two static players; the trace is [x,y,z,yaw,targetX,targetY,targetZ,mx,my,mz,animTime,slowed,ringIndex,randomYawVelocity] per tick, parts holds the 7 part boxes for the first 60 ticks, digest hashes the state after them. ring: getMovementOffsets. damage: attackEntityFromPart for every part, source and amount. crystal: updateDragonEnderCrystal alone, 300 ticks. collide: wing push and head attack on a zombie. destroy: destroyBlocksInAABB. death: onDeathUpdate + onLivingUpdate for 205 ticks with the xp orbs and createEnderPortal.',
 records};
await writeFile(path.join(root,'../public/research/dragon-reference.json'),JSON.stringify(reference)+'\n');
console.log('Original dragon records:',records.length,'bytes:',JSON.stringify(reference).length);
