// Records how the unchanged 1.7.10 ResourcePackRepository.Entry loads a zip pack's pack.mcmeta and draws its row text (tools/probes/PackMetaProbe.java) in
// public/research/pack-meta-reference.json; src/potspacks80-b80.test.js replays it through src/resource-packs.js.
// Run: MC_RESEARCH=<tools/research dir> node tools/verify-pack-meta.mjs   (needs a JDK and tools/research/libs-1.7.10)
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'pack-meta-probe'),libDir=path.join(research,'libs-1.7.10');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
const libs=(await readdir(libDir)).filter(n=>n.endsWith('.jar')&&!n.includes('sources')).map(n=>path.join(libDir,n));
// The client jar has no en_US.lang; StringTranslate (de) and the StatCollector fallback translator read this stub from the classpath. Real keys take the
// port's en_US value; "probe.unsupported" is synthetic (an unsupported conversion, which no 1.7.10 key has).
const {EN_US}=await import(path.join(root,'../src/lang-en-us.js'));
const lang={...Object.fromEntries(['resourcePack.title','death.attack.player','chat.type.text','commands.give.success','options.languageWarning','translation.test.escape'].map(k=>{assert.ok(EN_US[k]!=null,k);return [k,EN_US[k]];})),'probe.unsupported':'%x and %s'};
const res=path.join(out,'res');await rm(res,{recursive:true,force:true});await mkdir(path.join(res,'assets/minecraft/lang'),{recursive:true});
await writeFile(path.join(res,'assets/minecraft/lang/en_US.lang'),Object.entries(lang).map(([k,v])=>k+'='+v).join('\n')+'\n');
const probe=path.join(out,'probe');await rm(probe,{recursive:true,force:true});await mkdir(probe,{recursive:true});
// The jar is signed and the probe sits in the default package, so the classes run unpacked.
const classes=path.join(out,'classes');if(!await exists(path.join(classes,'brf.class'))){await mkdir(classes,{recursive:true});await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});}
const cp=[probe,res,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/PackMetaProbe.java')],{maxBuffer:1<<24});
const P=(d,f=1)=>JSON.stringify({pack:{pack_format:f,description:d}});
const CASES=[
 P('plain'),
 JSON.stringify({pack:{description:'no format'}}),
 P('string format','1'),P('fraction format',1.7),P('format two',2),P('format zero',0),P('format negative',-1),P('bool format',true),
 JSON.stringify({pack:{pack_format:1}}),'{"pack":{"pack_format":1,"description":null}}',
 '{}','{"other":{}}','{"pack":5}','{"pack":[]}','[]','"text"','','   ','not json {','{"pack":{"pack_format":1,"description":"x"}} trailing','{"pack":{"pack_format":1,"description":"x"}}{}',
 "{pack:{pack_format:1,description:'lenient'}}",'﻿'+P('bom'),'{"pack":{"pack_format":1,"description":"a","description":"b"}}',
 '<missing>',
 P({translate:'resourcePack.title'}),
 P({translate:'death.attack.player',with:['Steve','Zombie']}),
 P({translate:'chat.type.text',with:[{text:'Alex',color:'gold'},'hi']}),
 P({translate:'commands.give.success',with:['Stone',64,'Alex']}),
 P({translate:'no.such.key'}),
 P({translate:'no.such.key',with:['ignored']}),
 P({translate:'options.languageWarning'}),
 P({translate:'translation.test.escape',with:['A']}),
 P({translate:'death.attack.player',with:['only one']}),
 P({translate:'probe.unsupported',with:['a']}),
 P({translate:'chat.type.text',with:[{translate:'resourcePack.title'},{text:'x',bold:true}]}),
 P({translate:'resourcePack.title',color:'red',extra:[' tail']}),
 P({translate:'death.attack.player',color:'aqua',with:['A',{text:'B',color:'green'}]}),
 P({translate:'resourcePack.title',with:'notarray'}),
 P({translate:'resourcePack.title',with:[]}),
 P({translate:5}),
 P({text:'t',translate:'resourcePack.title'}),
 P([{translate:'resourcePack.title'},' after']),
 P([]),P({}),P({text:'x',extra:'y'}),P(5),P({translate:'death.attack.player',with:[1.5,true]}),'{"pack":{"pack_format":1e2,"description":"exp"}}','{"pack":{"pack_format":4294967297,"description":"wide"}}',
];
const {stdout}=await exec('java',['-cp',cp,'PackMetaProbe',...CASES],{maxBuffer:1<<26});
const lines=stdout.trim().split('\n').filter(l=>l.startsWith('{"rows"')).map(l=>JSON.parse(l));
assert.equal(lines.length,1);assert.equal(lines[0].rows.length,CASES.length);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={brf:'ResourcePackRepository$Entry',bqn:'AbstractResourcePack',bqr:'FileResourcePack',brw:'IMetadataSerializer',bsh:'PackMetadataSectionSerializer',bsg:'PackMetadataSection',pu:'JsonUtils',fk:'IChatComponent$Serializer',fr:'ChatComponentTranslation',dd:'StatCollector',de:'StringTranslate'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Executed: each pack.mcmeta text is zipped and loaded by the unchanged ResourcePackRepository.Entry.updateResourcePack (brf.a) with a brw that has bsh registered for bsg (as Minecraft.<init> does), then the row text brf.e() is read. Rows: [pack.mcmeta ("<missing>": none), exception from brf.a (the repository then leaves the pack out of its list) or null, pack_format or null, brf.e() or null, exception from brf.e() or null]. The lang table below is a classpath stub.',
 lang,rows:lines[0].rows};
await writeFile(path.join(root,'../public/research/pack-meta-reference.json'),JSON.stringify(reference,null,1)+'\n');
console.log(`${reference.rows.length} rows`);
