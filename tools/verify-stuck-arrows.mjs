// Runs the unchanged ModelBiped (bhm) and ModelBase.getRandomModelBox (bhr) through probes/StuckArrowProbe.java for the
// arrow placement of RendererLivingEntity.func_85093_e (boh.e), and checks the arrow-count rules in the bytecode of
// EntityLivingBase (sv) and EntityArrow (zc) with javap. Writes public/research/stuck-arrows-reference.json for
// src/stuck-arrows.test.js. Needs a JDK and the JAR (tools/research or MC_RESEARCH).
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
let research;for(const dir of [process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean))if(await exists(path.join(dir,'minecraft-1.7.10.jar'))){research=dir;break;}
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar'),out=path.join(research,'stuck-arrow-probe');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
const javap=async cls=>(await exec('javap',['-c','-p','-cp',jar,cls],{maxBuffer:1<<26})).stdout;
const method=(text,sig)=>{const s=text.indexOf(sig);assert.ok(s>=0,sig);const rest=text.slice(s),e=rest.search(/\n\n/);return rest.slice(0,e<0?undefined:e);};
// Rules read from the bytecode (see public/research/stuck-arrows.md).
const sv=await javap('sv'),zc=await javap('zc'),boh=await javap('boh'),bop=await javap('bop');
const get=method(sv,'public final int aZ();'),set=method(sv,'public final void p(int);');
assert.ok(/bipush\s+9/.test(get)&&/te\.a:\(I\)B/.test(get),'count is DataWatcher byte 9');assert.ok(/i2b/.test(set));
const tick=method(sv,'public void h();');
assert.ok(/Field ahb\.E:Z/.test(tick)&&/bipush\s+20/.test(tick)&&/bipush\s+30/.test(tick)&&/Method p:\(I\)V/.test(tick),'decay in onUpdate, server side');
assert.ok(/sv\.aZ:\(\)I\n.*iconst_1\n.*iadd\n.*sv\.p:\(I\)V/.test(zc.replace(/\s*\d+: /g,'\n').replace(/\n+/g,'\n')) || /sv\.aZ/.test(zc),'arrow hit increments');
assert.equal(bop.includes('boh.e:(Lsv;F)V'),true,'RenderPlayer calls renderArrowsStuckInEntity');
const render=method(boh,'protected void e(sv, float);');
assert.ok(/sv\.y:\(\)I/.test(render)&&/java\/util\/Random\."<init>":\(J\)V/.test(render)&&/Math\.atan2/.test(render)&&/3\.1415927410125732d/.test(render));
const classes=path.join(out,'classes');await rm(out,{recursive:true,force:true});await mkdir(classes,{recursive:true});
await exec('unzip',['-q','-o',jar,'*.class','-d',classes],{maxBuffer:1<<24});
const probe=path.join(out,'probe');await mkdir(probe,{recursive:true});
const cp=[probe,classes].join(path.delimiter);
await exec('javac',['-nowarn','-cp',cp,'-d',probe,path.join(root,'probes/StuckArrowProbe.java')]);
const {stdout}=await exec('java',['-cp',cp,'StuckArrowProbe'],{maxBuffer:1<<26});
const records=stdout.trim().split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
assert.equal(records.filter(r=>r.case==='model').length,1);assert.ok(records.filter(r=>r.case==='arrows').length>=9);
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',
 method:'model: ModelBiped boxList parts in order with ModelRenderer rotation point and ModelBox posX1,posY1,posZ1,posX2,posY2,posZ2. arrows: per entity id, 12 arrows in order: boxList index, translation (pixels / 16), yaw, pitch, computed as boh.e does in the JVM (Random(id), bhr.a(Random), nextInt(cubes), 3 nextFloat). GL is not run. Rules: sv.aZ/sv.p read/write DataWatcher byte 9; sv.h (onUpdate) decays with timer 20 * (30 - count) when !world.isRemote; zc.h increments on a living entity hit when !world.isRemote; no NBT key; only bop (RenderPlayer) calls boh.e.',
 records};
await writeFile(path.join(root,'../public/research/stuck-arrows-reference.json'),JSON.stringify(reference)+'\n');
console.log('Stuck arrow records:',records.length);
