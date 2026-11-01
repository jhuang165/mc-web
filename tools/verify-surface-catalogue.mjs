// Inventory original commands, GUI hierarchy and structure/feature registrations. Requires local JDK/client JAR, joined-1.7.10.srg and Guava/log4j-api/commons-lang3/Gson libraries.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'surface-catalogue-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries'),path.join(os.homedir(),'.gradle/caches')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-','log4j-api-','commons-lang3-','gson-'].map(library));
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
const mappingFile=path.join(research,'joined-1.7.10.srg');
const mappings=await readFile(mappingFile,'utf8');
const mapped=new Map([...mappings.matchAll(/^CL: (\S+) (\S+)$/gm)].map(m=>[m[1],m[2]]));
// Class headers suffice for inheritance/abstract flags: no client GUI classes
// are initialized, no OpenGL/native libraries or browser rendering is run.
function classHeader(bytes){
 let at=8;
 const u2=()=>{const n=bytes.readUInt16BE(at);at+=2;return n;};
 const count=u2(),pool=[];
 assert.equal(bytes.readUInt32BE(0),0xcafebabe);
 for(let i=1;i<count;i++){
  const tag=bytes[at++];
  if(tag===1){const length=u2();pool[i]=bytes.toString('utf8',at,at+length);at+=length;}
  else if(tag===7){pool[i]=u2();}
  else if([8,16,19,20].includes(tag))at+=2;
  else if([3,4,9,10,11,12,17,18].includes(tag))at+=4;
  else if(tag===5||tag===6){at+=8;i++;}
  else if(tag===15)at+=3;
  else throw new Error('Unknown constant pool tag '+tag);
 }
 const flags=u2(),self=u2(),parent=u2();
 return {class:pool[pool[self]],superClass:parent?pool[pool[parent]]:null,abstract:Boolean(flags&0x0400),interface:Boolean(flags&0x0200)};
}
const headers=new Map();
for(const name of (await readdir(classes,{recursive:true})).filter(n=>n.endsWith('.class'))){
 const bytes=await readFile(path.join(classes,name)),header=classHeader(bytes);
 headers.set(header.class,{...header,mappedName:mapped.get(header.class)??header.class,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const guiBase=[...mapped].find(([,name])=>name==='net/minecraft/client/gui/GuiScreen')[0];
function isScreen(name){
 const seen=new Set();
 while(name){if(name===guiBase)return true;assert(!seen.has(name));seen.add(name);name=headers.get(name)?.superClass;}
 return false;
}
const byName=(a,b)=>a.mappedName<b.mappedName?-1:a.mappedName>b.mappedName?1:0;
const screens=[...headers.values()].filter(h=>isScreen(h.class)).sort(byName);
const guiSupport=[...headers.values()].filter(h=>h.mappedName.startsWith('net/minecraft/client/gui/')&&!isScreen(h.class)).sort(byName);
const mapGenerators=[...headers.values()].filter(h=>/^net\/minecraft\/world\/gen\/(?:structure\/)?MapGen[^$]+$/.test(h.mappedName)&&!h.mappedName.endsWith('MapGenStructureIO')&&!h.mappedName.endsWith('MapGenStructureData')).sort(byName);
const features=[...headers.values()].filter(h=>h.mappedName.startsWith('net/minecraft/world/gen/feature/WorldGen')).sort(byName);
// Parse the one dedicated/integrated branch; fail if the pinned constructor
// stops matching this control-flow shape instead of guessing profile membership.
const bytecode=(await exec('javap',['-c','-classpath',jar,'bl'])).stdout;
const constructor=bytecode.slice(bytecode.indexOf('public bl();'),bytecode.indexOf('public void a('));
const branch=constructor.match(/(\d+): invokevirtual[^\n]*MinecraftServer\.X:[^\n]*\n\s*\d+: ifeq\s+(\d+)/);
assert(branch,'Expected native dedicated-server registration branch');
const boundary=Number(branch[1]),integratedStart=Number(branch[2]);
const registrations=[...constructor.matchAll(/(\d+): new\s+[^\n]*\/\/ class (\S+)/g)].map(m=>({scope:Number(m[1])<boundary?'common':Number(m[1])<integratedStart?'dedicated':'integrated',class:m[2]}));
assert(registrations.length>40);
const inputFile=path.join(out,'commands.tsv');
await writeFile(inputFile,registrations.map(r=>`${r.scope}\t${r.class}`).join('\n')+'\n');
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/CatalogueProbe.java'),path.join(root,'probes/SurfaceCatalogueProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'SurfaceCatalogueProbe',inputFile],{maxBuffer:1<<24});
const records=stdout.trim().split('\n').map(JSON.parse);
const byKind=kind=>records.filter(r=>r.kind===kind).map(({kind,...r})=>r);
const commands=byKind('command').map(r=>({...r,mappedName:mapped.get(r.class)}));
assert.deepEqual(commands.map(r=>({scope:r.scope,class:r.class})),registrations);
const profiles=byKind('profile'),structureStarts=byKind('structureStart').map(r=>({...r,mappedName:mapped.get(r.class)})),structurePieces=byKind('structurePiece').map(r=>({...r,mappedName:mapped.get(r.class)}));
assert.deepEqual([commands.length,screens.length,guiSupport.length,structureStarts.length,structurePieces.length,mapGenerators.length,features.length],[48,58,66,5,48,10,41]);
assert.deepEqual(profiles.map(p=>[p.profile,p.lookup.length]),[['integrated',35],['dedicated',50]]);
for(const h of [...screens,...features])assert(!h.mappedName.endsWith('.class'));
for(const list of [commands,structureStarts,structurePieces])assert(list.every(r=>r.mappedName));
const provenance=Object.fromEntries(['bl','z','y','aa','avi'].map(name=>[name,headers.get(name)]));
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',mappingSha256:createHash('sha256').update(mappings).digest('hex'),classes:provenance,
 method:'Command profile membership and registration order inspected from original ServerCommandManager constructor bytecode (one isDedicatedServer branch). Individual unchanged command constructors/name/alias/default-permission/usage getters and original CommandHandler.registerCommand run; two alias lookup maps reconstructed in native registration order. ServerCommandManager constructor, permission outcomes and command execution not run; no server started. MapGenStructureIO unchanged static registration and forward/reverse maps run for all starts/pieces. GuiScreen inheritance/abstract/interface flags, other mapped client/gui namespace support classes, top-level MapGen drivers/frameworks (excluding structure IO/data helpers) and WorldGen feature classes read directly from all original JAR class headers, named by MCP SRG mapping; no GUI constructors, GL renderer, world generation or behavior executed. Class/registry enumeration is not whole-feature verification.',
 commands,profiles,screens,guiSupport,structureStarts,structurePieces,mapGenerators,features};
await writeFile(path.join(root,'../public/research/surface-registry-reference.json'),JSON.stringify(reference,null,2)+'\n');
console.log(JSON.stringify({commands:commands.length,profiles:profiles.map(p=>[p.profile,p.lookup.length]),screens:screens.length,guiSupport:guiSupport.length,mapGenerators:mapGenerators.length,structureStarts:structureStarts.length,structurePieces:structurePieces.length,features:features.length}));
