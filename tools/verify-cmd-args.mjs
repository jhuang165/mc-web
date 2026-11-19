// Batch 82 commands82: records the unchanged 1.7.10 integrated-server command classes (31 common + /publish) on the CmdChatProbe server double
// (tools/probes/CmdArgsProbe.java): Tab completion (CommandHandler.getPossibleCommands) and processCommand errors/feedback for argument forms,
// in public/research/cmd-args-reference.json; src/cmd-args-b82.test.js replays it.
// Run: MC_RESEARCH=<tools/research dir> node tools/verify-cmd-args.mjs
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'cmd-args-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','authlib-1.5','netty-all-','gson-','commons-io-','commons-codec-','jopt-simple-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
// The JAR itself is last on the class path so the language table loads assets/minecraft/lang/en_US.lang from it.
const cp=[probe,classes,...libs,jar].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ChickenProbe','DifficultyProbe','SuffocationProbe','PlayerDamageProbe','CmdChatProbe','CmdArgsProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout,stderr}=await exec('java',['-cp',cp,'CmdArgsProbe'],{maxBuffer:1<<28});
if(stderr.trim())console.error(stderr.trim().split('\n').slice(0,5).join('\n'));
const lines=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
assert.equal(lines.length,1);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={z:'CommandHandler',y:'CommandBase',bz:'CommandTime',ar:'CommandGameMode',aq:'CommandDifficulty',al:'CommandDefaultGameMode',aw:'CommandKill',ca:'CommandToggleDownfall',cb:'CommandWeather',ap:'CommandXP',bv:'CommandTeleport',at:'CommandGive',am:'CommandEffect',ao:'CommandEnchant',an:'CommandEmote',bq:'CommandShowSeed',au:'CommandHelp',ak:'CommandDebug',az:'CommandMessage',ah:'CommandBroadcast',bp:'CommandSetSpawnpoint',bn:'CommandSetDefaultSpawnpoint',as:'CommandGameRule',ai:'CommandClearInventory',by:'CommandTestFor',br:'CommandSpreadPlayers',bf:'CommandPlaySound',bk:'CommandScoreboard',ae:'CommandAchievement',bu:'CommandSummon',bm:'CommandSetBlock',bx:'CommandTestForBlock',ba:'CommandMessageRaw',bg:'CommandPublishLocalServer',cd:'CommandException',ce:'NumberInvalidException?',cf:'WrongUsageException base',ci:'WrongUsageException'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Executed on the unchanged command classes of the integrated server (ServerCommandManager order: the 31 common commands, then /publish) with the CmdChatProbe server double: one real EntityPlayerMP double (Alex at 0.5,64,0.5, survival, level 5, the only player online), an allocated WorldServer holding the double world\'s World fields as worldServers[0..2], and a recording IAdminCommand set with CommandBase.setAdminCommander. tab: [text without "/", CommandHandler.getPossibleCommands result (null, a list, or "!" + throwable)]. run: [command, args, {thrown: [class, key, args] of the CommandException processCommand threw, crash: any other throwable (the double could not run it: not evidence), admin: [[flags, key, args]] notifyAdmins calls, sender: components Alex received ([fk.a JSON, formatted, unformatted])}]. processCommand is called directly: no permission test and no selector expansion.',
 tab:lines[0].tab,blocks:lines[0].blocks,run:lines[0].run};
// The block names commands.testforblock.failed.tile shows (Block.getUnlocalizedName per registry name), for src/commands.js.
await writeFile(path.join(root,'../src/block-unlocalized-data.js'),'// Generated by tools/verify-cmd-args.mjs (tools/probes/CmdArgsProbe.java): Block.getUnlocalizedName (aji.a()) of every 1.7.10 block-registry name;\n// getLocalizedName is StatCollector.translateToLocal(key + ".name"). Used by /testforblock\'s commands.testforblock.failed.tile.\nexport const BLOCK_UNLOCALIZED = '+JSON.stringify(Object.fromEntries(lines[0].blocks.map(([n,k])=>[n,k])))+';\n');
await writeFile(path.join(root,'../public/research/cmd-args-reference.json'),JSON.stringify(reference,null,1)+'\n');
console.log(`${reference.tab.length} tab records, ${reference.run.length} run records, ${reference.run.filter(r=>r[2].crash!==null).length} crashed in the double`);
