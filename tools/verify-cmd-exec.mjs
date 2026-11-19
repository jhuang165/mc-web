// Batch 83 cmdexec83: records the 1.7.10 command forms the b82 double could not run (tools/probes/CmdExec83Probe.java): /kill, the /tp moves (relative,
// the y range, a riding player), /clear on a real inventory, /debug stop, /achievement give and the stat/achievement Tab lists, the height checks of
// /summon /setblock /testforblock, and the Entity.readFromNBT keys /summon's data tag sets for every EntityList name.
// Writes public/research/cmd-exec-reference.json; src/cmd-exec-b83.test.js replays it. Run: MC_RESEARCH=<tools/research dir> node tools/verify-cmd-exec.mjs
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'cmd-exec-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ChickenProbe','DifficultyProbe','SuffocationProbe','PlayerDamageProbe','CmdChatProbe','CmdArgsProbe','CmdExec83Probe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout,stderr}=await exec('java',['-cp',cp,'CmdExec83Probe'],{maxBuffer:1<<28});
if(stderr.trim())console.error(stderr.trim().split('\n').slice(0,5).join('\n'));
const lines=stdout.trim().split('\n').filter(l=>l.startsWith('{"tab"')).map(l=>JSON.parse(l));
assert.equal(lines.length,1);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={aw:'CommandKill',bv:'CommandTeleport',ai:'CommandClearInventory',ak:'CommandDebug',ae:'CommandAchievement',bu:'CommandSummon',bm:'CommandSetBlock',bx:'CommandTestForBlock',bk:'CommandScoreboard',y:'CommandBase',sa:'Entity',sg:'EntityList',yx:'InventoryPlayer',mw:'EntityPlayerMP',nh:'NetHandlerPlayServer',pg:'StatisticsFile',pp:'StatList',pc:'AchievementList'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Executed on the unchanged command classes (tools/probes/CmdExec83Probe.java) with the CmdArgsProbe server double extended: a fresh pair of real EntityPlayerMP doubles per record (Alex 0.5,64,0.5 yaw 30 pitch 10; Steve 10.25,70,-3.75 yaw 90 pitch -20) with MinecraftServer, a real StatisticsFile, ContainerPlayer and a NetHandlerPlayServer whose real setPlayerLocation moves them; StatList and AchievementList initialised; MinecraftServer.theProfiler real; World.blockExists as its bytecode (y 0..255, chunks loaded); spawnEntityInWorld recorded (b85 fire85: egg = 280 CommandSummon runs per [name, tag] of an ocelot and a sheep (spawned counts, then the first sheep Color); invulnerable = [name, Invulnerable, source, attackEntityFrom result, isDead, health, error]). run: [command, args, setup (pair: both online; solo: Alex only; creative: Alex in creative; riding: Alex on a pig at 5.5,64,5.5; inv / invCursor: Alex holds stone x10, stone:1 x5, coal x3, charcoal x4, diamond_sword:10, wool:3 x7, iron_boots worn, invCursor adds stone x2 on the cursor), {thrown, crash, admin (notifyAdmins), chat (components each player received; ["packet"] for other packets), state}]. summon: [EntityList name, data tag, {crash, admin, spawned: [{cls, fire (Entity.fire), nbt: {key: NBTBase.toString of writeToNBT}}]}].',
 tab:lines[0].tab,run:lines[0].run,summon:lines[0].summon,egg:lines[0].egg,invulnerable:lines[0].invulnerable};
await writeFile(path.join(root,'../public/research/cmd-exec-reference.json'),JSON.stringify(reference,null,1)+'\n');
console.log(`${reference.tab.length} tab, ${reference.run.length} run (${reference.run.filter(r=>r[3].crash!==null).length} crashed), ${reference.summon.length} summon (${reference.summon.filter(r=>r[2].crash!==null).length} crashed)`);
