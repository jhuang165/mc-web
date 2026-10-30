import * as THREE from 'three';
export class ExperienceRenderer {
 constructor(scene){this.scene=scene;this.sprites=[];const t=new THREE.TextureLoader().load('/media/1.7.10/entity/experience_orb.png');t.magFilter=t.minFilter=THREE.NearestFilter;t.repeat.set(.25,.25);this.texture=t;}
 update(orbs,time){while(this.sprites.length>orbs.length){const s=this.sprites.pop();this.scene.remove(s);s.material.map.dispose();s.material.dispose();}orbs.forEach((o,i)=>{let s=this.sprites[i];if(!s){const t=this.texture.clone();t.needsUpdate=true;t.offset.set(0,.75);s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false}));s.scale.setScalar(.35);this.scene.add(s);this.sprites.push(s);}s.position.set(o.x,o.y,o.z);s.material.color.setRGB(.5+.5*Math.sin(time*4+i),1,.1);});}
}
