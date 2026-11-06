// The display mob of the spawner minecart. RenderMinecartMobSpawner (boj.a(xt, F, aji, I)) draws the spawner block like any
// cart block, then calls TileEntityMobSpawnerRenderer.func_147517_a(logic, cart.posX, cart.posY, cart.posZ, partial) inside
// the cart's scaled (0.75) and raised frame. bytecode: the arguments are the cart's absolute world coordinates, not zeros,
// so the transform below translates the mob by them in that frame (as the original does). Same maths as spawnerMobMatrix.
import * as THREE from "three";
import { spawnerMobMatrix, spawnerDisplayEntity } from "./mob-spawner.js";
import { DISPLAY } from "./cart-variants.js";

const D = Math.PI / 180;
export function cartSpawnerDisplayEntity(minecarts, world, cart, partial = 1) {
  const s = cart.spawner;
  if (!s) return null;
  const shown = spawnerDisplayEntity(s, partial);
  if (!shown) return null;
  const pose = minecarts.renderPose(world, cart, partial);
  const frame = new THREE.Matrix4().compose(new THREE.Vector3(pose.x, pose.y, pose.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(pose.roll * D, (180 - pose.yaw) * D, -pose.pitch * D, "YZX")), new THREE.Vector3(1, 1, 1));
  const local = new THREE.Matrix4().makeTranslation(0, 0.75 * (DISPLAY[4].offset / 16), 0).multiply(new THREE.Matrix4().makeScale(0.75, 0.75, 0.75));
  const at = { x: cart.x, y: cart.posY, z: cart.z, client: s.client };
  const matrix = frame.multiply(local).multiply(new THREE.Matrix4().fromArray(spawnerMobMatrix(at, partial)));
  return { ...shown, id: `spawner-cart-${cart.id}`, displayMatrix: matrix.toArray(), lightPos: { x: cart.x, y: cart.posY, z: cart.z } };
}
