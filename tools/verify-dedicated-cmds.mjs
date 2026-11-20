// Batch 84 dedicated84: executes the dedicated-server-only commands (tools/probes/Dedicated84Probe.java) on the unchanged 1.7.10 classes and writes public/research/dedicated-cmds-reference.json,
// which src/dedicated-cmds-b84.test.js replays. Run: MC_RESEARCH=<tools/research dir> node tools/verify-dedicated-cmds.mjs (needs a JDK; the lists are written to a temporary working directory).
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'dedicated84-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ChickenProbe','DifficultyProbe','SuffocationProbe','PlayerDamageProbe','CmdChatProbe','Dedicated84Probe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});

const work=await (await import('node:fs/promises')).mkdtemp(path.join(os.tmpdir(),'dedicated84-'));
const {stdout,stderr}=await exec('java',['-cp',cp,'Dedicated84Probe'],{maxBuffer:1<<29,cwd:work});
if(stderr.trim())console.error(stderr.trim().split('\n').slice(0,5).join('\n'));
const line=stdout.trim().split('\n').filter(l=>l.startsWith('{"run"'));
assert.equal(line.length,1);
const data=JSON.parse(line[0]);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={bl:'ServerCommandManager',bc:'CommandOp',aj:'CommandDeOp',ag:'CommandBanPlayer',af:'CommandBanIp',be:'CommandPardonPlayer',bd:'CommandPardonIp',ax:'CommandListBans',cc:'CommandWhitelist',av:'CommandServerKick',ay:'CommandListPlayers',bh:'CommandSaveAll',bj:'CommandSaveOn',bi:'CommandSaveOff',bt:'CommandStop',bo:'CommandSetPlayerTimeout',bb:'CommandNetstat',oi:'ServerConfigurationManager',ns:'PlayerProfileCache',op:'UserListBans',nx:'BanList',oj:'UserListOps',or:'UserListWhitelist'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Executed on the unchanged classes (tools/probes/Dedicated84Probe.java): the real ServerCommandManager and CommandHandler.executeCommand, a real ServerConfigurationManager with its four UserLists and a real PlayerProfileCache, real EntityPlayerMP doubles (Alex op, Steve, Eve sharing 10.0.0.2) with the real permission check, a MinecraftServer double (isDedicatedServer true) and three WorldServer doubles. DedicatedServer and DedicatedPlayerList are not in the client jar (func_143006_e persistence, whitelist reload, file loading are not covered). created dates are masked. b86 console86: the console sender is the MinecraftServer double itself (the real b_() "Server", a(int, String) true, a(fj) records the console line), the offline setup is online mode Y() false, and /netstat reads the real NetworkStatistics of an idle server.',
 ...data};
await writeFile(path.join(root,'../public/research/dedicated-cmds-reference.json'),JSON.stringify(reference)+'\n');
console.log(`${reference.run.length} run (${reference.run.filter(r=>r[3].crash!==null).length} crashed), ${reference.tab.length} tab`);
