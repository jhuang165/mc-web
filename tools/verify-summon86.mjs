// Batch 86 summon86: CommandSummon's onSpawnWithEgg order (tools/probes/Summon86Probe.java, on CmdExec83Probe's server double): the list order, entity ids and
// riding links of the entities an untagged /summon creates, per World.rand seed, and World.rand's next long after the command.
// Writes public/research/summon86-reference.json; src/summon86-b86.test.js replays it. Run: MC_RESEARCH=<tools/research dir> node tools/verify-summon86.mjs
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'summon86-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','log4j-core-','commons-lang3-','authlib-1.5','netty-all-','gson-','commons-io-','commons-codec-','jopt-simple-'].map(library));
const classes=path.join(out,'classes');
if(!await exists(path.join(classes,'bu.class'))){await mkdir(classes,{recursive:true});await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});}
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs,jar].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ChickenProbe','DifficultyProbe','SuffocationProbe','PlayerDamageProbe','CmdChatProbe','CmdArgsProbe','CmdExec83Probe','Summon86Probe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout,stderr}=await exec('java',['-cp',cp,'Summon86Probe'],{maxBuffer:1<<28});
if(stderr.trim())console.error(stderr.trim().split('\n').slice(0,5).join('\n'));
const lines=stdout.trim().split('\n').filter(l=>l.startsWith('{"order"')).map(l=>JSON.parse(l));
assert.equal(lines.length,1);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={bu:'CommandSummon',sa:'Entity',sg:'EntityList',sw:'EntityLiving',wn:'EntityOcelot',yn:'EntitySpider',yq:'EntityZombie',yh:'EntityPigZombie',yl:'EntitySkeleton',wg:'EntityChicken',wp:'EntitySheep',yv:'EntityVillager',wi:'EntityHorse'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Executed on the unchanged CommandSummon (tools/probes/Summon86Probe.java) with CmdExec83Probe\'s server double (Alex at 0.5,64,0.5, Normal, 1 June 2014, every chunk loaded, spawnEntityInWorld recorded in order). Each run: World.rand = new Random(seed), seed = run index * 0x9E3779B97F4A7C15 (64-bit), then "/summon <name> 0.5 64 0.5" with no data tag. order: [name, seeds run, rows]; row = [seed (decimal string), [[class, entityId - lowest id of the run, index of ridingEntity in the spawned list or -1, {writeToNBT values of Age, IsBaby, IsVillager, Color, Profession, SkeletonType, Type, Variant, CatType, CanPickUpLoot}]... in spawnEntityInWorld order], World.rand.nextLong() after the command (decimal string), crash?]. Seeds past 39 are kept only when more than one entity spawned.',
 order:lines[0].order};
await writeFile(path.join(root,'../public/research/summon86-reference.json'),JSON.stringify(reference)+'\n');
for(const [n,runs,rows] of reference.order)console.log(n,runs,'rows',rows.length,'multi',rows.filter(r=>r[1].length>1).length,'crash',rows.filter(r=>r[3]).length);
