// Records BlockRedstoneOre on the unchanged 1.7.10 classes; see RedstoneOreProbe.java. Writes
// public/research/redstone-ore-reference.json, replayed by src/redstone-ore.test.js. Needs the pinned JAR, a JDK
// and the probe libraries.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'redstone-ore-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ChickenProbe','DifficultyProbe','CombatProbe','EnchantmentEffectProbe','RedstoneOreProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'RedstoneOreProbe'],{maxBuffer:1<<28});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const of=c=>records.filter(r=>r.case===c);
const counts=Object.fromEntries(['facts','touch','tick','harvest'].map(c=>[c,of(c).length]));console.log(counts);
assert.equal(counts.facts,2);assert.equal(counts.tick,2);assert.equal(counts.harvest,400);assert.equal(counts.touch,480);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={amz:'BlockRedstoneOre',aji:'Block',sa:'Entity',ahb:'World'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged BlockRedstoneOre (original ids 73 unlit, 74 lit) on the EnchantmentEffectProbe world double with a real EntityPlayer. facts: tickRate, light value, light opacity, getTickRandomly, isOpaqueCube, getItemDropped, quantityDropped(fortune 0, 1, 3 on one seed), the ItemBlock id and createStackedBlock. touch: event 0 onBlockClicked, 1 onEntityWalking, 2 onBlockActivated on the ore at (10,70,10); the six neighbours (bit i of mask: up, down, south, north, east, west) are stone when set and otherwise air (filler 0), glass (20) or a torch (50); particles are the captured World.spawnParticle calls [name, x, y, z, vx, vy, vz] (func_150186_m), sets the World.setBlock calls [x, y, z, id, meta], return the onBlockActivated result, next the following World.rand nextInt after the call on the printed seed. tick: updateTick. harvest: Block.harvestBlock with an iron pickaxe for set 0 none, 1 Silk Touch, 2-4 Fortune I-III over 40 seeds: drops [item, count, damage], xp the captured orb values, next the following World.rand nextInt.',
 facts:of('facts').map(({case:_,...r})=>r),touch:of('touch').map(({case:_,...r})=>r),tick:of('tick').map(({case:_,...r})=>r),harvest:of('harvest').map(({case:_,...r})=>r)};
await writeFile(path.join(root,'../public/research/redstone-ore-reference.json'),JSON.stringify(reference)+'\n');
console.log('Native redstone ore records:',records.length);
