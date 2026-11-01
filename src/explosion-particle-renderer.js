import * as THREE from 'three';
import {worldMaterial} from './light-material.js';
import {pixelTexture} from './first-person.js';
import {particleBasis,particleLightCell,quantize} from './particles.js';
import {explosionSprite} from './explosion-particles.js';

// EffectRenderer layers 0 and 3: original particle sheet and custom explosion sheet.
// Each layer uses one pooled quad buffer, alpha blending and a 1/255 alpha test.
export class ExplosionParticleRenderer {
  constructor(scene,view,limit=4000){
    this.view=view;this.limit=limit;
    this.layers=[false,true].map(large=>{
      const geometry=new THREE.BufferGeometry(),attr=n=>new THREE.BufferAttribute(new Float32Array(limit*4*n),n).setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute('position',attr(3));geometry.setAttribute('uv',attr(2));geometry.setAttribute('shade',attr(3));geometry.setAttribute('lightCoord',attr(2));
      const index=new Uint32Array(limit*6);
      for(let i=0;i<limit;i++)index.set([i*4,i*4+1,i*4+2,i*4,i*4+2,i*4+3],i*6);
      geometry.setIndex(new THREE.BufferAttribute(index,1));geometry.setDrawRange(0,0);
      const map=pixelTexture('/media/1.7.10/'+(large?'entity/explosion.png':'particle/particles.png'));
      const material=worldMaterial(view.lighting,{map,alphaTest:1/255,transparent:true,side:THREE.DoubleSide});material.depthWrite=false;
      const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.renderOrder=large?1:0;scene.add(mesh);
      return {large,geometry,material,mesh};
    });
  }
  update(list,partial,{yaw=0,pitch=0,mirror=false}={}){
    const {x:rx,z:rz,yz,xy,xz}=particleBasis(180-yaw*180/Math.PI,-pitch*180/Math.PI,mirror);
    for(const layer of this.layers){
      const a=layer.geometry.attributes,positions=a.position.array,uv=a.uv.array,shade=a.shade.array,light=a.lightCoord.array;
      let count=0;
      for(const p of list){
        if((p.kind==='largeexplode')!==layer.large||count>=this.limit)continue;
        const sprite=explosionSprite(p,partial);if(!sprite)continue;
        const {u0,u1,v0,v1,size:s}=sprite,x=p.px+(p.x-p.px)*partial,y=p.py+(p.y-p.py)*partial,z=p.pz+(p.z-p.pz)*partial;
        const corners=[
          [x-rx*s-yz*s,y-xz*s,z-rz*s-xy*s,u1,v1],
          [x-rx*s+yz*s,y+xz*s,z-rz*s+xy*s,u1,v0],
          [x+rx*s+yz*s,y+xz*s,z+rz*s+xy*s,u0,v0],
          [x+rx*s-yz*s,y-xz*s,z+rz*s-xy*s,u0,v1],
        ];
        const packed=layer.large?240:(this.view.light?.packed(...particleLightCell(p))??(15<<20));
        const color=[quantize(p.r),quantize(p.g),quantize(p.b)];
        for(let j=0;j<4;j++){
          const i=count*4+j,c=corners[j];positions.set(c.slice(0,3),i*3);uv.set([c[3],1-c[4]],i*2);shade.set(color,i*3);light.set([packed&65535,(packed>>16)&65535],i*2);
        }
        count++;
      }
      layer.geometry.setDrawRange(0,count*6);
      if(count)for(const attr of Object.values(a)){attr.clearUpdateRanges?.();attr.addUpdateRange?.(0,count*4*attr.itemSize);attr.needsUpdate=true;}
    }
  }
  clear(){for(const layer of this.layers)layer.geometry.setDrawRange(0,0);}
}
