import { BufferGeometry, Float32BufferAttribute } from 'three';
// ItemRenderer.renderItemIn2D: front/back and one thin textured strip for
// each pixel column/row. Alpha testing trims the strips to the silhouette.
export function spriteGeometry(pixels=16,thickness=1/16){
 const p=[],uv=[],n=[];
 function face(vertices,coords,normal){for(const i of [0,1,2,0,2,3]){p.push(...vertices[i]);uv.push(...coords[i]);n.push(...normal);}}
 face([[0,0,0],[1,0,0],[1,1,0],[0,1,0]],[[1,0],[0,0],[0,1],[1,1]],[0,0,1]);
 face([[1,0,-thickness],[0,0,-thickness],[0,1,-thickness],[1,1,-thickness]],[[0,0],[1,0],[1,1],[0,1]],[0,0,-1]);
 for(let i=0;i<pixels;i++){
  const a=i/pixels,b=(i+1)/pixels,u=1-(i+.5)/pixels,v=(i+.5)/pixels;
  face([[a,0,-thickness],[a,0,0],[a,1,0],[a,1,-thickness]],[[u,0],[u,0],[u,1],[u,1]],[-1,0,0]);
  face([[b,0,0],[b,0,-thickness],[b,1,-thickness],[b,1,0]],[[u,0],[u,0],[u,1],[u,1]],[1,0,0]);
  face([[0,a,0],[0,a,-thickness],[1,a,-thickness],[1,a,0]],[[1,v],[1,v],[0,v],[0,v]],[0,-1,0]);
  face([[0,b,-thickness],[0,b,0],[1,b,0],[1,b,-thickness]],[[1,v],[1,v],[0,v],[0,v]],[0,1,0]);
 }
 const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('normal',new Float32BufferAttribute(n,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));return g;
}
