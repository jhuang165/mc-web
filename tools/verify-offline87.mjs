// Batch 87 offline87: executes tools/probes/Offline87Probe.java on the unchanged 1.7.10 classes and writes public/research/offline87-reference.json: the offline-mode login
// profile (NetHandlerLoginServer.func_152506_a), the entity UUID (EntityPlayer.func_146094_a) and every EnumConnectionState packet map, with the MCP names of the packet classes
// (tools/research/joined-1.7.10.srg). src/offline87-b87.test.js replays it.
// Run: MC_PROBE_LIBS=<netty-all-4.0.10.Final.jar>:<trove4j-3.0.3.jar> MC_RESEARCH=<tools/research dir> node tools/verify-offline87.mjs (needs a JDK).
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'offline87-probe');
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
if(!await exists(path.join(classes,'nn.class'))){await mkdir(classes,{recursive:true});await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});}
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/Offline87Probe.java')],{maxBuffer:1<<24});
const {stdout,stderr}=await exec('java',['-cp',cp,'Offline87Probe'],{maxBuffer:1<<26});
if(stderr.trim())console.error(stderr.trim().split('\n').slice(0,5).join('\n'));
const line=stdout.trim().split('\n').filter(l=>l.startsWith('{"offline"'));
assert.equal(line.length,1);
const data=JSON.parse(line[0]);
const srg=new Map();for(const l of (await readFile(path.join(research,'joined-1.7.10.srg'),'utf8')).split('\n')){const m=/^CL: (\S+) (\S+)$/.exec(l);if(m)srg.set(m[1],m[2].split('/').pop());}
const named=o=>Object.fromEntries(Object.entries(o).map(([id,c])=>[id,srg.get(c)??c]));
for(const s of data.states){s.serverbound=named(s.serverbound);s.clientbound=named(s.clientbound);}
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={nn:'NetHandlerLoginServer',yz:'EntityPlayer',eo:'EnumConnectionState',fa:'MessageSerializer',ez:'MessageDeserializer',ayq:'SaveHandler',oi:'ServerConfigurationManager'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Executed on the unchanged classes (tools/probes/Offline87Probe.java): NetHandlerLoginServer.func_152506_a on a handler allocated without its constructor (the method reads no fields), EntityPlayer.func_146094_a on a name-only and a complete profile, and EnumConnectionState.values() with its a() (client to server) and b() (server to client) packet BiMaps; class names mapped with joined-1.7.10.srg.',
 ...data};
await writeFile(path.join(root,'../public/research/offline87-reference.json'),JSON.stringify(reference,null,1)+'\n');
console.log(`${reference.offline.length} offline profiles, ${reference.states.map(s=>`${s.name} ${Object.keys(s.serverbound).length}/${Object.keys(s.clientbound).length}`).join(', ')}`);
