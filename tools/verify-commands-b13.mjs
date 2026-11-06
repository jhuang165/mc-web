// Replays tools/probes/CommandsProbe.java against the unchanged 1.7.10 JAR (tellraw's IChatComponent.Serializer, FontRenderer,
// GuiNewChat wrapping, achievement components, CommandSpreadPlayers and Profiler) and records public/research/commands-b13-reference.json,
// replayed by src/chat-component.test.js and src/commands-extra.test.js. It also writes src/lang-en-us.js, the full en_US.lang table
// that /tellraw translate components resolve against. Needs a JDK, the pinned client JAR and the client's own library versions
// (gson 2.2.4, guava 15.0, commons-lang3 3.1, commons-io 2.4, log4j 2.0-beta9) from MC_PROBE_LIBS or tools/research/libs-1.7.10.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'commands-b13-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(name){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p)===name)return p;
 const p=path.join(research,'libs-1.7.10',name);if(await exists(p))return p;
 throw new Error(`Missing ${name}; the 1.7.10 client ships exactly this version (later Gson versions parse differently). List it in MC_PROBE_LIBS or copy it into tools/research/libs-1.7.10.`);
}
const libs=await Promise.all(['gson-2.2.4.jar','guava-15.0.jar','commons-lang3-3.1.jar','log4j-api-2.0-beta9.jar','log4j-core-2.0-beta9.jar','commons-io-2.4.jar','icu4j-core-mojang-51.2.jar','lwjgl-2.9.2-nightly-20140822.jar'].map(library));
// Link-only: Minecraft (bao) and GuiNewChat field types must resolve for reflection, but no code of these runs, so any version works.
async function linkOnly(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(research,'libs-1.7.10'),path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar (link-only); list it in MC_PROBE_LIBS.`);
}
libs.push(...await Promise.all(['netty-all-4','authlib-1.5','lwjgl_util-2','soundsystem-','jinput-2'].map(linkOnly)));

const tellraw=[
 '"hello"','hello','hello world','{"text":"hi","color":"red","bold":true}','{text:hi,color:gold}','{"text":"a","extra":["b",{"text":"c","color":"blue"}]}',
 '["a","b",{"text":"c","italic":true}]','["",{"text":"x","color":"green"}]','[{"text":"p","color":"red"},"q"]',
 '{"translate":"chat.type.text","with":["Steve","hi"]}','{"translate":"commands.give.success","with":["Stone",64,"Steve"]}','{"translate":"%2$s %1$s","with":["a","b"]}',
 '{"translate":"100%% sure"}','{"translate":"no.such.key"}','{"translate":"chat.type.text","with":["only"]}','{"translate":"%d"}','{"translate":"%"}',
 '{"translate":"chat.type.text","with":[{"text":"S","color":"red"},"m"],"color":"gold"}','{"translate":"chat.type.text","with":[{"text":"plain"},"m"]}',
 '{"translate":"chat.type.text","with":[[],"m"]}','{"translate":"x","with":1}','{"translate":"x","with":[null]}','{"translate":"chat.type.text"}',
 '{"text":"u","clickEvent":{"action":"open_url","value":"http://example.com"}}','{"text":"r","clickEvent":{"action":"run_command","value":"/time set day"}}',
 '{"text":"s","clickEvent":{"action":"suggest_command","value":"/give "}}','{"text":"f","clickEvent":{"action":"open_file","value":"x"}}',
 '{"text":"t","clickEvent":{"action":"twitch_user_info","value":"x"}}','{"text":"b","clickEvent":{"action":"OPEN_URL","value":"x"}}','{"text":"m","clickEvent":{"action":"open_url"}}',
 '{"text":"w","clickEvent":"open_url"}','{"text":"w","clickEvent":{"action":{"a":1},"value":"x"}}','{"text":"w","clickEvent":{"action":"run_command","value":5}}',
 '{"text":"h","hoverEvent":{"action":"show_text","value":{"text":"tip","color":"red"}}}','{"text":"h","hoverEvent":{"action":"show_text","value":"tip\\nline2"}}',
 '{"text":"h","hoverEvent":{"action":"show_achievement","value":"achievement.openInventory"}}','{"text":"h","hoverEvent":{"action":"show_item","value":"{id:1,Count:1b}"}}',
 '{"text":"h","hoverEvent":{"action":"show_text","value":null}}','{"text":"h","hoverEvent":{"action":"show_text"}}','{"text":"h","hoverEvent":{"action":"show_text","value":[]}}',
 '{"text":"h","hoverEvent":{"action":"nope","value":"x"}}',
 '{"text":"c","color":"RED"}','{"text":"c","color":"bold"}','{"text":"c","color":"reset"}','{"text":"c","color":true}','{"text":"c","color":5}','{"text":"c","color":"dark_purple"}','{"text":"c","color":null}',
 '{"text":"b","bold":"true"}','{"text":"b","bold":"yes"}','{"text":"b","bold":1}','{"text":"b","bold":[true]}','{"text":"b","bold":[]}','{"text":"b","bold":{}}','{"text":"b","bold":false,"extra":["x"]}',
 '{"text":null}','{"text":123.50}','{"text":12}','{"text":true}','{"text":["a"]}','{"text":{}}','{"color":"red"}','{"text":"a","extra":[]}','{"text":"a","extra":[null]}','{"text":"a","extra":"b"}',
 '[]','[[],"a"]','[null,"a"]','null','','  ','{}','[{}]',
 '{"text":"a",}','{"text":"a"','{"text":"a','{"text":"\\u12"}','{"text":"\\uzzzz"}','{"text":"a"}x','{"text":"a"} // c','{"text":"a"} ','"a" "b"','{"text":"a"};',
 '{"text";"a"}','{"text"="a"}','{"text"=>"a"}','{/*c*/"text":"a"}','{#c\n"text":"a"}','{//c\n"text":"a"}',"{'text':'a'}",'{text:true}','{text:null}','{text:NULL}','{text:nul}','{text:12}','{text:-0.5e3}','{text:0123}','{text:1e999}',
 '["a",,"b"]','{,}','["a" "b"]','{"text":"a"]','{"text" "a"}','{"text":}','{"text":"a" "b":1}','[,]','/*','#x','/x','{"text":"\\"q\\" \\t\\\\"}','{"text":"\\x"}','{"text":"a\\',
 '{"text":"p","color":"red","extra":["c",{"text":"d","bold":true}]}','{"text":"","color":"aqua","extra":[{"translate":"chat.type.text","with":["a","b"]}]}',
 '{"text":"p","clickEvent":{"action":"run_command","value":"/say hi"},"extra":["child"]}',
 '{"text":"all","bold":true,"italic":true,"underlined":true,"strikethrough":true,"obfuscated":true,"color":"yellow"}','{"text":"o","obfuscated":true}',
 '{"text":"é§a"}','{"text":"a","text":"b"}','{"translate":"t","text":"x"}','{"text":"a","translate":"chat.type.text"}',
 '{"text":"long ","extra":[{"text":"link","underlined":true,"clickEvent":{"action":"open_url","value":"https://example.com/"}}]}',
];
const width=['hello','§lbold§r x','§cred§lB','a b','§','§l','§l ','iiii','WWWW','§Lx','§lx§cy','§lx§ry','é','一'];
const trim=[['hello world',20],['hello world',0],['§lbold text',15],['abc',6],['abc',5],['§cabc',7],['i i i i',9]];
const long='The quick brown fox jumps over the lazy dog again and again until the chat line has to wrap at least twice over';
const wrap=[[JSON.stringify(long),1,1,true],[JSON.stringify({text:long,bold:true}),1,1,true],[JSON.stringify('x'.repeat(90)),1,1,true],
 [JSON.stringify({translate:'chat.type.text',with:['Steve',long]}),1,1,true],[JSON.stringify({text:long,color:'red'}),1,1,false],
 [JSON.stringify(['abc ',{text:'d'.repeat(40),color:'blue'},' tail ',{text:'e'.repeat(30),bold:true}]),1,1,true],[JSON.stringify(long),0.5,1,true],[JSON.stringify(long),1,0.5,true],
 [JSON.stringify([{text:'§cpre '},{text:long}]),1,1,true],[JSON.stringify({text:'a'.repeat(52)+' '+'b'.repeat(10)}),1,1,true]];
const statLookup=['achievement.openInventory','achievement.mineWood','stat.walkOneCm','stat.mineBlock.1','stat.mineBlock.minecraft.stone','stat.craftItem.1','achievement.nope','*','stat.useItem.1','stat.leaveGame','stat.killEntity.Creeper','stat.entityKilledBy.Creeper'];
const spread=[[1,2,0,0,5,20],[42,5,100.5,-30,10,40],[7,1,0,0,0,1],[3,8,0,0,30,40],[99,4,0,0,100,101],[11,3,-50,50,2,3]];
const profiler=[{name:'root',map:{root:1000,'root.tick':600,'root.render':300}},{name:'root',map:{root:1000,'root.a':200,'root.a.b':50,'root.c':900}},{name:'root.tick',map:{root:1000,'root.tick':600,'root.tick.entities':100}},{name:'root',map:{root:0,'root.x':0}},{name:'none',map:{root:5}},{name:'',map:{'':500,'x':100}}];
const cases={tellraw,width,trim,wrap,statLookup,spread,profiler};

const classes=path.join(out,'classes'),probe=path.join(out,'probe'),caseFile=path.join(out,'cases.json');
await rm(out,{recursive:true,force:true});await mkdir(classes,{recursive:true});await mkdir(probe,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});await writeFile(caseFile,JSON.stringify(cases));
const cp=[probe,classes,jar,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-encoding','UTF-8','-cp',cp,'-d',probe,path.join(root,'probes/CommandsProbe.java')],{maxBuffer:1<<24});
const {stdout}=await exec('java',['-cp',cp,'CommandsProbe',caseFile],{maxBuffer:1<<28,cwd:out});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
for(const [k,n] of Object.entries({tellraw:tellraw.length,width:width.length,trim:trim.length,wrap:wrap.length,statLookup:statLookup.length,spread:spread.length,profiler:profiler.length,achievementComponent:33}))
 assert.equal(records.filter(r=>r.case===k).length,n,k);
const javap=async c=>(await exec('javap',['-p','-c','-constants','-cp',classes,c],{maxBuffer:1<<26})).stdout;
// Bytecode facts the JS port relies on and does not replay through the probe: command names, permission levels, usage keys and the
// message keys each command sends; /achievement having only "give"; spreadplayers' 10000 iteration cap and y=256 safety scan;
// /debug's file name and header.
const ach=await javap('ae');assert.match(ach,/String achievement\n/);assert.match(ach,/String give\n/);assert.doesNotMatch(ach,/String take/);assert.match(ach,/commands\.achievement\.give\.success\.all/);assert.match(ach,/commands\.achievement\.unknownAchievement/);
const sp=await javap('br');assert.match(sp,/sipush\s+10000/);assert.match(sp,/commands\.spreadplayers\.failure\./);assert.match(sp,/%\.2f/);assert.match(await javap('bs'),/sipush\s+256/);
const dbg=await javap('ak');for(const s of ['commands.debug.start','commands.debug.stop','commands.debug.notStarted','profile-results-','yyyy-MM-dd_HH.mm.ss','---- Minecraft Profiler Results ----','--- BEGIN PROFILE DUMP ---','--- END PROFILE DUMP ---'])assert.ok(dbg.includes(s),s);
const strings=[...dbg.matchAll(/\/\/ String (.*)\n/g)].map(m=>m[1].replace(/\\'/g,"'"));
const witty=strings.slice(strings.indexOf('Shiny numbers!'),strings.indexOf('Witty comment unavailable :('));
assert.equal(witty.length,14);
const lang={},full={};
for(const line of (await exec('unzip',['-p',jar,'assets/minecraft/lang/en_US.lang'],{maxBuffer:1<<24})).stdout.split('\n')){
 const i=line.indexOf('=');if(i<=0)continue;const k=line.slice(0,i),v=line.slice(i+1).replace(/\r$/,'');full[k]=v;
 if(/^commands\.(tellraw|achievement|spreadplayers|debug|scoreboard|generic)\.|^(chat\.type\.(achievement|text)|stats\.tooltip\.type\.)/.test(k))lang[k]=v;
}
await writeFile(path.join(root,'../src/lang-en-us.js'),'// Generated by tools/verify-commands-b13.mjs from assets/minecraft/lang/en_US.lang of the 1.7.10 client JAR (sha1 e80d9b3b...).\n// Loaded lazily (dynamic import) by chat-component.js so /tellraw translate components resolve like StatCollector.translateToLocal.\nexport const EN_US='+JSON.stringify(full)+';\n');
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',libraries:['gson-2.2.4','guava-15.0','commons-lang3-3.1','log4j-2.0-beta9'],
 classes:{ba:'CommandMessageRaw (tellraw)',ae:'CommandAchievement',br:'CommandSpreadPlayers',bs:'CommandSpreadPlayers.Position',ak:'CommandDebug',bk:'CommandScoreboard',fk:'IChatComponent.Serializer',fp:'ChatStyle.Serializer',fn:'ChatStyle',fq:'ChatComponentText',fr:'ChatComponentTranslation',fh:'ClickEvent',fl:'HoverEvent',bbu:'FontRenderer',bcc:'GuiNewChat',bct:'GuiChat',qi:'Profiler',qj:'Profiler.Result',pp:'StatList',pc:'AchievementList'},
 method:'CommandsProbe runs fk.a(String) on each tellraw input inside the same JsonParseException handler as CommandMessageRaw.processCommand, then records the component\'s formatted/unformatted text, its iteration with resolved styles and fk.a(fj). FontRenderer and GuiNewChat run on Unsafe-allocated instances with the ascii glyph widths of menu-screens.js. CommandSpreadPlayers\' private func_110670_a / func_110668_a run with a seeded java.util.Random (the command itself uses an unseeded one) on an allocated WorldClient whose getBlock at y=256 is air. Profiler.getProfilingData runs on a filled profilingMap.',
 wittyComments:witty,lang,records};
await writeFile(path.join(root,'../public/research/commands-b13-reference.json'),JSON.stringify(reference)+'\n');
console.log('Commands b13 records:',records.length);
