// Probe unchanged BlockWoodSlab/BlockSlab/ItemSlab, BlockFenceGate, BlockTrapDoor, BlockWall and BlockFence records.
// Requires the pinned 1.7.10 JAR, JDK and probe libraries; writes the fixture replayed by src/shaped-blocks.test.js.
// MC_RESEARCH=/path/to/tools/research node tools/verify-shaped-blocks.mjs
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
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'shaped-blocks-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24}),hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','netty-all-'].map(library)),classes=path.join(out,'classes');
await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/ShapedBlocksProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'ShapedBlocksProbe'],{maxBuffer:1<<28}).catch(e=>{console.error(String(e.stderr).split('\n').filter(l=>!l.startsWith('n ')).slice(0,14).join('\n'));process.exit(1);}),rows=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse),count=kind=>rows.filter(r=>r.kind===kind).length;
const expected={props:5,meta:80,slabPlaced:432,slabUse:837,connect:342,connectGate:8,wallShape:70,fenceGate:16,gatePlaced:44,gateSide:6,gateSupport:23,gateOccupied:12,gateUse:80,gatePower:112,gateSupportRemoved:2,trapPlaced:36,trapUse:348,trapSupport:342,trapUseBlock:16,trapSetOpen:32,trapNeighbour:1344,wallUse:3,wallSide:6,wallItem:1,break:118,items:1};
if(process.env.MC_DUMP)await writeFile(process.env.MC_DUMP,rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
for(const [kind,n] of Object.entries(expected))assert.equal(count(kind),n,kind);
assert.equal(rows.length,Object.values(expected).reduce((a,b)=>a+b,0));
const srg=await readFile(path.join(research,'joined-1.7.10.srg'),'utf8'),hashClass=async id=>createHash('sha256').update((await exec('unzip',['-p',jar,id+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const lang=(await exec('unzip',['-p',jar,'assets/minecraft/lang/en_US.lang'],{maxBuffer:1<<24})).stdout,keys=/^tile\.(woodSlab|trapdoor|fenceGate|cobbleWall)[a-zA-Z_.]*\.name=/;
const names=Object.fromEntries(lang.split('\n').map(l=>l.replace(/\r$/,'')).filter(l=>keys.test(l)).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
const classNames={aji:'Block',alj:'BlockSlab',aoo:'BlockWoodSlab',aeg:'ItemSlab',ala:'BlockFenceGate',aoe:'BlockTrapDoor',aoi:'BlockWall',akz:'BlockFence',adl:'ItemMultiTexture',abh:'ItemBlock'},classHashes={};
for(const [id,name] of Object.entries(classNames))classHashes[id]={name,sha256:await hashClass(id)};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',srgSha256:createHash('sha256').update(srg).digest('hex'),method:'Unchanged original block registry objects 125/126 (BlockWoodSlab double/single), 96 (BlockTrapDoor), 107 (BlockFenceGate), 139 (BlockWall) and 85 (BlockFence) over a map-backed World double (an ahb subclass) that dispatches the original neighbour notifications in World order (breakBlock, onBlockAdded, then x-1, x+1, y-1, y+1, z-1, z+1 for flag 1), records writes, aux effects, sounds and real EntityItem drops, and reads redstone as an explicit set of powered cells for isBlockIndirectlyGettingPowered. ItemSlab, ItemBlock and ItemMultiTexture run through onItemUse with an Unsafe-allocated EntityPlayerMP; no render engine or tick loop is instantiated. Collision boxes come from addCollisionBoxesToList, selection from getSelectedBoundingBoxFromPool and ray traces from collisionRayTrace.',names,classes:classHashes,counts:expected,rows};
const file=path.join(root,'../public/research/shaped-blocks-reference.json');await writeFile(file,JSON.stringify(reference)+'\n');
console.log(`Original shaped-block records: ${rows.length} rows, ${(await readFile(file)).length} bytes`);
