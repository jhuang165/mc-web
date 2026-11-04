// Reads GuiInventory.func_147046_a (bfu.a(IIIFFLsv;)V) and its two callers (GuiInventory.func_146976_a = bfu.a(FII)V,
// GuiContainerCreative.func_146976_a = bfl.a(FII)V) from the pinned 1.7.10 client JAR with javap, runs
// probes/InventoryPlayerProbe.java for the float arithmetic, and writes public/research/inventory-player-reference.json
// for src/inventory-player.test.js. Needs a JDK and the JAR (tools/research or MC_RESEARCH).
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,readFile,writeFile,access,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.dirname(fileURLToPath(import.meta.url)),exists=p=>access(p).then(()=>true,()=>false);
const researchDirs=[process.env.MC_RESEARCH,path.join(root,'research'),path.join(root,'../../tools/research')].filter(Boolean);
let research;for(const dir of researchDirs)if(await exists(path.join(research=dir,'minecraft-1.7.10.jar')))break;else research=null;
if(!research)throw new Error('Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.');
const jar=path.join(research,'minecraft-1.7.10.jar');
assert.equal(createHash('sha1').update(await readFile(jar)).digest('hex'),'e80d9b3bf5085002218d4be59e668bac718abbc6');
const javap=async cls=>(await exec('javap',['-c','-p','-cp',jar,cls],{maxBuffer:1<<26})).stdout;
const method=(text,sig)=>{const start=text.indexOf(sig);assert.ok(start>=0,sig);const rest=text.slice(start),end=rest.search(/\n\n/);return rest.slice(0,end<0?undefined:end);};
// The ordered numeric pushes (ldc floats, bipush, sipush, fconst) and GL calls of a method body.
const ops=body=>body.split('\n').map(l=>l.trim()).flatMap(l=>{
 let m;
 if((m=/^\d+: (?:ldc|ldc_w)\s+#\d+\s+\/\/ float ([-\d.]+)f/.exec(l)))return[{push:Number(m[1])}];
 if((m=/^\d+: (bipush|sipush)\s+(-?\d+)/.exec(l)))return[{push:Number(m[2])}];
 if((m=/^\d+: fconst_(\d)/.exec(l)))return[{push:Number(m[1])}];
 if((m=/Method org\/lwjgl\/opengl\/GL11\.(\w+)/.exec(l)))return[{gl:m[1]}];
 if((m=/Method java\/lang\/Math\.(\w+)/.exec(l)))return[{math:m[1]}];
 return[];});
const bfu=await javap('bfu'),bfl=await javap('bfl');
const draw=ops(method(bfu,'public static void a(int, int, int, float, float, sv);'));
const gl=draw.filter(o=>o.gl).map(o=>o.gl);
assert.deepEqual(gl.slice(0,9),['glEnable','glPushMatrix','glTranslatef','glScalef','glRotatef','glRotatef','glRotatef','glRotatef','glTranslatef']);
// translate(x, y, 50), scale(-s, s, s) | rotate 180 about z | rotate 135, -135 about y | rotate about x
const pushes=draw.filter(o=>o.push!==undefined).map(o=>o.push);
assert.ok(pushes.includes(50)&&pushes.includes(180)&&pushes.includes(135)&&pushes.includes(-135)&&pushes.includes(40)&&pushes.includes(20));
const survival=ops(method(bfu,'protected void a(float, int, int);')).filter(o=>o.push!==undefined).map(o=>o.push);
const creative=ops(method(bfl,'protected void a(float, int, int);')).filter(o=>o.push!==undefined).map(o=>o.push);
// survival: i, r, then 51 75 30 / 51 75 50 added to guiLeft/guiTop; creative: 43 45 20 / 43 45 30.
assert.deepEqual(survival.slice(survival.indexOf(51),survival.indexOf(51)+7),[51,75,30,51,75,50,]);
const at=creative.indexOf(43);assert.deepEqual(creative.slice(at,at+6),[43,45,20,43,45,30]);
const probe=path.join(research,'inventory-player-probe');await rm(probe,{recursive:true,force:true});await mkdir(probe,{recursive:true});
await exec('javac',['-nowarn','-d',probe,path.join(root,'probes/InventoryPlayerProbe.java')]);
const {stdout}=await exec('java',['-cp',probe,'InventoryPlayerProbe'],{maxBuffer:1<<24});
const rows=stdout.trim().split('\n').map(l=>JSON.parse(l));assert.equal(rows.length,801);
const reference={target:'Minecraft Java 1.7.10',clientSha1:'e80d9b3bf5085002218d4be59e668bac718abbc6',
 method:'javap -c of bfu.a(IIIFFLsv;)V (GuiInventory.func_147046_a), bfu.a(FII)V and bfl.a(FII)V; the float math is run in a JVM (probes/InventoryPlayerProbe.java). Not a GL replay: the matrix order and constants are read from the bytecode and re-created in src/inventory-player.js.',
 drawCalls:gl,drawPushes:pushes,
 survival:{anchor:[51,75],scale:30,look:[51,25],callerPushes:survival},
 creative:{anchor:[43,45],scale:20,look:[43,15],callerPushes:creative},
 rows};
await writeFile(path.join(root,'../public/research/inventory-player-reference.json'),JSON.stringify(reference)+'\n');
console.log('Inventory player reference rows:',rows.length,'GL calls:',gl.join(','));
