// Records the live effects of tool and weapon enchantments on the unchanged 1.7.10 classes; see
// EnchantmentEffectProbe.java. Writes public/research/enchantment-effects-reference.json, replayed
// by src/enchantment-effects.test.js. Needs the pinned JAR, a JDK and the probe libraries.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'enchantment-effects-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ChickenProbe','DifficultyProbe','CombatProbe','EnchantmentEffectProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'EnchantmentEffectProbe'],{maxBuffer:1<<29});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const of=c=>records.filter(r=>r.case===c);
const counts=Object.fromEntries(['dig','harvest','attack'].map(c=>[c,of(c).length]));console.log(counts);
assert.ok(counts.dig>5000&&counts.harvest>1000&&counts.attack>1500);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={yz:'EntityPlayer',yx:'InventoryPlayer',afv:'EnchantmentHelper',aji:'Block',amn:'BlockOre',amz:'BlockRedstoneOre',alt:'BlockLeaves',ali:'BlockGravel',aly:'BlockMelon',alp:'BlockIce',akf:'BlockCrops',anz:'BlockTallGrass',sv:'EntityLivingBase',sa:'Entity',ade:'Items',add:'ItemStack'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged original classes on the CombatProbe/DifficultyProbe world double, with a real EntityPlayer holding real ItemStacks carrying the "ench" NBT list. dig rows are [block, tool, efficiency, env, speed]: EntityPlayer.getCurrentPlayerStrVsBlock (Efficiency level, env 0 dry ground, 1 wet ground, 2 wet ground with Aqua Affinity, 3 dry airborne, 4 wet airborne with Aqua Affinity). harvest: Block.harvestBlock of the real block object for set 0 none, 1 Silk Touch, 2-4 Fortune I-III, 5 Silk Touch + Fortune III, 6 Fortune IV, on a World.rand Random of the printed seed; drops are the captured EntityItems [item, count, damage], xp the captured EntityXPOrb values, sets World.setBlock calls, next the following World.rand nextInt. attack: EntityPlayer.attackTargetEntityWithCurrentItem (held-item attack modifier applied as EntityLivingBase.onUpdate does) on a mob with Entity.rand seeded from the printed seed, the player Entity.rand seeded seed*7+3; critical hits fall 1.5 blocks airborne; motion is the mob and player motion afterwards; drops come from the same hit when it kills (Looting). World.rand seeded seed+900.',
 counts,dig:of('dig').map(r=>[r.block,r.tool,r.eff,r.env,r.speed]),harvest:of('harvest').map(({case:_,...r})=>r),attack:of('attack').map(({case:_,...r})=>r)};
await writeFile(path.join(root,'../public/research/enchantment-effects-reference.json'),JSON.stringify(reference)+'\n');
console.log('Original enchantment-effect records:',records.length);
