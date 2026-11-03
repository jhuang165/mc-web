// Records unchanged EntitySilverfish / BlockSilverfish (and the generic spawner with entityId Silverfish); see probes/SilverfishProbe.java.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'silverfish-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ChickenProbe','DifficultyProbe','CombatProbe','MobSpawnerProbe','SilverfishProbe'].map(n=>path.join(root,`probes/${n}.java`)),path.join(root,'probes/ModelProbe.java')],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'SilverfishProbe'],{maxBuffer:1<<28});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const count=c=>records.filter(r=>r.case===c).length;
assert.equal(count('facts'),1);assert.equal(count('model'),1);assert.ok(count('chase')>=5&&count('wake')>=48&&count('break')===24&&count('scenario')===5,'record counts');
const javap=async c=>(await exec('javap',['-c','-p','-constants','-cp',classes,c],{maxBuffer:1<<24})).stdout;
const bor=await javap('bor');
assert.match(bor,/textures\/entity\/silverfish\.png/);assert.ok(bor.includes('float 0.3f')&&bor.includes('float 180.0f'));
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={yk:'EntitySilverfish',amb:'BlockSilverfish',yg:'EntityMob',td:'EntityCreature',sw:'EntityLiving',bor:'RenderSilverfish',bia:'ModelSilverfish',agq:'MobSpawnerBaseLogic'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged EntitySilverfish.updateEntityActionState (yk.bq, the legacy non-AI-task path: EntityCreature.bq then the summon scan and the hide step) called directly on a constructor-less World double with the real PathFinder, real getClosestVulnerablePlayerToEntity and rayTrace. Entity physics is not run: after each call the fish is moved 0.1 block along its yaw while moveForward > 0 (kinematic step; positions are recorded and replayed, not recomputed). x,y,z in a tick row are after that step, state is the entity Random (LCG) state after the call, calls the number of next() draws. paths lists every getPathEntityToEntity/ToBlock request and result in call order. Block cases replay ItemInWorldManager.tryHarvestBlock (onBlockHarvested, setBlockToAir, onBlockDestroyedByPlayer, then harvestBlock unless Creative). Spawner scenarios are the generic MobSpawnerBaseLogic with entityId Silverfish (see mob-spawner-reference.json for the row format).',
 render:{texture:'textures/entity/silverfish.png',shadowSize:0.3,deathMaxRotation:180,model:'ModelSilverfish: 7 body segments and 3 layer boxes, texture 64x32'},
 records};
await writeFile(path.join(root,'../public/research/silverfish-reference.json'),JSON.stringify(reference)+'\n');
console.log('Original silverfish records:',records.length,'bytes:',JSON.stringify(reference).length);
