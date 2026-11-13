// Records the unchanged 1.7.10 CommandMessage (az), CommandBroadcast (ah), CommandEmote (an), CommandBase (y) and PlayerSelector (ad) on a server double
// (tools/probes/CmdChatProbe.java) in public/research/cmd-chat-reference.json; src/cmd-chat-b56.test.js replays it.
// Run: MC_RESEARCH=<tools/research dir> node tools/verify-cmd-chat.mjs
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'cmd-chat-probe');
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
await exec('javac',['-nowarn','-cp',cp,'-d',probe,...['MobMoveProbe','ChickenProbe','DifficultyProbe','SuffocationProbe','PlayerDamageProbe','CmdChatProbe'].map(n=>path.join(root,`probes/${n}.java`))],{maxBuffer:1<<24});
const {stdout,stderr}=await exec('java',['-cp',cp,'CmdChatProbe'],{maxBuffer:1<<28});
if(stderr.trim())console.error(stderr.trim().split('\n').slice(0,5).join('\n'));
const lines=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
assert.equal(lines.length,1);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={az:'CommandMessage',ah:'CommandBroadcast',an:'CommandEmote',y:'CommandBase',ad:'PlayerSelector',oi:'ServerConfigurationManager',cd:'CommandException'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Executed on the unchanged command classes (the client jar carries the integrated server) with a server double: three real EntityPlayerMP doubles (Alex at 0.5,64,0.5 survival level 5, Steve at 10.5,64,0.5 survival level 20, Bob at 200.5,64,0.5 creative; Alex and Steve in team red) in one world, recording NetHandlerPlayServer, and stub console ("Server") and command-block ("@") senders at 0,0,0. facts: [name, getCommandName, aliases, usage key, permission level, isUsernameIndex(args, 0..3)]. records: [scenario (trio or solo: only Alex online), command, sender, args, {count: the CommandHandler.executeCommand result, out: {player: [[fk.a JSON, formatted, unformatted]]}, sender: [...]}] with out entries holding the components each player received (S02PacketChat) and sender what addChatMessage received (the real CommandHandler runs the line: red error translations arrive here; a username-index selector runs once per matched player). @r rows with several candidates are unseeded in the game and are not recorded.',
 facts:lines[0].facts,records:lines[0].records};
await writeFile(path.join(root,'../public/research/cmd-chat-reference.json'),JSON.stringify(reference,null,1)+'\n');
console.log(`${reference.records.length} records`);
