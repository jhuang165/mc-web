// Batch 80 fluids80 executed checks (tools/probes/Fluids80Probe.java): falling fluid blocks landing (onBlockAdded and its scheduled tick), fluid item stacks 8/9 and 10/11
// (equality, inventory and item-entity merging) and the Fire an EntityItem saves after burning or loading, on the unchanged 1.7.10 classes.
// Requires the pinned 1.7.10 JAR, JDK and probe libraries; writes public/research/fluids80-reference.json, replayed by src/fluids80-b80.test.js.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false),researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'fluids80-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches'),path.join(research,'libs-1.7.10')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24}),hit=stdout.split('\n').filter(f=>/^\d/.test(path.basename(f).slice(prefix.length))).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-','gson-','netty-buffer-','netty-common-'].map(library)),classes=path.join(out,'classes');
await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await rm(probe,{recursive:true,force:true});await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-sourcepath',path.join(root,'probes'),'-d',probe,path.join(root,'probes/Fluids80Probe.java')],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'Fluids80Probe'],{maxBuffer:1<<26}),records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
if(process.argv[2]){console.log(stdout);process.exit(0);}
assert.ok(records.length>=100,'record count '+records.length);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const classNames={xj:'EntityFallingBlock',akr:'BlockDynamicLiquid',ant:'BlockStaticLiquid',alw:'BlockLiquid',add:'ItemStack',yx:'InventoryPlayer',xk:'EntityItem',sa:'Entity'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(classNames).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'tools/probes/Fluids80Probe.java on the unchanged classes. land80: the real EntityFallingBlock.onUpdate lands blocks 8-11 on a world double (FallingBlock78Probe.Tiles79.World) whose setBlock stores the cell and calls the new block\'s onBlockAdded as Chunk.func_150807_a does on a server; scheduleBlockUpdate calls are recorded as x,y,z,block,delay. stack80: ItemStack.isItemEqual / areItemStacksEqual, InventoryPlayer.addItemStackToInventory of stack a (3) then b (2) into an empty inventory (slots 0-3 after), EntityItem.combineItems(a, b). fire80: an EntityItem (Entity.rand seeded 80) falling through open air (no block near) with Entity.fire set to start (path set) or read from a compound with Fire start and Age 7 (path load), updated `ticks` times, then Entity.writeToNBT.',
 records};
const file=path.join(root,'../public/research/fluids80-reference.json');await writeFile(file,JSON.stringify(reference)+'\n');
console.log(`fluids80 records: ${records.length}, ${(await readFile(file)).length} bytes`);
