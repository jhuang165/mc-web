// The display block of the furnace, TNT, hopper and command block carts (RenderMinecart.func_147910_a: scale 0.75, raised
// offset / 16, RenderBlocks.renderBlockAsItem rotated 90 degrees about Y and centred), plus RenderTntMinecart's swell and white
// flash (the same maths as the primed TNT, explosion.js tntRender). The furnace always shows lit_furnace with its front on
// the north face (data 2); the hopper is drawn as the bowl boxes of hopper-shape.js, an approximation of render type 38.
import * as THREE from "three";
import { pixelTexture } from "./first-person.js";
import { entityMaterial } from "./light-material.js";
import { tntRender } from "./explosion.js";
import { HOPPER_BOXES } from "./hopper-shape.js";

const tex = (name) => pixelTexture(`/media/1.7.10/blocks/${name}.png`);
// BoxGeometry faces: +x, -x, +y, -y, +z, -z. Furnace data 2 puts the front on the north (-z) face.
const FACES = {
  2: () => { const s = tex("furnace_side"), t = tex("furnace_top"); return [s, s, t, t, s, tex("furnace_front_on")]; },
  3: () => { const s = tex("tnt_side"); return [s, s, tex("tnt_top"), tex("tnt_bottom"), s, s]; },
  4: () => Array(6).fill(tex("mob_spawner")), // the cage texture is alpha tested (entityMaterial discards below 0.1)
  6: () => Array(6).fill(tex("command_block")),
};

export class CartBlockRenderer {
  constructor(view) { this.view = view; this.unit = new THREE.BoxGeometry(1, 1, 1); }
  // A group holding the block centred on the origin (renderBlockAsItem's -0.5 translate applied) and its materials.
  build(type) {
    const turn = new THREE.Group(), materials = [];
    turn.rotation.y = Math.PI / 2;
    if (type === 5) {
      const outside = entityMaterial(this.view.lighting, { map: tex("hopper_outside") }), top = entityMaterial(this.view.lighting, { map: tex("hopper_top") });
      materials.push(outside, top);
      for (const [x0, y0, z0, x1, y1, z1] of HOPPER_BOXES) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), [outside, outside, top, outside, outside, outside]);
        mesh.position.set((x0 + x1) / 2 - 0.5, (y0 + y1) / 2 - 0.5, (z0 + z1) / 2 - 0.5);
        turn.add(mesh);
      }
    } else {
      const m = FACES[type]().map((map) => entityMaterial(this.view.lighting, { map }));
      materials.push(...m);
      turn.add(new THREE.Mesh(this.unit, m));
    }
    const display = new THREE.Group();
    display.scale.setScalar(0.75);
    display.add(turn);
    let white = null;
    if (type === 3) {
      // RenderTntMinecart: the flash cube in the same swollen, 0.75 scaled, offset frame as the display block.
      white = new THREE.Mesh(this.unit, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      white.scale.setScalar(0.75); white.renderOrder = 1; white.visible = false; // blm.a(TNT, 0, 1): a unit block inside the 0.75 frame
    }
    return { display, materials, white };
  }
  // The swell of the display block (not the cart model) and the flash for a TNT cart (only while the fuse runs).
  static fuse(cart, partial) {
    if (cart.type !== 3 || !(cart.fuse > -1)) return { scale: 1, flash: 0 };
    return tntRender(cart.fuse, partial);
  }
}
