// Records EntityTrackerEntry behaviour (tools/probes/TrackerProbe.java runs the unchanged class my with test doubles for the player,
// its network handler and the chunk watcher) plus bytecode-read facts of EntityTracker (mn), PlayerManager (mq), the client packet
// handler (bjb), the entity base (sa, sv) and the integrated player list (bsw) in public/research/tracker-reference.json.
// src/entity-tracker.test.js replays the scenarios against the browser port. Same jar lookup as the other verify-*.mjs tools.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'tracker-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','commons-io-','gson-','icu4j-core-mojang-','netty-all-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','assets/minecraft/lang/en_US.lang','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/MobMoveProbe.java'),path.join(root,'probes/ChickenProbe.java'),path.join(root,'probes/TrackerProbe.java')],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'TrackerProbe'],{maxBuffer:1<<28});
const lines=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={my:'EntityTrackerEntry',mn:'EntityTracker',mq:'PlayerManager',se:'Entity$EnumEntitySize',bjb:'NetHandlerPlayClient',sv:'EntityLivingBase',bsw:'IntegratedPlayerList'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',
 classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Executed: the unchanged EntityTrackerEntry (my) and Entity$EnumEntitySize (se) driven by tools/probes/TrackerProbe.java in the EntityTracker.updateTrackedEntities order with doubles for the player (mw), its network handler (nh), its world and PlayerManager (watched chunk square). Bytecode-read only (javap, not executed): EntityTracker.addEntityToTracker clamp and update loop (mn), PlayerManager.updateMountedMovingPlayer and isPlayerWatchingChunk (mq), the client S14/S18/S0F handlers and the 3-step interpolation in EntityLivingBase.onLivingUpdate (bjb, sv), IntegratedPlayerList constructor view distance 10 (bsw).',
 bytecodeRead:{
  trackerLimit:'EntityTracker.e = PlayerManager.getFurthestViewableBlock(ServerConfigurationManager.getViewDistance()) = viewDistance * 16 - 16, read once in the EntityTracker constructor; IntegratedPlayerList calls setViewDistance(10) in its constructor, so every range above 144 is clamped to 144 (setViewDistance later changes only PlayerManager, EntityTracker has no setter)',
  trackerLimitValue:144,
  updateOrder:'EntityTracker.updateTrackedEntities: for each entry sendLocationToAllClients (my.a(List)); collect EntityPlayerMP entries whose playerEntitiesUpdated (my.n) is set; then for each such player, for every entry other than the player, tryStartWachingThis (my.b(mw))',
  watchedChunk:'PlayerManager.isPlayerWatchingChunk: player in the chunk watcher and the chunk no longer in the pending send list; chunk watchers cover |dx| and |dz| <= viewRadius chunks of the managed chunk; updateMountedMovingPlayer runs when (managedX - x)^2 + (managedZ - z)^2 >= 64 and the player chunk ((int) x >> 4) differs from the managed chunk, then managedX, managedZ = x, z',
  client:'S14 relative move: serverPos += delta; setPositionAndRotation2(serverPos / 32, yaw, pitch, 3). S18 teleport: serverPos = packet, y = serverPosY / 32 + 0.015625. S0F spawn: serverPos = packet, setLocationAndAngles(pos / 32). EntityLivingBase.onLivingUpdate with increments n > 0: pos += (target - pos) / n, n--.'},
 ...Object.fromEntries(['sizes','walkAway','negative','events','playerWalks','range144','chunkGate'].map(k=>[k,lines.find(l=>l.case===k)]))};
await writeFile(path.join(root,'../public/research/tracker-reference.json'),JSON.stringify(reference)+'\n');
console.log('tracker:',lines.map(l=>l.case+'='+(l.rows?.length??0)).join(' '));
