// Run the unchanged 1.7.10 ImageBufferDownload (bmc, parseUserSkin) on test images (tools/probes/SkinParseProbe.java). Needs the pinned
// 1.7.10 JAR and a JDK; writes public/research/skin-parse-reference.json, replayed by src/skins73-b73.test.js.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false),researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'skin-parse-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
const classes=path.join(out,'classes');
await rm(out,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'bmc.class','blx.class','-d',classes]);
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/SkinParseProbe.java')]);
const {stdout}=await exec('java',['-Djava.awt.headless=true','-cp',cp,'SkinParseProbe'],{maxBuffer:1<<28});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
assert.equal(records.length,14);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:{bmc:{name:'ImageBufferDownload',sha256:await digest('bmc')}},
 method:'Executed headless on the unchanged ImageBufferDownload (bmc).a(BufferedImage), i.e. parseUserSkin. Each record: case, input size, input ARGB pixels (TYPE_INT_ARGB, big-endian ints, base64), output size/type and output ARGB pixels. Output is always a 64 x 32 TYPE_INT_ARGB (2) image; a null input returns null.',records};
await writeFile(path.join(root,'../public/research/skin-parse-reference.json'),JSON.stringify(reference,null,1)+'\n');
console.log('wrote',records.length,'records');
