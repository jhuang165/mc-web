// Replays tools/probes/ScoreboardProbe.java against the unchanged 1.7.10 JAR (CommandScoreboard bk, Scoreboard bac, ScorePlayerTeam
// azy, ScoreboardSaveData bad, IScoreObjectiveCriteria bah, EnumChatFormatting a) and records public/research/scoreboard-reference.json,
// replayed by src/scoreboard.test.js. It also checks the GuiIngame (bbv) sidebar and Tab-list constants the port draws from bytecode.
// Needs a JDK, the pinned client JAR and the client's own library versions (see verify-commands-b13.mjs) from MC_PROBE_LIBS or
// tools/research/libs-1.7.10.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'scoreboard-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(name){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p)===name)return p;
 const p=path.join(research,'libs-1.7.10',name);if(await exists(p))return p;
 throw new Error(`Missing ${name}; list it in MC_PROBE_LIBS or copy it into tools/research/libs-1.7.10.`);
}
const libs=await Promise.all(['gson-2.2.4.jar','guava-15.0.jar','commons-lang3-3.1.jar','log4j-api-2.0-beta9.jar','log4j-core-2.0-beta9.jar','commons-io-2.4.jar','icu4j-core-mojang-51.2.jar','lwjgl-2.9.2-nightly-20140822.jar'].map(library));
async function linkOnly(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(research,'libs-1.7.10'),path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar (link-only); list it in MC_PROBE_LIBS.`);
}
libs.push(...await Promise.all(['netty-all-4','authlib-1.5'].map(linkOnly)));

const long33='This display name is 33 chars ok';
const scripts={
 objectives:['','foo','objectives','OBJECTIVES LIST','objectives list','objectives add','objectives add a','objectives add a dummy','objectives add a dummy','objectives add b nope',
  'objectives add abcdefghijklmnopq dummy','objectives add abcdefghijklmnop dummy','objectives add c health Health Points Here','objectives add d deathCount '+long33+'x','objectives add d deathCount '+long33,
  'objectives add  dummy','objectives add e stat.walkOneCm','objectives add f achievement.openInventory','objectives add g stat.mineBlock.1','objectives add h playerKillCount','objectives add i totalKillCount',
  'objectives add j stat.killEntity.Creeper','objectives add k trigger','objectives add l stat.mineBlock.minecraft.stone','objectives add m Dummy','objectives Add n dummy §cRed  Name','objectives list',
  'objectives remove','objectives remove zz','objectives remove c','objectives remove a b','objectives setdisplay','objectives setdisplay sidebar','objectives setdisplay SIDEBAR a','objectives setdisplay foo a',
  'objectives setdisplay foo zz','objectives setdisplay belowName d','objectives setdisplay list a','objectives setdisplay list','objectives setdisplay sidebar a b','objectives frob','objectives list'],
 players:['objectives add a dummy','objectives add h health','objectives add k dummy Kills','players','players list','players foo','players set','players set Bob a','players set Bob a 5 6',
  'players set Bob zz 5','players set Bob h 5','players set Bob a x','players set Bob a -2147483648','players set Bob a 2147483648','players add Bob a 0','players add Bob a 2147483647',
  'players remove Bob a 3','players remove Bob h 1','players add Carol a 1','players set Alice k 10','players set Alice a 10','players set Dave a 10','players set Eve a 10',
  'players list','players list Bob','players list Alice','players list Nobody','players list Bob x','players reset','players reset Nobody','players reset Carol','players list',
  'objectives remove a','players list','players list Dave','players set ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnop k 1','PLAYERS SET Bob K 2','players set Bob k +4','players add Bob k 1 x','players Reset Bob'],
 teams:['teams','teams list','teams foo','teams add','teams add red','teams add red','teams add abcdefghijklmnopq','teams add blue Blue Team','teams add green '+long33+'x','teams add  x',
  'teams list','teams list red','teams list zz','teams join','teams join red','teams join red Bob Alice','teams join zz Bob','teams join blue Bob Carol','teams join red Bob Bob Zed',
  'teams list','teams list red','teams list blue','teams leave','teams leave Bob Nobody','teams leave Nobody','teams empty','teams empty red','teams empty red','teams empty zz',
  'teams join red Alice Bob','teams option','teams option red','teams option zz color','teams option red foo','teams option red color','teams option red friendlyfire','teams option red SEEFRIENDLYINVISIBLES',
  'teams option red color bold','teams option red color Dark_Red','teams option red color dark red','teams option red color reset','teams option red color darkred','teams option red color dark-red',
  'teams option red friendlyfire TRUE','teams option red friendlyfire yes','teams option red seeFriendlyInvisibles false','teams option red COLOR gold','teams option blue color §c','teams option blue Color light_purple',
  'teams remove','teams remove zz','teams remove blue','teams list','teams remove red x','teams Add Yellow'],
 order:['objectives add o1 dummy','objectives add o2 dummy Second','objectives add zeta dummy','objectives add Alpha dummy','objectives add beta deathCount','objectives add o10 dummy','objectives add o11 dummy',
  'objectives add o12 dummy','objectives add o13 dummy','objectives add o14 dummy','objectives add o15 dummy','objectives add o16 dummy','objectives add o17 dummy','objectives add o18 dummy','objectives remove o12','objectives add o12 health',
  'players set Steve o1 3','players set Alex o1 3','players set Notch o1 -1','players set jeb_ o1 3','players set Dinnerbone o1 10','players set Grumm o1 0','players set Herobrine o1 3','players set Alex o2 7','players set Steve o2 7',
  'players set Zed zeta 1','players set Alex zeta 2','players set C o1 3','players set Bb o1 3','players set Aa o1 3','players set Aa o2 1','players set x o10 1','players set y o10 1','players set z o10 1',
  'teams add t1','teams add t2 Two','teams add t3','teams option t1 color red','teams option t2 color blue','teams option t3 friendlyfire false','teams option t3 seeFriendlyInvisibles false',
  'teams join t1 Steve Alex jeb_ Notch','teams join t2 Dinnerbone Grumm Herobrine','teams join t3 Aa Bb C x y z','objectives setdisplay sidebar o1','objectives setdisplay list o2','objectives setdisplay belowName zeta',
  'players list','teams list','objectives list','players list Alex'],
 empty:[],
 slotsOnly:['objectives add s dummy','objectives setdisplay belowName s','teams add only'],
};
const formatting=['red','RED','dark_red','Dark_Red','darkred','dark-red','dark red','DARKRED','dark__red','bold','reset','§c','obfuscated','light_purple','lightpurple','gray','grey','',' ','1','r e d'];
const nice=[[],['a'],['a','b'],['a','b','c'],['a','b','c','d']];
const cases={scripts,formatting,nice};

const classes=path.join(out,'classes'),probe=path.join(out,'probe'),caseFile=path.join(out,'cases.json');
await rm(out,{recursive:true,force:true});await mkdir(classes,{recursive:true});await mkdir(probe,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});await writeFile(caseFile,JSON.stringify(cases));
const cp=[probe,classes,jar,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-encoding','UTF-8','-cp',cp,'-d',probe,path.join(root,'probes/ScoreboardProbe.java')],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'ScoreboardProbe',caseFile],{maxBuffer:1<<28,cwd:out});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
assert.equal(records.filter(r=>r.case==='command').length,Object.values(scripts).flat().length);
assert.equal(records.filter(r=>r.case==='state').length,Object.keys(scripts).length);
assert.equal(records.filter(r=>r.case==='command'&&r.out.some(o=>o.t==='exception')).length,0,'no unexpected Java exceptions');
// A player's scores sit in a HashMap keyed by ScoreObjective identity hashes, so their order inside one player varies run to run
// (natively too); the round trip is therefore compared by length, and src/scoreboard.test.js compares that order as a set.
for(const r of records.filter(r=>r.case==='state'))assert.equal(r.roundTrip.length,r.nbt.length,'ScoreboardSaveData round trip of '+r.script);

const javap=async c=>(await exec('javap',['-p','-c','-constants','-cp',classes,c],{maxBuffer:1<<26})).stdout;
// GuiIngame (bbv): the sidebar method returns when getSortedScores has more than 15 entries (bipush 15 / if_icmple), draws rows
// with drawRect colours 0x50000000 / 0x60000000 and text colour 0x20FFFFFF through FontRenderer.drawString (bbu.b, no shadow); the
// Tab list draws "§e" + score (EnumChatFormatting.YELLOW, a.o) with drawStringWithShadow (bbu.a) 16777215 when it has 5+ pixels.
const gui=await javap('bbv'),side=gui.slice(gui.indexOf('private void a(azx, int, int, bbu);'));
const sideBody=side.slice(0,side.indexOf('\n\n'));
for(const s of ['bipush        15','if_icmple','int 1342177280','int 1610612736','int 553648127','Method bbu.b:(Ljava/lang/String;III)I','Method bac.i:(Lazx;)Ljava/util/Collection;','Field a.m:La;','String :'])assert.ok(sideBody.includes(s),'sidebar '+s);
assert.ok(!sideBody.includes('String #'),'1.7.10 sidebar has no # filter');
assert.ok(gui.includes('Field a.o:La;'),'Tab list YELLOW score');
const ref={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',
 classes:{bk:'CommandScoreboard',bac:'Scoreboard',azx:'ScoreObjective',azz:'Score',azy:'ScorePlayerTeam',bae:'Team',bad:'ScoreboardSaveData',bah:'IScoreObjectiveCriteria',baf:'ScoreDummyCriteria',bag:'ScoreHealthCriteria',bai:'ObjectiveStat',a:'EnumChatFormatting',y:'CommandBase',ci:'WrongUsageException',cf:'SyntaxErrorException',cd:'CommandException',du:'CompressedStreamTools',bbv:'GuiIngame'},
 method:'ScoreboardProbe runs each script line through the real CommandScoreboard.processCommand (bk.b) with d() overridden to a fresh Scoreboard per script and a plain (non-player) ICommandSender; it records addChatMessage lines (colour + unformatted text), the CommandBase.notifyAdmins hook (IAdminCommand field y.a) and thrown CommandException texts (WrongUsageException wrapped in commands.generic.usage, as CommandHandler does). After each script it dumps HashMap iteration orders, getSortedScores, formatPlayerName and ScoreboardSaveData.writeToNBT as the uncompressed CompressedStreamTools.write body of the MapStorage file {data: ...}, re-read through readFromNBT. The sidebar and Tab-list drawing is not run (it needs a GL context); verify-scoreboard.mjs checks its constants in the bytecode.',
 sidebar:{maxScores:15,hidesHashNames:false,rowHeight:9,rowBackground:'0x50000000',titleBackground:'0x60000000',textColor:'0x20FFFFFF',shadow:false,scoreFormat:'§c + score',top:'height/2 + size*9/3 - k*9 (k = 1 lowest score)',left:'width - maxWidth - 3',right:'width - 3 + 2'},
 tabList:{scoreFormat:'§e + score',minGap:5,scoreRight:'cellX + colWidth - 12 - 5',shadow:true},
 records};
await writeFile(path.join(root,'../public/research/scoreboard-reference.json'),JSON.stringify(ref)+'\n');
console.log('Scoreboard records:',records.length);
