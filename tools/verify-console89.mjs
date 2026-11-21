// Batch 89 console89: executes tools/probes/Console89Probe.java on the unchanged 1.7.10 classes and writes public/research/console89-reference.json: S21/S26 record sizes
// (with the packets' own Deflater(-1)) and the undeflated data length and SHA-256 for chunks built from a formula, an S2F whose ItemStack has an NBT tag (and that tag's
// gzip length), and S40 kick texts. src/console89-b89.test.js rebuilds the same data with src/multiplayer/net-native-bytes.js and compares.
// Run: MC_PROBE_LIBS=<netty-all-4.0.10.Final.jar> MC_RESEARCH=<tools/research dir> node tools/verify-console89.mjs (needs a JDK).
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'console89-probe');
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
if(!await exists(path.join(classes,'gx.class'))){await mkdir(classes,{recursive:true});await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});}
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes,...libs].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/Console89Probe.java')],{maxBuffer:1<<24});
const {stdout,stderr}=await exec('java',['-cp',cp,'Console89Probe'],{maxBuffer:1<<26});
if(stderr.trim())console.error(stderr.trim().split('\n').slice(0,5).join('\n'));
const line=stdout.trim().split('\n').filter(l=>l.startsWith('{"chunks"'));
assert.equal(line.length,1);
const data=JSON.parse(line[0]);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={gx:'S21PacketChunkData',gz:'S26PacketMapChunkBulk',et:'PacketBuffer',du:'CompressedStreamTools',gs:'S40PacketDisconnect'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',javaVersion:(await exec('java',['-version'])).stderr.split('\n')[0],classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),
 method:'Executed on the unchanged classes (tools/probes/Console89Probe.java): chunks (apx) built from the formula in the probe (sections 0-3 hold blocks below y 64, section 4 exists with light only), written as S21 (gx(apx, full, mask)) and S26 (gz(List)) after the id VarInt, as the encoder fa counts them; the undeflated data is gx.a(apx, full, mask).a. An S2F (gq) with a tagged ItemStack, the tag gzip length (du.a), and S40 (gs(fq(text))) for the kick texts.',
 ...data};
await writeFile(path.join(root,'../public/research/console89-reference.json'),JSON.stringify(reference,null,1)+'\n');
console.log(reference.chunks.map(r=>`${r.name}: ${r.bytes} (data ${r.dataLength})`).join('\n'));console.log(reference.items.map(r=>`${r.name}: ${r.bytes}${r.gzip?` gzip ${r.gzip}`:''}`).join('\n'));console.log(reference.kicks.map(r=>`${r.text}: ${r.bytes}`).join('\n'));
