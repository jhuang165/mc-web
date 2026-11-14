// Records the unchanged MapData.MapInfo.getPacket (ayj.a(add)) of the 1.7.10 JAR: see probes/MapPacketProbe.java. Writes public/research/map-packet-reference.json.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'map-packet-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','commons-io-','gson-','netty-transport-4','netty-common-','netty-buffer-','netty-codec-','netty-handler-4','netty-resolver-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await rm(probe,{recursive:true,force:true});await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/MapPacketProbe.java')],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'MapPacketProbe'],{maxBuffer:1<<26});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const count=c=>records.filter(r=>r.case===c).length;
for(const [c,n] of Object.entries({seq:170,partial:60,decor:45,frame:30}))assert.equal(count(c),n,`records of ${c}`);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={ayi:'MapData',ayj:'MapData$MapInfo',ayk:'MapData$MapCoord'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged MapData (ayi), MapInfo (ayj) and MapCoord (ayk): MapInfo.getPacket(stack) called repeatedly, as EntityPlayerMP.onUpdateEntity (every tick, each map in the inventory) and EntityTrackerEntry (every 10 ticks, a map in an item frame) do. Each record is one call: t first byte (2 scale, 1 icons, 0 column), n length, h Arrays.hashCode, b the bytes (all when n <= 40, else the first 6); t -1 is a null result. seq: a new map, every column dirty. partial: dirty ranges set with MapData.func_76194_a after the drain. decor: icons added mid-run, a plain stack. frame: the same on an item-frame stack.',
 records};
await writeFile(path.join(root,'../public/research/map-packet-reference.json'),JSON.stringify(reference)+'\n');
console.log('Map packet records:',records.length);
