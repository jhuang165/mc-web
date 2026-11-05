// Records unchanged EntityMooshroom (wm), EntityCow (wh), EntitySnowman (wr), BlockPumpkin (amw) golem construction, EntitySnowball (zj) and ModelSnowMan (bif); see probes/MooshroomGolemProbe.java.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'mooshroom-golem-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ChickenProbe','DifficultyProbe','CombatProbe','MobSpawnerProbe','WitchProbe','ModelProbe','SlimeProbe','MooshroomGolemProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'MooshroomGolemProbe'],{maxBuffer:1<<29});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const count=c=>records.filter(r=>r.case===c).length;
const expect={facts:1,step:1,tasks:6,shear:10,bowl:12,bucket:12,breed:1,spawn:1,drops:8,build:26,trail:13,damage:28,fall:3,shoot:1,flight:3,think:14};
for(const [c,n] of Object.entries(expect))assert.equal(count(c),n,`records of ${c}`);
assert.equal(records.filter(r=>r.model).length,1);
assert.equal(records.length,Object.values(expect).reduce((a,b)=>a+b)+1,'no stray records');
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={wm:'EntityMooshroom',wh:'EntityCow',wf:'EntityAnimal',rx:'EntityAgeable',wr:'EntitySnowman',wl:'EntityGolem',wt:'EntityIronGolem',amw:'BlockPumpkin',vd:'EntityAIArrowAttack',vo:'EntityAINearestAttackableTarget',yb:'IMob',zj:'EntitySnowball',bif:'ModelSnowMan',sw:'EntityLiving',sv:'EntityLivingBase',ahb:'World'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged mooshroom/cow/snowman/iron golem/pumpkin/snowball classes on the WitchProbe world double (MooshroomGolemProbe.GW: SlimeProbe.SW plus a recording block map, a biome switch, a water flag and a light value). Every Entity.rand that matters is a seeded java.util.Random. facts/tasks/step: constants, AI task lists and the cow step sound; shear/bowl/bucket: EntityMooshroom.interact and EntityCow.interact with a real EntityPlayer double (return value, held stack, inventory, spawned entities, particles, sounds); breed: breeding items, createChild classes; spawn: EntityAnimal.getCanSpawnHere over block below and light; drops: dropFewItems over 120 seeds; build: BlockPumpkin.onBlockAdded on a block map (valid and invalid shapes, both axes, both heads; writes, spawned golem, particle counts); trail: EntitySnowman.onLivingUpdate over biomes; damage/fall: attackEntityFrom with every DamageSource and EntityLivingBase.fall; shoot/flight/think: attackEntityWithRangedAttack, a seeded EntitySnowball flight with its impact, and the AI over 160-200 ticks with a zombie, pig or player nearby. The mooshroom texture/mushroom render and sounds on the mob are bytecode-derived; the snowman model is dumped by ModelProbe.',
 render:{snowmanTexture:'textures/entity/snowman.png',mooshroomTexture:'textures/entity/cow/mooshroom.png',model:'ModelSnowMan (bif) dumped by ModelProbe (record with "model")'},
 records};
await writeFile(path.join(root,'../public/research/mooshroom-golem-reference.json'),JSON.stringify(reference)+'\n');
console.log('Original mooshroom/golem records:',records.length,'bytes:',JSON.stringify(reference).length);
