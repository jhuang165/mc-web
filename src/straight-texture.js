// Batch 75 skintex75: textures uploaded from decoded straight-alpha pixels. A 2D canvas stores premultiplied alpha, so a texture made with
// CanvasTexture(canvas) re-rounds every partly transparent texel (a skin hat pixel kept at alpha below 128, a cape edge). png-decode.js hands
// back the colours as stored, and a DataTexture uploads that array as is (premultiplyAlpha false). The settings match CanvasTexture:
// RGBA, unsigned byte, flipY true (the image's first row is the top), no colour-space conversion; filters are nearest, no mip chain
// (what the skin and cape callers set on their CanvasTexture). Pure three.js, no DOM: the array of the texture is the file's pixels.
import * as THREE from "three";
import { skinPixels, capePixels, skinCanvas, capeCanvas } from "./skin.js";

export function straightTexture(rgba, width, height) {
  const bytes = rgba instanceof Uint8Array ? rgba : new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  if (bytes.length !== width * height * 4) throw new Error("texture pixels do not match the size");
  const t = new THREE.DataTexture(bytes, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.flipY = true; t.premultiplyAlpha = false; t.unpackAlignment = 4;
  t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

const nearest = (t) => { t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; return t; };

// Skin texture of a PNG blob: the straight-alpha normalised pixels, else (decoder refused the file) the canvas path.
export async function skinTextureOf(blob) {
  const px = await skinPixels(blob);
  return px ? straightTexture(px, 64, 32) : nearest(new THREE.CanvasTexture(await skinCanvas(blob)));
}
// Cape texture of a PNG blob, the same way.
export async function capeTextureOf(blob) {
  const px = await capePixels(blob);
  return px ? straightTexture(px, 64, 32) : nearest(new THREE.CanvasTexture(await capeCanvas(blob)));
}
