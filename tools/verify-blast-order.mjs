// b83 blastorder83: records the order Explosion.doExplosionA hurts a mixed entity list over real chunks, with nested ender crystal blasts (tools/probes/BlastOrderProbe.java), in
// public/research/blast-order-reference.json; src/blastorder83-b83.test.js replays it through applyExplosion and the port's entity systems.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'blast-order-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-1.5'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
try{await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ChickenProbe','DifficultyProbe','EquipmentProbe','PlayerKnockbackProbe','ArrowPickupProbe','ChunkOrderProbe','BlastOrderProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});}
catch(e){console.error(e.stderr);throw e;}
const {stdout,stderr}=await exec('java',['-cp',cp,'BlastOrderProbe'],{maxBuffer:1<<28});
if(process.env.PROBE_STDERR)console.error(stderr);const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
assert.equal(records.filter(r=>r.case==='blast').length,400);
for(const c of ['dragon','hang','crystal'])assert.equal(records.filter(r=>r.case===c).length,300);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={agw:'Explosion',ahb:'World',apx:'Chunk',wz:'EntityEnderCrystal',xk:'EntityItem',sq:'EntityXPOrb',zc:'EntityArrow',xw:'EntityTNTPrimed',yz:'EntityPlayer',xa:'EntityDragon',wy:'EntityDragonPart',tb:'EntityPainting',st:'EntityItemFrame',su:'EntityLeashKnot',ss:'EntityHanging',zd:'EntityEnderEye',xe:'EntityFishHook'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Real chunks (apx) queried by the unchanged World.getEntitiesWithinAABBExcludingEntity; the unchanged Explosion.doExplosionA (size 4, no exploder) over 400 scenes of 3-8 real entities (item, orb, arrow, primed TNT, ender crystal, a player added first) near a chunk corner and slice border, some moved across a border after they were added. Each attackEntityFrom records its index (when not dead) and runs the real method; an ender crystal\'s real attackEntityFrom runs its createExplosion(null, .., 6) inline, whose doExplosionA is recorded one level deeper. b85 blastprobe85 adds 300 scenes each of: dragon (the real EntityDragon xa with its seven parts placed at chosen positions, attackEntityFromPart, health, flight target and Random state), hang (real paintings, item frames with and without an item, leash knots with items, crystals, TNT, orbs; the exploder none or a TNT placed by a survival or a creative player; drops logged from spawnEntityInWorld) and crystal (crystals, items, eyes of ender and fishing hooks on the reach gate; the push recorded). Each entity logs its hit events; motion is the push alone (constructor motion zeroed).',records};
await writeFile(path.join(root,'../public/research/blast-order-reference.json'),JSON.stringify(reference)+'\n');
console.log('Blast order records:',records.length);
