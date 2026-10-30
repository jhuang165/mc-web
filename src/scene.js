import * as THREE from 'three';
import {SIZE,HEIGHT,SEA,BLOCKS,hash} from './world.js';
const FACES=[
 {n:[1,0,0],v:[[1,0,1],[1,0,0],[1,1,0],[1,1,1]],shade:.78},
 {n:[-1,0,0],v:[[0,0,0],[0,0,1],[0,1,1],[0,1,0]],shade:.64},
 {n:[0,1,0],v:[[0,1,1],[1,1,1],[1,1,0],[0,1,0]],shade:1},
 {n:[0,-1,0],v:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]],shade:.5},
 {n:[0,0,1],v:[[0,0,1],[1,0,1],[1,1,1],[0,1,1]],shade:.9},
 {n:[0,0,-1],v:[[1,0,0],[0,0,0],[0,1,0],[1,1,0]],shade:.72}
];
function atlas(){
 const canvas=document.createElement('canvas');canvas.width=16*16;canvas.height=16;const c=canvas.getContext('2d');
 const colors=['#79984b','#7d6345','#876745','#90918a','#77603e','#b49a65','#527d42','#dbcca0','#b99a69','#ac6b54','#bddedc','#629bb9','#474b43'];
 colors.forEach((base,t)=>{c.fillStyle=base;c.fillRect(t*16,0,16,16);for(let x=0;x<16;x++)for(let y=0;y<16;y++){const v=hash(x,y,t*73);c.fillStyle=v>.55?`rgba(255,255,225,${(v-.55)*.28})`:`rgba(25,26,15,${(.55-v)*.3})`;c.fillRect(t*16+x,y,1,1);}
 if(t===1){c.fillStyle='#719648';for(let x=0;x<16;x++)c.fillRect(t*16+x,0,1,3+Math.floor(hash(x,0,4)*4));}
 if(t===4){c.fillStyle='#58452c';for(let x=1;x<16;x+=4)c.fillRect(t*16+x,0,1,16);}
 if(t===5){c.strokeStyle='#80683e';for(let k=2;k<8;k+=2)c.strokeRect(t*16+k,k,16-k*2,16-k*2);}
 if(t===8){c.fillStyle='#8d744d';for(let y=3;y<16;y+=4)c.fillRect(t*16,y,16,1);c.fillRect(t*16+6,0,1,4);c.fillRect(t*16+12,4,1,4);}
 if(t===9){c.fillStyle='#d4bc9c';for(let y=3;y<16;y+=4){c.fillRect(t*16,y,16,1);for(let x=y%8;x<16;x+=8)c.fillRect(t*16+x,y-3,1,3);}}
 if(t===10){c.fillStyle='#6e9690';c.fillRect(t*16,0,1,16);c.fillRect(t*16,15,16,1);c.fillStyle='#e2f0e8';c.fillRect(t*16+3,4,2,6);c.fillRect(t*16+6,2,1,3);}
 });const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;return texture;
}
function tile(b,face){if(b===1)return face===2?0:face===3?2:1;if(b===2)return 2;if(b===3)return 3;if(b===4)return face===2||face===3?5:4;return({5:6,6:7,7:8,8:9,9:10,10:11,11:12})[b]??3;}
export class VoxelScene {
 constructor(container){
   this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));this.renderer.setSize(innerWidth,innerHeight);this.renderer.outputColorSpace=THREE.SRGBColorSpace;container.appendChild(this.renderer.domElement);
   this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#c6dddd');this.scene.fog=new THREE.Fog('#c6dddd',65,155);
   this.camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.1,280);this.camera.rotation.order='YXZ';
   this.scene.add(new THREE.HemisphereLight('#fff7df','#68795b',2.2));const sun=new THREE.DirectionalLight('#fff2d7',2.3);sun.position.set(-60,100,40);this.scene.add(sun);
   this.material=new THREE.MeshLambertMaterial({map:atlas(),vertexColors:true});this.waterMaterial=new THREE.MeshLambertMaterial({color:'#81bfd0',transparent:true,opacity:.66,side:THREE.DoubleSide});
   this.chunks=new Map();this.clouds=new THREE.Group();const cm=new THREE.MeshLambertMaterial({color:'#f7f4e7',transparent:true,opacity:.87});
   for(let i=0;i<20;i++){const mesh=new THREE.Mesh(new THREE.BoxGeometry(10+hash(i,2,8)*17,1.3,5+hash(i,4,2)*7),cm);mesh.position.set(hash(i,0,4)*260-60,58+hash(i,0,7)*8,hash(i,1,3)*220-40);this.clouds.add(mesh);}this.scene.add(this.clouds);
   this.outline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.008,1.008,1.008)),new THREE.LineBasicMaterial({color:'#f9f9e5',transparent:true,opacity:.85}));this.scene.add(this.outline);this.outline.visible=false;
   this.resize=()=>{this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);};window.addEventListener('resize',this.resize);
 }
 setWorld(world){this.world=world;for(const v of this.chunks.values()){this.scene.remove(v);for(const child of v.children)child.geometry.dispose();}this.chunks.clear();for(let x=0;x<SIZE;x+=16)for(let z=0;z<SIZE;z+=16)this.buildChunk(x,z);}
 buildChunk(cx,cz){
   const key=`${cx},${cz}`,old=this.chunks.get(key);if(old){this.scene.remove(old);for(const child of old.children)child.geometry.dispose();}
   const p=[],n=[],uv=[],color=[],idx=[],wp=[],wi=[];let vi=0,wvi=0;const w=this.world;
   for(let x=cx;x<cx+16;x++)for(let z=cz;z<cz+16;z++)for(let y=0;y<HEIGHT;y++){
     const b=w.get(x,y,z);if(!b)continue;
     if(b===10){if(!w.get(x,y+1,z)){wp.push(x,y+.87,z+1,x+1,y+.87,z+1,x+1,y+.87,z,x,y+.87,z);wi.push(wvi,wvi+1,wvi+2,wvi,wvi+2,wvi+3);wvi+=4;}continue;}
     FACES.forEach((f,fi)=>{const nb=w.get(x+f.n[0],y+f.n[1],z+f.n[2]);if(nb&&nb!==10)return;const t=tile(b,fi),u0=(t*16+.2)/256,u1=(t*16+15.8)/256;
       const variation=.96+hash(x,z,y)*.07;
       for(const v of f.v){p.push(x+v[0],y+v[1],z+v[2]);n.push(...f.n);const shade=f.shade*variation;color.push(shade,shade,shade);}
       uv.push(u0,.015,u1,.015,u1,.985,u0,.985);idx.push(vi,vi+1,vi+2,vi,vi+2,vi+3);vi+=4;
     });
   }
   const group=new THREE.Group();if(p.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(color,3));g.setIndex(idx);g.computeBoundingSphere();group.add(new THREE.Mesh(g,this.material));}
   if(wp.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(wp,3));g.setIndex(wi);g.computeVertexNormals();group.add(new THREE.Mesh(g,this.waterMaterial));}
   this.chunks.set(key,group);this.scene.add(group);
 }
 updateBlock(x,z){const cx=Math.floor(x/16)*16,cz=Math.floor(z/16)*16;this.buildChunk(cx,cz);if(x%16===0&&cx>0)this.buildChunk(cx-16,cz);if(x%16===15&&cx+16<SIZE)this.buildChunk(cx+16,cz);if(z%16===0&&cz>0)this.buildChunk(cx,cz-16);if(z%16===15&&cz+16<SIZE)this.buildChunk(cx,cz+16);}
 preview(time){this.camera.position.set(91+Math.sin(time*.025)*4,48,108+Math.cos(time*.025)*4);this.camera.lookAt(49,20,44);this.outline.visible=false;}
 render(time){this.clouds.position.x=Math.sin(time*.004)*5;this.renderer.render(this.scene,this.camera);}
 setDistance(distance){this.scene.fog.near=distance*.48;this.scene.fog.far=distance;}
}
