// Probe unchanged BlockStoneBrick/BlockStoneSlab/ItemSlab, BlockEndPortalFrame,
// BlockCauldron and BlockFlowerPot/TileEntityFlowerPot records.
// Requires the pinned 1.7.10 JAR, JDK and probe libraries; writes the fixture
// replayed by src/stone-utility.test.js.
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
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'stone-utility-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/StoneUtilityProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'StoneUtilityProbe'],{maxBuffer:1<<26}),rows=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse),count=kind=>rows.filter(r=>r.kind===kind).length;
const expected={block:6,meta:96,slabPlaced:288,slabUse:606,endFramePlaced:97,blockItem:7,cauldronPlaced:6,cauldronUse:48,cauldronEntity:72,cauldronRain:160,potTile:16,potUse:140,potTwice:1,potDrops:18,potPick:2,items:1};
for(const [kind,n] of Object.entries(expected))assert.equal(count(kind),n,kind);
assert.equal(rows.length,Object.values(expected).reduce((a,b)=>a+b,0));
const byId=Object.fromEntries(rows.filter(r=>r.kind==='block').map(r=>[r.id,r]));
assert.equal(byId[98].hardness,1.5);assert.equal(byId[120].hardness,-1);assert.equal(byId[120].resistanceField,18000000);assert.equal(byId[118].renderType,24);assert.equal(byId[140].renderType,33);
const srg=await readFile(path.join(research,'joined-1.7.10.srg'),'utf8'),hashClass=async id=>createHash('sha256').update((await exec('unzip',['-p',jar,id+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={aji:'Block',anw:'BlockStoneBrick',any:'BlockStoneSlab',alj:'BlockSlab',aeg:'ItemSlab',aku:'BlockEndPortalFrame',ajw:'BlockCauldron',ald:'BlockFlowerPot',apf:'TileEntityFlowerPot'},classHashes={};
for(const [id,name] of Object.entries(names))classHashes[id]={name,sha256:await hashClass(id)};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',srgSha256:createHash('sha256').update(srg).digest('hex'),method:'Unchanged original block registry objects 98, 43, 44, 120, 118 and 140 over a minimal World/IBlockAccess double (ahb subclass with a cell map, recorded writes/sounds/spawned items and tile entities), an Unsafe-allocated EntityPlayerMP for ItemSlab.onItemUse, BlockCauldron/BlockFlowerPot onBlockActivated, onEntityCollidedWithBlock and fillWithRain, and TileEntityFlowerPot createNewTileEntity. No render engine, tessellator or WorldServer tick loop is instantiated; glass-bottle and armor-dye cauldron branches are not probed (no bottle item exists in this port).',classes:classHashes,counts:expected,rows};
const file=path.join(root,'../public/research/stone-utility-reference.json');await writeFile(file,JSON.stringify(reference)+'\n');
console.log(`Original stone-utility records: ${rows.length} rows, ${(await readFile(file)).length} bytes`);
