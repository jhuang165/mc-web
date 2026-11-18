// Batch 81 (collide81): Haste and Mining Fatigue in EntityPlayer.getCurrentPlayerStrVsBlock and Block.getPlayerRelativeBlockHardness, executed
// on the unchanged classes (tools/probes/MiningEffectsProbe.java); src/collide81-b81.test.js replays public/research/mining-effects-reference.json.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'mining-effects-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(research,'libs-1.7.10'),path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','log4j-core-','commons-lang3-','netty-all-','gson-','commons-io-','commons-codec-','jopt-simple-'].map(library));
const classes=path.join(out,'classes');await rm(out,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs,jar].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ChickenProbe','DifficultyProbe','SuffocationProbe','PlayerDamageProbe','DigFinishProbe','MiningEffectsProbe'].map(n=>path.join(root,`probes/${n}.java`)),path.join(root,'probes/held/com/mojang/authlib/GameProfile.java')],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'MiningEffectsProbe'],{maxBuffer:1<<28});
const rows=stdout.trim().split('\n').filter(l=>l.startsWith('[')).map(JSON.parse);
assert.ok(rows.length>3000,'probe output');
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={yz:'EntityPlayer',aji:'Block',sa:'Entity',sv:'EntityLivingBase',rw:'PotionEffect',afv:'EnchantmentHelper',yx:'InventoryPlayer'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Batch 81 (collide81): DigFinishProbe\'s EntityPlayerMP double (real inventory and ItemStacks with "ench" NBT) runs the unchanged EntityPlayer.getCurrentPlayerStrVsBlock [yz.a(aji,boolean)] and Block.getPlayerRelativeBlockHardness [aji.a(yz,ahb,III)]. Haste (3) and Mining Fatigue (4) are real PotionEffect objects in activePotionsMap; water is still water in the player column (isInsideOfMaterial runs); Aqua Affinity is an enchanted iron helmet. Rows [block, tool, efficiency, haste amp, fatigue amp, env, speed, progress]: -1 = no effect; env 0 dry ground, 1 wet ground, 2 wet ground + Aqua Affinity, 3 dry airborne, 4 wet airborne. Original ids. Non-finite floats are strings.',
 rows};
await writeFile(path.join(root,'../public/research/mining-effects-reference.json'),JSON.stringify(reference)+'\n');
console.log('Mining effect rows:',rows.length);
