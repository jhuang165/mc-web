// Batch 85 convert85: records a live squid pushing and being pushed (tools/probes/SquidPushProbe.java on the SquidBatProbe world double with an entity list)
// in public/research/squid-push-reference.json; src/convert85-b85.test.js replays it. Needs the same JDK and library JARs as
// tools/verify-squid-bat.mjs (MC_RESEARCH points at the directory holding minecraft-1.7.10.jar).
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'squid-push-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','netty-buffer-','netty-common-','netty-codec-','netty-transport-4','netty-handler-4','netty-resolver-4','gson-','commons-io-','commons-codec-'].map(library)); // b86: netty and the rest for the real EntityPlayerMP (ServerPlayerProbe)
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','WolfProbe','ModelProbe','SquidBatProbe','EndermanProbe','CorpseLivingProbe','PlantProbe','PlayerStepProbe','XpOrbProbe','NbtProbe','MinecartProbe','HangingProbe','EntityListProbe','ServerPlayerProbe','SquidPushProbe'].map(n=>path.join(root,`probes/${n}.java`))]);
const {stdout}=await exec('java',['-cp',cp,'SquidPushProbe'],{maxBuffer:1<<28});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
assert.equal(records.length,7);
const reference={target:'Minecraft Java 1.7.10',tag:'b85squidpush',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',
 method:'Batch 85. Unchanged original classes. Squids (new ws(world)) in water on the SquidBatProbe double whose World.getEntitiesWithinAABBExcludingEntity answers the entities whose box meets the query; Entity.rand is an LCG copy with a draw counter; ticksExisted counts before each ws.h(). Records: `at` start positions (squids, then the player when `player`), rows per tick: each squid [fields, draws, random state] and, with a player, the player motion after the tick (the stub EntityPlayer is never ticked).',
 records};
await writeFile(path.join(root,'../public/research/squid-push-reference.json'),JSON.stringify(reference)+'\n');
console.log('squid-push reference:',records.length,'records');
// Batch 86 mobrec86: SQ_B86=1 runs the pool-world records (a squid and a boat in one walked list; a squid and a ticked EntityPlayerMP) -> squid-push-b86-reference.json.
{
 const {stdout}=await exec('java',['-cp',cp,'SquidPushProbe'],{maxBuffer:1<<28,env:{...process.env,SQ_B86:'1'}});
 const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
 assert.equal(records.length,7);
 const reference={target:'Minecraft Java 1.7.10',tag:'b86squidpush',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',
  method:'Batch 86. Unchanged original classes on EntityListProbe.EW (map-backed blocks: still water 9 at x 44..85, z 44..85, y 0..9, stone walls; real handleMaterialAcceleration, isAABBInMaterial and getCollidingBoundingBoxes with entity boxes). kind boat: a squid (Entity.rand an LCG copy with a draw counter) and an empty EntityBoat walked in `order` (sb squid first, bs boat first; lastTickPos, ticksExisted++, onUpdate); `boat` [x, y, z, vx, yaw] given to new xi(world, x, y, z); rows [squid state, boat [x, posY, z, vx, vy, vz, yaw, isDead]]. kind tplayer: a squid and a real EntityPlayerMP (ServerPlayerProbe) at `player`, ticked after the squid by mw.i() and put back at its position; rows [squid state, player motion after the squid, player motion after its own update].',
  records};
 await writeFile(path.join(root,'../public/research/squid-push-b86-reference.json'),JSON.stringify(reference)+'\n');
 console.log('squid-push b86 reference:',records.length,'records');
}
// Batch 87 mobrec87: SQ_B87=1 runs the boat records with a rider (an AI-less EntityCow mounted on the boat, the World.updateEntities rider rule) -> squid-push-b87-reference.json.
{
 const {stdout}=await exec('java',['-cp',cp,'SquidPushProbe'],{maxBuffer:1<<28,env:{...process.env,SQ_B87:'1'}});
 const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
 assert.equal(records.length,4);
 const reference={target:'Minecraft Java 1.7.10',tag:'b87squidrider',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',
  method:'Batch 87. The b86 pool world and boat records (squid-push-b86-reference.json) with a rider: an EntityCow whose updateAITasks is switched off (EntityListProbe.Cow, Entity.rand Random(7), yaw fields 0), placed 1 above the boat and mounted with Entity.mountEntity before the first tick, listed last. The list is walked by World.updateEntities rules: a rider whose mount is live is skipped at its own place and updated right after its mount (lastTickPos, ticksExisted++, updateRidden: onUpdate, then the mount updateRiderPosition). kind rider: rows [squid state, boat [x, posY, z, vx, vy, vz, yaw, isDead], cow [x, y, z, vx, vy, vz]].',
  records};
 await writeFile(path.join(root,'../public/research/squid-push-b87-reference.json'),JSON.stringify(reference)+'\n');
 console.log('squid-push b87 reference:',records.length,'records');
}
