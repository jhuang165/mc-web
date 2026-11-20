// Batch 88 console88: executes tools/probes/Console88Probe.java on the unchanged 1.7.10 classes and writes public/research/console88-reference.json: the record size
// (id VarInt + payload, what the encoder fa passes to NetworkStatistics) of every packet with empty fields, and of chosen samples. src/console88-b88.test.js replays it
// against src/multiplayer/net-packet-ids.js's estimates.
// Run: MC_PROBE_LIBS=<netty-all-4.0.10.Final.jar> MC_RESEARCH=<tools/research dir> node tools/verify-console88.mjs (needs a JDK).
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'console88-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
async function library(prefix){
 for(const p of (process.env.MC_PROBE_LIBS||'').split(path.delimiter).filter(Boolean))if(path.basename(p).startsWith(prefix))return p;
 for(const dir of [path.join(research,'libs-1.7.10'),path.join(os.homedir(),'Library/Application Support/minecraft/libraries'),path.join(os.homedir(),'.minecraft/libraries')]){
  if(!await exists(dir))continue;const {stdout}=await exec('find',[dir,'-name',prefix+'*.jar','-not','-name','*sources*'],{maxBuffer:1<<24});const hit=stdout.split('\n').filter(Boolean).sort()[0];if(hit)return hit;
 }
 throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs=await Promise.all(['guava-15','log4j-api-','log4j-core-','commons-lang3-','authlib-1.5','netty-all-4.0','trove4j-','commons-io-','gson-2.2'].map(library));
const classes=path.join(out,'classes');
if(!await exists(path.join(classes,'fa.class'))){await mkdir(classes,{recursive:true});await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});}
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/Console88Probe.java')],{maxBuffer:1<<24});
const {stdout,stderr}=await exec('java',['-cp',cp,'Console88Probe'],{maxBuffer:1<<26});
if(stderr.trim())console.error(stderr.trim().split('\n').slice(0,5).join('\n'));
const line=stdout.trim().split('\n').filter(l=>l.startsWith('{"base"'));
assert.equal(line.length,1);
const data=JSON.parse(line[0]);
const srg=new Map();for(const l of (await readFile(path.join(research,'joined-1.7.10.srg'),'utf8')).split('\n')){const m=/^CL: (\S+) (\S+)$/.exec(l);if(m)srg.set(m[1],m[2].split('/').pop());}
for(const r of data.base)r.name=srg.get(r.class)??r.class;
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={fa:'MessageSerializer',et:'PacketBuffer',eo:'EnumConnectionState',fk:'IChatComponent$Serializer'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Executed on the unchanged classes (tools/probes/Console88Probe.java): each packet class of each EnumConnectionState and direction, built with its no-argument constructor and empty fields (0, "", empty arrays and collections, fq(""), first enum constant, a static instance), written with ft.b(et) after the id VarInt (et.b), as the encoder fa does before eu.b(id, readableBytes); plus samples with chosen fields. Class names via joined-1.7.10.srg.',
 ...data};
await writeFile(path.join(root,'../public/research/console88-reference.json'),JSON.stringify(reference,null,1)+'\n');
const errs=reference.base.filter(r=>typeof r.bytes!=='number');
console.log(`${reference.base.length} packets (${errs.length} not writable empty: ${errs.map(r=>r.name+' '+r.bytes).join(', ')}), ${reference.samples.length} samples`);
