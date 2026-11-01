// Records the unchanged 1.7.10 mob model geometry; see ModelProbe.java.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'model-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
const classes=path.join(out,'classes');await rm(classes,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/ModelProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'ModelProbe'],{maxBuffer:1<<24});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(JSON.parse);
assert.equal(records.length,11);
const digest=async name=>createHash('sha256').update((await exec('unzip',['-p',jar,name+'.class'],{encoding:'buffer',maxBuffer:1<<24})).stdout).digest('hex');
const names={bhr:'ModelBase',bix:'ModelRenderer',bis:'ModelBox',bhw:'ModelQuadruped',bhu:'ModelPig',bhi:'ModelCow',bhy:'ModelSheep2',bhx:'ModelSheep1',bhh:'ModelChicken',bhm:'ModelBiped',bip:'ModelZombie',bic:'ModelSkeleton',big:'ModelSpider',bhj:'ModelCreeper',bnh:'RenderCow',boo:'RenderPig',bpf:'RenderZombie',bos:'RenderSkeleton'};
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',classes:Object.fromEntries(await Promise.all(Object.entries(names).map(async([c,n])=>[c,{name:n,sha256:await digest(c)}]))),method:'Unchanged model constructors (ModelBox builds quads without OpenGL); every ModelRenderer field and float field is read by reflection. Box from/to are ModelBox posX1..posZ2 (uninflated), grow is the inflation read from corner 0, uv the minimum quad texture coordinate times the texture size. creeperArmor is ModelCreeper(2.0F); biped is ModelBiped(0.0F). Render classes are listed for the scale checks made by bytecode inspection: RenderCow, RenderPig and RenderZombie have no preRenderCallback scale; RenderSkeleton scales 1.2 only for wither skeletons. No game classes patched',records};
await writeFile(path.join(root,'../public/research/model-reference.json'),JSON.stringify(reference)+'\n');
console.log('Original model records:',records.length);
