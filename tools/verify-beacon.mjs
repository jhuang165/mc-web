// Records unchanged TileEntityBeacon (aoq), ContainerBeacon (zx) and its payment slot (zy); see probes/BeaconProbe.java.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'beacon-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await rm(probe,{recursive:true,force:true});await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/BeaconProbe.java')],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'BeaconProbe'],{maxBuffer:1<<29});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const count=c=>records.filter(r=>r.case===c).length;
const expect={facts:1,levels:42,tick:12,effects:245,range:52,gate:4,setter:165,setterReset:1,nbt:2,slot:18,layout:1,shift:72,server:100,close:1};
for(const [c,n] of Object.entries(expect))assert.equal(count(c),n,`records of ${c}`);
assert.equal(records.length,Object.values(expect).reduce((a,b)=>a+b),'no stray records');
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={aoq:'TileEntityBeacon',zx:'ContainerBeacon',zy:'ContainerBeacon$1',ajg:'BlockBeacon',aor:'TileEntity',rw:'PotionEffect',rv:'Potion',ahb:'World'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged TileEntityBeacon (aoq), ContainerBeacon (zx, payment slot zy), BlockBeacon properties and ItemStack on a minimal World double (block map, sky flag, world time, player list; BeaconProbe.W) and a recording EntityPlayer (BeaconProbe.P). facts: tier table of potion ids (aoq.a), block and nether star properties, payment item ids. levels: aoq.y (pyramid check) per layer count/material, sky, holes, mixed layers, floor limit. tick: aoq.h runs y() and x() only when world time % 80 == 0. effects: aoq.x for every level and primary/secondary pair, effects delivered [id,duration,amplifier,ambient] and the search box. range: distance and vertical limits. gate: not-active, zero level, no primary, remote world. setter: aoq.d / aoq.e validation for each potion id 0..32 per level. nbt: aoq.b/a keys and defaults. slot: zy.a(add) validity. layout: ContainerBeacon slot positions. shift: ContainerBeacon.transferStackInSlot. server: the MC|Beacon packet handler (NetHandlerPlayServer, bytecode-read) replayed with its exact calls. close: ContainerBeacon does not override onContainerClosed (bytecode).',
 records};
await writeFile(path.join(root,'../public/research/beacon-reference.json'),JSON.stringify(reference)+'\n');
console.log('Original beacon records:',records.length,'bytes:',JSON.stringify(reference).length);
