// Records the batch 28 village fight (every mob ticked: villagers, zombies, skeletons, a golem; a moving player's scripted hits) from the unchanged
// 1.7.10 classes into public/research/village-fight-reference.json; src/village-fight.test.js replays it. See probes/VillageFightProbe.java.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'village3-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches'),path.join(research,'libs-1.7.10')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await rm(probe,{recursive:true,force:true});await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','VillagerProbe','ModelProbe','VillageLiveProbe','ArmorEnchantmentProbe','VillageFightProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'VillageFightProbe'],{maxBuffer:1<<29});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const b31=records.filter(r=>r.name.startsWith('b31-')),base=records.filter(r=>!r.name.startsWith('b31-'));
assert.equal(base.length,7);assert.equal(b31.length,19);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={vz:'Village',wa:'VillageAggressor',vm:'EntityAIDefendVillage',yv:'EntityVillager',wt:'EntityIronGolem',yq:'EntityZombie',yl:'EntitySkeleton',tw:'EntityAIAvoidEntity',sv:'EntityLivingBase'};
const classes_=Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}])));
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:classes_,
 method:'Unchanged classes in the VillageLiveProbe double with every mob ticked by Entity.onUpdate after the VillageCollection: entities 0,1 villagers, 2,3 zombies, 4 iron golem, 5,6 skeletons (ticked, never targeting), 7 a real EntityPlayer that is moved and whose hits are scripted. A row per tick is [[x,y,z,health,attackTarget,revengeTarget,randomDraws] per mob, [x,y,z,health] for the player],[[aggressorIndex,tick]...],reputation of the player name. Hits are [tick,accepted,victimHealthAfter]. Night; difficulty 2 (record field `difficulty`; the peaceful record runs on 0). Batch 30: World.rayTraceBlocks is the real one (sight rays), and the villagers-flee-two-zombies and peaceful records were added.',
 records:base};
const reference31={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:{...classes_,zc:{name:'EntityArrow',sha256:await digest('zc')},uq:{name:'EntityAIAttackOnCollide',sha256:await digest('uq')},vd:{name:'EntityAIArrowAttack',sha256:await digest('vd')},tz:{name:'EntityAIBreakDoor',sha256:await digest('tz')}},
 method:'Batch 31. Same double and row layout as village-fight-reference.json with the mob list set by the record field `types` (V villager, Z zombie, z zombie with CanBreakDoors, G iron golem, K skeleton with an empty hand, B skeleton holding a bow; the player has the index types.length). Mobs tick in list order and then the arrows in spawn order, an arrow spawned during the pass ticks in the same pass, and a setDead entity leaves the list after its own update. Rows carry a 4th element: the arrows whose state changed this tick, [shotIndex, x, y, z, mx, my, mz, dead]. `shots` is each arrow spawned: [tick, shooterIndex, x, y, z, mx, my, mz, yaw, pitch, damage, punch, fire] (the heading Random of an arrow cannot be seeded natively, so the replay starts each arrow from this state). `conversions` is each zombie that EntityZombie.onKillEntity spawned for a killed villager: [tick, x, y, z]; it is never ticked. Script ops added: equip idx item (setCurrentItemOrArmor(0), item 0 = empty hand) and equipmid k idx item (the same, right after entity k updates). Difficulty is the record field `difficulty`; the double fixes World.getBlockLightValue at 15 (the reinforcement site search of a Hard zombie site search finds no dark spot, its Random draws still happen).',
 records:b31};
await writeFile(path.join(root,'../public/research/village-fight-reference.json'),JSON.stringify(reference)+'\n');
await writeFile(path.join(root,'../public/research/village-fight-b31-reference.json'),JSON.stringify(reference31)+'\n');
console.log('Fight records:',base.length,'+',b31.length,'bytes:',JSON.stringify(reference).length,JSON.stringify(reference31).length);
