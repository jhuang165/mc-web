// Records the unchanged 1.7.10 EntityGiantZombie and RenderGiantZombie registration; see probes/GiantProbe.java.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'giant-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ChickenProbe','DifficultyProbe','CombatProbe','MobSpawnerProbe','SilverfishProbe','GiantProbe'].map(n=>path.join(root,`probes/${n}.java`)),path.join(root,'probes/ModelProbe.java')],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'GiantProbe'],{maxBuffer:1<<28});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
const count=c=>records.filter(r=>r.case===c).length;
assert.equal(count('facts'),1);assert.equal(count('pathWeight'),4);assert.equal(count('attack'),56);
const javap=async c=>(await exec('javap',['-c','-p','-constants','-cp',classes,c],{maxBuffer:1<<24})).stdout;
const bnu=await javap('bnu'),bnn=await javap('bnn'),ye=await javap('ye'),sg=await javap('sg');
assert.match(bnu,/textures\/entity\/zombie\/zombie\.png/);assert.ok(bnu.includes('glScalef'));
assert.match(bnn,/class ye\n[^]*?class bnu\n[^]*?class bip\n[^]*?float 0\.5f\n[^]*?float 6\.0f/);
assert.match(sg,/class ye\n[^]*?String Giant\n\s+\d+: bipush\s+53/);
assert.ok(ye.includes('float 6.0f')&&ye.includes('double 100.0d')&&ye.includes('double 0.5d')&&ye.includes('double 50.0d'));
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={ye:'EntityGiantZombie',yg:'EntityMob',td:'EntityCreature',sw:'EntityLiving',bnu:'RenderGiantZombie',bip:'ModelZombie',bnn:'RenderManager',sg:'EntityList'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Unchanged EntityGiantZombie (ye) constructed on SilverfishProbe\'s constructor-less World double (Entity.rand pinned): size, yOffset, attributes, sounds, getBlockPathWeight by light, EntityMob.attackEntity (yg.a(sa, F), run protected through a subclass whose attackEntityAsMob counts hits) over distance, attack timer and target box, experience value and drop item. EntityList id 53 "Giant", the RenderManager registration (new RenderGiantZombie(new ModelZombie(), 0.5F, 6.0F): glScalef(6) in preRenderCallback, textures/entity/zombie/zombie.png) and the constructor constants are asserted from javap. No natural spawning or spawn egg exists (EntityList.entityEggs has no 53).',
 render:{texture:'textures/entity/zombie/zombie.png',model:'ModelZombie',shadowSize:0.5,scale:6},
 records};
await writeFile(path.join(root,'../public/research/giant-reference.json'),JSON.stringify(reference)+'\n');
console.log('Original giant records:',records.length);
