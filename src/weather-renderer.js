// Weather drawing: EntityRenderer.renderRainSnow (blt.e) rain columns, the
// EntityRainFX splashes (blf / bkm.renderParticle) and RenderLightningBolt (bog).
// Geometry and the per-column/per-bolt random streams follow the bytecode; see
// public/research/weather.md for what is verified and what is simplified.
import * as THREE from "three";
import { FOG_PARS } from "./light-material.js";
import { JavaRandom, biomeTemperature } from "./lighting.js";
import { biomeFacts } from "./biomes.js";
import { precipitationHeight } from "./weather.js";

const f = Math.fround;
const RADIUS = 10; // fancy graphics
const SPAN = 2 * RADIUS + 1;
const MAX_DROPS = 1500;

// EntityRenderer's constructor tables: unit vectors perpendicular to the
// direction from the viewer, so every rain quad faces the viewer. The centre
// entry is 0/0 (NaN in Java), which draws nothing.
const rainX = new Float32Array(1024), rainZ = new Float32Array(1024);
for (let i = 0; i < 32; i++)
  for (let j = 0; j < 32; j++) {
    const a = j - 16, b = i - 16, d = f(Math.sqrt(a * a + b * b));
    rainX[(i << 5) | j] = f(-b / d);
    rainZ[(i << 5) | j] = f(a / d);
  }

function texture(url) {
  const t = new THREE.TextureLoader().load(url);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.flipY = false; // GL's v = 0 is the top row of the image
  return t;
}

// Lit, fogged, alpha-tested textured quads: attributes position, uv, lightCoord
// (packed block and sky light, as in chunk geometry) and alpha.
function quadMaterial(lighting, map, alphaTest) {
  return new THREE.ShaderMaterial({
    uniforms: { ...lighting.uniforms, map: { value: map }, alphaTest: { value: alphaTest } },
    vertexShader: `attribute vec2 lightCoord;attribute float alpha;varying vec2 vUv;varying vec2 vLight;varying float vAlpha;varying float vFogDistance;
void main(){vUv=uv;vAlpha=alpha;vLight=(lightCoord+8.)/256.;vec4 mv=modelViewMatrix*vec4(position,1.);vFogDistance=length(mv.xyz);gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `uniform sampler2D map,lightmap;uniform float alphaTest;varying vec2 vUv;varying vec2 vLight;varying float vAlpha;${FOG_PARS}
void main(){vec4 t=texture2D(map,vUv);if(t.a<=alphaTest)discard;gl_FragColor=vec4(applyFog(t.rgb*texture2D(lightmap,vLight).rgb),t.a*vAlpha);}`,
    transparent: true,
    side: THREE.DoubleSide,
  });
}

class Quads {
  constructor(capacity, material) {
    this.capacity = capacity;
    this.position = new Float32Array(capacity * 12);
    this.uv = new Float32Array(capacity * 8);
    this.light = new Float32Array(capacity * 8);
    this.alpha = new Float32Array(capacity * 4);
    const g = new THREE.BufferGeometry();
    for (const [name, array, size] of [["position", this.position, 3], ["uv", this.uv, 2], ["lightCoord", this.light, 2], ["alpha", this.alpha, 1]])
      g.setAttribute(name, new THREE.BufferAttribute(array, size).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(Array.from({ length: capacity }, (_, i) => [i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3]).flat());
    g.setDrawRange(0, 0);
    this.geometry = g;
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.frustumCulled = false;
    this.count = 0;
  }
  begin() {
    this.count = 0;
  }
  // corners: four [x, y, z, u, v]; `packed` is the brightness shared by the quad.
  add(corners, packed, alpha) {
    if (this.count >= this.capacity) return;
    const q = this.count++, lx = packed & 0xffff, ly = (packed >>> 16) & 0xffff;
    for (let k = 0; k < 4; k++) {
      const c = corners[k], v = q * 4 + k;
      this.position.set([c[0], c[1], c[2]], v * 3);
      this.uv[v * 2] = c[3];
      this.uv[v * 2 + 1] = c[4];
      this.light[v * 2] = lx;
      this.light[v * 2 + 1] = ly;
      this.alpha[v] = alpha;
    }
  }
  end() {
    const g = this.geometry;
    g.setDrawRange(0, this.count * 6);
    for (const name of ["position", "uv", "lightCoord", "alpha"]) g.attributes[name].needsUpdate = true;
    this.mesh.visible = this.count > 0;
  }
}

// RenderLightningBolt: the bolt's jagged path, drawn as 4 layers of triangle
// strips with additive blending, colour (0.45, 0.45, 0.5), alpha 0.3, unlit.
// Returns triangle-list positions for a bolt at (x, y, z) with the given seed.
export function boltGeometry(x, y, z, vertex) {
  const dx = new Array(8), dz = new Array(8), out = [];
  let d3 = 0, d4 = 0;
  const random = new JavaRandom(vertex);
  for (let i = 7; i >= 0; i--) {
    dx[i] = d3;
    dz[i] = d4;
    d3 += random.nextInt(11) - 5;
    d4 += random.nextInt(11) - 5;
  }
  for (let layer = 0; layer < 4; layer++) {
    const r = new JavaRandom(vertex);
    for (let j = 0; j < 3; j++) {
      let top = 7, bottom = 0;
      if (j > 0) top = 7 - j;
      if (j > 0) bottom = top - 2;
      let d5 = dx[top] - d3, d6 = dz[top] - d4;
      for (let i = top; i >= bottom; i--) {
        const d7 = d5, d8 = d6;
        if (j === 0) {
          d5 += r.nextInt(11) - 5;
          d6 += r.nextInt(11) - 5;
        } else {
          d5 += r.nextInt(31) - 15;
          d6 += r.nextInt(31) - 15;
        }
        let w1 = 0.1 + layer * 0.2, w2 = 0.1 + layer * 0.2;
        if (j === 0) {
          w1 *= i * 0.1 + 1;
          w2 *= (i - 1) * 0.1 + 1;
        }
        const strip = [];
        for (let k = 0; k < 5; k++) {
          let a = x + 0.5 - w1, b = z + 0.5 - w1, c = x + 0.5 - w2, d = z + 0.5 - w2;
          if (k === 1 || k === 2) {
            a += w1 * 2;
            c += w2 * 2;
          }
          if (k === 2 || k === 3) {
            b += w1 * 2;
            d += w2 * 2;
          }
          strip.push([c + d5, y + i * 16, d + d6], [a + d7, y + (i + 1) * 16, b + d8]);
        }
        // Triangle strip to a triangle list.
        for (let n = 0; n + 2 < strip.length; n++) {
          const t = n % 2 ? [strip[n + 1], strip[n], strip[n + 2]] : [strip[n], strip[n + 1], strip[n + 2]];
          for (const p of t) out.push(...p);
        }
      }
    }
  }
  return out;
}

export class WeatherRenderer {
  constructor(parent, lighting, scene) {
    this.scene = scene;
    this.rain = new Quads(SPAN * SPAN, quadMaterial(lighting, texture("/media/1.7.10/environment/rain.png"), 0.1));
    // The snow branch of renderRainSnow draws the same columns with environment/snow.png.
    this.snow = new Quads(SPAN * SPAN, quadMaterial(lighting, texture("/media/1.7.10/environment/snow.png"), 0.1));
    this.drops = new Quads(MAX_DROPS, quadMaterial(lighting, texture("/media/1.7.10/particle/particles.png"), 0.003921569));
    this.bolts = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.ShaderMaterial({
        vertexShader: "void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
        fragmentShader: "void main(){gl_FragColor=vec4(.45,.45,.5,.3);}",
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    this.bolts.frustumCulled = false;
    this.bolts.visible = false;
    this.boltKey = "";
    parent.add(this.rain.mesh, this.snow.mesh, this.drops.mesh, this.bolts);
    this.right = new THREE.Vector3();
    this.up = new THREE.Vector3();
  }
  // Once per frame. `weather` is a Weather (or null), `camera` the eye, `partial`
  // the fraction of the current tick.
  update(weather, world, camera, partial) {
    if (!weather || !world) {
      this.rain.mesh.visible = this.snow.mesh.visible = this.drops.mesh.visible = this.bolts.visible = false;
      return;
    }
    this.columns(weather, world, camera, partial);
    this.splashes(weather, camera, partial);
    this.lightning(weather);
  }
  // renderRainSnow: a 21 x 21 block area of slanted quads around the viewer,
  // from the lower of 10 below and the precipitation height to 10 above. Rain
  // scrolls down 3 to 4 texture rows per tick; snow (biome temperature below
  // 0.15, in a biome that precipitates) drifts slowly with a gaussian sway and
  // a brightness pulled toward full light (snow branch from bytecode only).
  columns(weather, world, camera, partial) {
    const strength = weather.rainStrength(partial), facts = biomeFacts(world.biome),
      snowing = biomeTemperature(world.biome) < f(0.15), q = snowing ? this.snow : this.rain;
    this.rain.begin();
    this.snow.begin();
    if (strength > 0 && (facts.canSpawnLightning || facts.enableSnow)) {
      const px = camera.position.x, py = camera.position.y, pz = camera.position.z,
        i = Math.floor(px), j = Math.floor(py), k = Math.floor(pz), count = weather.clientTicks;
      for (let z = k - RADIUS; z <= k + RADIUS; z++)
        for (let x = i - RADIUS; x <= i + RADIUS; x++) {
          const idx = (z - k + 16) * 32 + (x - i + 16), top = precipitationHeight(world, x, z);
          let low = j - RADIUS, high = j + RADIUS;
          if (low < top) low = top;
          if (high < top) high = top;
          if (low === high) continue;
          // random.setSeed(x*x*3121 + x*45238971 ^ z*z*418711 + z*13761) in 32-bit int maths.
          const sx = (Math.imul(Math.imul(x, x), 3121) + Math.imul(x, 45238971)) | 0,
            sz = (Math.imul(Math.imul(z, z), 418711) + Math.imul(z, 13761)) | 0,
            random = new JavaRandom(BigInt(sx ^ sz)),
            dx = x + 0.5 - px, dz = z + 0.5 - pz, dist = f(f(Math.sqrt(dx * dx + dz * dz)) / RADIUS);
          if (rainX[idx] !== rainX[idx]) continue; // the viewer's own column (0/0)
          const mid = Math.max(top, j), ox = f(rainX[idx] * 0.5), oz = f(rainZ[idx] * 0.5);
          if (snowing) {
            // scroll, then u = nextFloat + t * 0.01 * nextGaussian and v = nextFloat + t * nextGaussian * 0.001.
            const t = f(count + partial), scroll = f(f((count & 511) + partial) / 512),
              u = f(random.nextFloat() + f(f(t * f(0.01)) * f(random.nextGaussian()))),
              sway = f(random.nextFloat() + f(f(t * f(random.nextGaussian())) * f(0.001))),
              v0 = low / 4 + scroll + sway, v1 = high / 4 + scroll + sway,
              a = f(f(f(f(1 - f(dist * dist)) * f(0.3)) + 0.5) * strength),
              // (getLightBrightnessForSkyBlocks * 3 + 15728880) / 4 in int arithmetic.
              packed = Math.trunc((this.scene.brightness(x + 0.5, mid, z + 0.5) * 3 + 15728880) / 4);
            q.add(
              [[x - ox + 0.5, low, z - oz + 0.5, u, v0], [x + ox + 0.5, low, z + oz + 0.5, u + 1, v0], [x + ox + 0.5, high, z + oz + 0.5, u + 1, v1], [x - ox + 0.5, high, z - oz + 0.5, u, v1]],
              packed,
              a,
            );
            continue;
          }
          const wave = f(f(f(((count + sx + sz) & 31) + partial) / 32) * f(3 + random.nextFloat())),
            a = f(f(f(f(1 - f(dist * dist)) * 0.5) + 0.5) * strength), v0 = low / 4 + wave, v1 = high / 4 + wave;
          q.add(
            [[x - ox + 0.5, low, z - oz + 0.5, 0, v0], [x + ox + 0.5, low, z + oz + 0.5, 1, v0], [x + ox + 0.5, high, z + oz + 0.5, 1, v1], [x - ox + 0.5, high, z - oz + 0.5, 0, v1]],
            this.scene.brightness(x + 0.5, mid, z + 0.5),
            a,
          );
        }
    }
    this.rain.end();
    this.snow.end();
  }
  // EntityFX.renderParticle for the splashes: camera-facing quads of half-size
  // 0.1 * scale on the particle sheet (8 px tiles, 16 per row).
  splashes(weather, camera, partial) {
    const q = this.drops;
    q.begin();
    camera.updateMatrixWorld();
    this.right.setFromMatrixColumn(camera.matrixWorld, 0);
    this.up.setFromMatrixColumn(camera.matrixWorld, 1);
    const r = this.right, u = this.up;
    for (const d of weather.drops) {
      const x = d.px + (d.x - d.px) * partial, y = d.py + (d.y - d.py) * partial, z = d.pz + (d.z - d.pz) * partial,
        s = f(0.1 * d.scale), u0 = (d.texture % 16) / 16, v0 = Math.floor(d.texture / 16) / 16, u1 = u0 + 0.0624375, v1 = v0 + 0.0624375,
        corner = (a, b, tu, tv) => [x + r.x * s * a + u.x * s * b, y + r.y * s * a + u.y * s * b, z + r.z * s * a + u.z * s * b, tu, tv];
      q.add([corner(-1, -1, u1, v1), corner(-1, 1, u1, v0), corner(1, 1, u0, v0), corner(1, -1, u0, v1)], this.scene.brightness(d.x, d.y, d.z), 1);
    }
    q.end();
  }
  lightning(weather) {
    const live = weather.bolts;
    if (!live.length) {
      this.bolts.visible = false;
      return;
    }
    const key = live.map((b) => b.x + "," + b.y + "," + b.z + ":" + b.vertex).join(";");
    if (key !== this.boltKey) {
      this.boltKey = key;
      const positions = live.flatMap((b) => boltGeometry(b.x, b.y, b.z, b.vertex));
      this.bolts.geometry.dispose();
      this.bolts.geometry = new THREE.BufferGeometry();
      this.bolts.geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    }
    this.bolts.visible = true;
  }
}
