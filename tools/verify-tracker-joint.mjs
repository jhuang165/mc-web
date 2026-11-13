// Batch 52 (trackerflush), batch 53 adds the vehicles, hanging, eye and hook cases: the REAL EntityTracker (mn) with real entities of five classes and a player stand-in, driven by a World.updateEntities stand-in (tools/probes/TrackerJointProbe.java); records the packet sequence per tick in public/research/tracker-joint-reference.json. src/tracker-flush-b52.test.js replays it. Same jar lookup as the other verify-*.mjs tools.
// entity id, in a real java.util.HashSet under add / remove histories) in public/research/tracker-joint-reference.json. src/tracker-order-b49.test.js replays it through
// src/java-hashset-order.js. The order is the running JDK's HashMap order, so the file records java.version. Same jar lookup as the other verify-*.mjs tools.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'tracker-joint-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ChickenProbe','TrackerProbe','TrackerItemsProbe','TrackerJointProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'TrackerJointProbe'],{maxBuffer:1<<28});
const lines=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={mn:'EntityTracker',my:'EntityTrackerEntry',sa:'Entity',mw:'EntityPlayerMP',ahb:'World'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',
 classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Executed: Batch 58 (tag b58tp, cases dimAge5..dimAge59 and dimAgeLong): the dimension change with world B ticking from its start, arriving at several ticks (and after 1195 ticks, across the 401st relative update). the real EntityTracker (mn.a(sa), mn.b(sa), mn.a()) with real EntityTrackerEntry objects in its one HashSet for real chickens, items, arrows, snowballs and orbs and an EntityPlayerMP stand-in, added in loadedEntityList order. Per tick a World.updateEntities stand-in sets each entity scripted state at its list index, removes a dead one at its own index (real untrackEntity, which queues the id in the player destroyedItemsNetCache) and runs the player first-thing flush at the player slot (mw.h offsets 74-179, bytecode-read); then the real updateTrackedEntities runs. Packets are recorded as [kind, entity id, fields] in sending order. Batch 53 (tag b53tj, cases vehicles and vehiclesLast): the same walk with real boats (xi), minecarts (xl.a, types 0 and 1), paintings (tb), item frames (st), eyes of ender (zd) and fish hooks (xe, the angler is the player stand-in). Batch 54 (tag b54rt, cases extras and extrasLast): leash knots (su), firework rockets (zf), falling blocks (xj), primed TNT (xw) and thrown potions (zo). Batch 55 (tag b55dt, cases respawn, respawnLast, dimension, dimensionLast, earlySpawn, earlySpawnLast): the player respawn (real mn.b of the old player, a new EntityPlayerMP id at the end of the list, real mn.a of the new one), a dimension change (real mn.b in world A, real mn.a in world B with its own HashSet) and spawns made at the spawner slot before the player slot; the respawn and transfer calls of ServerConfigurationManager and the entity loop are stand-ins. Batch 57 (tag b57ts, cases dimTick and dimTickLast): the dimension change with world B ticking from the start (its entities move and update their tracker entries every tick, after world A, nobody watching), so the entries are mid-phase at the arrival.',
 ...Object.fromEntries(lines.map(l=>[l.case,l]))};
await writeFile(path.join(root,'../public/research/tracker-joint-reference.json'),JSON.stringify(reference)+'\n');
console.log('tracker-joint:',lines.map(l=>l.case+'='+l.ticks.length).join(' '));
