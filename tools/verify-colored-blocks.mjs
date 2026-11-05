// Probe unchanged 1.7.10 stained glass/pane, carpet, hay, BlockCompressed, sponge, pumpkin,
// CraftingManager recipes, furnace fuel and BlockFire tables; writes the fixture
// replayed by src/colored-blocks.test.js. Needs the pinned JAR, a JDK and probe libraries.
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
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'colored-blocks-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/ColoredBlocksProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'ColoredBlocksProbe'],{maxBuffer:1<<26}),rows=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse),count=kind=>rows.filter(r=>r.kind===kind).length;
const expected={block:10,meta:70,harvest:100,placed:330,yawPlaced:194,supportPlaced:24,carpetNeighbor:9,onPlaced:360,drops:280,craft:62,recipe:84,fuel:16,fire:10,items:1};
for(const [kind,n] of Object.entries(expected))assert.equal(count(kind),n,kind);
assert.equal(rows.length,Object.values(expected).reduce((a,b)=>a+b,0));
const byId=Object.fromEntries(rows.filter(r=>r.kind==='block').map(r=>[r.id,r]));
assert.equal(byId[95].renderLayer,1);assert.equal(byId[160].renderType,41);assert.equal(byId[173].hardness,5);assert.equal(byId[91].lightValue,15);
const srg=await readFile(path.join(research,'joined-1.7.10.srg'),'utf8'),hashClass=async id=>createHash('sha256').update((await exec('unzip',['-p',jar,id+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={aji:'Block',anq:'BlockStainedGlass',anr:'BlockStainedGlassPane',aop:'BlockCarpet',alm:'BlockHay',alz:'BlockCompressed',anp:'BlockSponge',amw:'BlockPumpkin',aek:'ItemCloth',afe:'CraftingManager',apg:'TileEntityFurnace',alb:'BlockFire'},classHashes={};
for(const [id,name] of Object.entries(names))classHashes[id]={name,sha256:await hashClass(id)};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',srgSha256:createHash('sha256').update(srg).digest('hex'),method:'Unchanged original block registry objects 95, 160, 171, 170, 173, 22, 133, 19, 91 (and pumpkin 86 for comparison) over a minimal World double (ahb subclass with a cell map, recorded writes, sounds and spawned items) and an Unsafe-allocated EntityPlayerMP for ItemBlock/ItemCloth.onItemUse; CraftingManager recipe list and findMatchingRecipe grids; TileEntityFurnace.getItemBurnTime; BlockFire tables after initFire. Hardness is the float widened to double; explosionResistance is the resistance field divided by 5. Per-tool strength and harvest come from Item.getStrVsBlock and canHarvestBlock; full player break speed is not probed.',classes:classHashes,counts:expected,rows};
const file=path.join(root,'../public/research/colored-blocks-reference.json');await writeFile(file,JSON.stringify(reference)+'\n');
console.log(`Original colored-blocks records: ${rows.length} rows, ${(await readFile(file)).length} bytes`);
