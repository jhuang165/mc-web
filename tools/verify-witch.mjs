// Records unchanged EntityWitch (yp), its splash potion, ModelWitch and AI; see probes/WitchProbe.java.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'witch-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ChickenProbe','DifficultyProbe','CombatProbe','MobSpawnerProbe','WitchProbe'].map(n=>path.join(root,`probes/${n}.java`)),path.join(root,'probes/ModelProbe.java')],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'WitchProbe'],{maxBuffer:1<<28});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const count=c=>records.filter(r=>r.case===c).length;
const expect={facts:1,tasks:1,potionFacts:1,sounds:1,drops:2,equipment:2,damage:1,potions:1,table:1,items:1,nose:1,decide:1,splash:1,items2:1,think:23,flight:6};
for(const [c,n] of Object.entries(expect))assert.equal(count(c),n,`records of ${c}`);
assert.equal(records.filter(r=>r.model==='witch').length,1);
assert.equal(records.length,Object.values(expect).reduce((a,b)=>a+b)+1,'no stray records');
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={yp:'EntityWitch',yg:'EntityMob',sw:'EntityLiving',sv:'EntityLivingBase',zo:'EntityPotion',zk:'EntityThrowable',adp:'ItemPotion',aen:'PotionHelper',rv:'Potion',rw:'PotionEffect',bim:'ModelWitch',bik:'ModelVillager',bpb:'RenderWitch',vd:'EntityAIArrowAttack',un:'EntityAIWatchClosest',vb:'EntityAILookIdle',vc:'EntityAIWander',uf:'EntityAISwimming',vn:'EntityAIHurtByTarget',vo:'EntityAINearestAttackableTarget'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged EntityWitch (yp) on constructor-less World doubles, see probes/WitchProbe.java. facts/tasks/sounds/drops/equipment/damage/potions/table/items: the constructor, attribute, AI task list, getDropItem table, dropFewItems, dropEquipment, damageEntity reduction and PotionHelper results. decide: attackEntityWithRangedAttack potion choice by target health, distance and effects (rows [distance, target health, undead flag? and seed, [potion damage, spawn x, y, z, motion x, y, z]]). splash: EntityPotion.onImpact on targets at fixed offsets (rows hold damage, deaths, hurt calls and per-target health/effects). flight: a thrown potion ticked with the real EntityThrowable.onUpdate over a block world, positions recorded per tick. think: onLivingUpdate drink rolls (seeded) over 160-300 ticks. nose: ModelWitch.setRotationAngles nose pose. The RNG of every seeded row is a java.util.Random(seed) as recorded; positions of kinematic rows are replayed, not recomputed.',
 render:{texture:'textures/entity/witch.png',shadowSize:0.5,scale:0.9375,model:'ModelWitch (bim) extends ModelVillager (bik): nose with mole, a four-box hat on the head; texture 64 x 128'},
 records};
await writeFile(path.join(root,'../public/research/witch-reference.json'),JSON.stringify(reference)+'\n');
console.log('Original witch records:',records.length,'bytes:',JSON.stringify(reference).length);
