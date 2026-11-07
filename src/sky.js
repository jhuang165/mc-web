// RenderGlobal.renderSky and renderCloudsFancy (Minecraft Java 1.7.10).
// The sky draws first in its own scene: the fogged sky plane 16 above the
// camera, the void plane at the horizon, the sunrise fan, then the sun, moon
// and stars on the celestial sphere with additive blending and no fog.
import * as THREE from "three";
import { starQuads, mhSin } from "./lighting.js";
import { buildEndSky } from "./dimension-render.js";
import { mediaGeneration, versioned } from "./media-version.js";

const additive = { transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide };

function texture(url) {
  const t = new THREE.TextureLoader().load(url);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}
function quad(size, y, uvs) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([-size, y, -size, size, y, -size, size, y, size, -size, y, size], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}
const texturedMaterial = (map) =>
  new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, uvRect: { value: new THREE.Vector4(0, 0, 1, 1) }, alpha: { value: 1 } },
    vertexShader: "uniform vec4 uvRect;varying vec2 vUv;void main(){vUv=uvRect.xy+uv*uvRect.zw;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: "uniform sampler2D map;uniform float alpha;varying vec2 vUv;void main(){gl_FragColor=texture2D(map,vUv)*vec4(1.,1.,1.,alpha);}",
    ...additive,
  });

export class Sky {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 400);
    this.camera.rotation.order = "YXZ";
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(300, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: { sky: { value: new THREE.Vector3() }, fog: { value: new THREE.Vector3() }, voidColor: { value: new THREE.Vector3() }, fogEnd: { value: 128 }, aboveHorizon: { value: 1 } },
        vertexShader: "varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
        // Sky plane at +16 and void plane at the horizon (`aboveHorizon` blocks
        // below the camera), both with setupFog(-1): linear from 0 to the far plane.
        fragmentShader: `uniform vec3 sky,fog,voidColor;uniform float fogEnd,aboveHorizon;varying vec3 vDir;
void main(){vec3 d=normalize(vDir);vec3 c=fog;
if(d.y>0.){c=mix(sky,fog,clamp(16./d.y/fogEnd,0.,1.));}
else if(aboveHorizon>0.&&d.y<0.){c=mix(voidColor,fog,clamp(aboveHorizon/-d.y/fogEnd,0.,1.));}
gl_FragColor=vec4(c,1.);}`,
        side: THREE.BackSide,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.scene.add(this.dome);
    // Sunrise fan: centre colour with the fan alpha, rim fully transparent.
    const fan = new THREE.BufferGeometry();
    fan.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(18 * 3), 3));
    fan.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(18 * 4), 4));
    fan.setIndex(Array.from({ length: 16 }, (_, j) => [0, j + 1, j + 2]).flat());
    this.fan = new THREE.Mesh(fan, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
    this.scene.add(this.fan);
    this.celestial = new THREE.Group();
    this.celestial.rotation.order = "YXZ";
    this.scene.add(this.celestial);
    this.sun = new THREE.Mesh(quad(30, 100, [0, 1, 1, 1, 1, 0, 0, 0]), texturedMaterial(texture("/media/1.7.10/environment/sun.png")));
    this.moonMaterial = texturedMaterial(texture("/media/1.7.10/environment/moon_phases.png"));
    this.moon = new THREE.Mesh(quad(20, -100, [1, 1, 0, 1, 0, 0, 1, 0]), this.moonMaterial);
    const stars = starQuads(), sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.Float32BufferAttribute(stars, 3));
    sg.setIndex(Array.from({ length: stars.length / 12 }, (_, i) => [i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3]).flat());
    this.stars = new THREE.Mesh(
      sg,
      new THREE.ShaderMaterial({
        uniforms: { brightness: { value: 0 } },
        vertexShader: "void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
        fragmentShader: "uniform float brightness;void main(){gl_FragColor=vec4(vec3(brightness),brightness);}",
        ...additive,
      }),
    );
    this.celestial.add(this.stars, this.sun, this.moon);
    this.sun.renderOrder = this.moon.renderOrder = this.stars.renderOrder = 2;
    this.fan.renderOrder = 1;
  }
  // Hell draws no sky; the End draws end_sky.png instead of the sky plane, sun, moon and stars (dimension-render.js).
  setDimension(d) {
    if (d === 1 && !this.endSky) { this.endSky = buildEndSky(texture("/media/1.7.10/environment/end_sky.png")); this.scene.add(this.endSky); }
    this.dimension = d;
    if (this.endSky) this.endSky.visible = d === 1;
    this.dome.visible = d === 0;
    this.celestial.visible = d === 0;
  }
  // `state`: celestial angle, sky/fog colours (0-1), sunrise RGBA or null,
  // star brightness, moon phase, camera height above the horizon, far plane.
  // `rain` is getRainStrength: renderSky fades the sun, moon and stars by 1 - rain.
  update({ angle, sky, fog, sunrise, stars, moonPhase, aboveHorizon, far, underwater = false, rain = 0 }) {
    const u = this.dome.material.uniforms;
    u.sky.value.set(...sky);
    u.fog.value.set(...fog);
    if (underwater) u.voidColor.value.set(...fog);
    else u.voidColor.value.set(sky[0] * 0.2 + 0.04, sky[1] * 0.2 + 0.04, sky[2] * 0.6 + 0.1);
    u.fogEnd.value = far;
    u.aboveHorizon.value = Math.max(0, aboveHorizon);
    this.fan.visible = !!sunrise && !this.dimension;
    if (sunrise) {
      // glRotatef(90, 1,0,0); glRotatef(sin(angle) < 0 ? 180 : 0, 0,0,1); glRotatef(90, 0,0,1).
      const m = new THREE.Matrix4().makeRotationX(Math.PI / 2)
          .multiply(new THREE.Matrix4().makeRotationZ(mhSin(Math.fround(angle * Math.fround(Math.PI) * 2)) < 0 ? Math.PI : 0))
          .multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)),
        p = this.fan.geometry.attributes.position, c = this.fan.geometry.attributes.color, v = new THREE.Vector3();
      v.set(0, 100, 0).applyMatrix4(m);
      p.setXYZ(0, v.x, v.y, v.z);
      c.setXYZW(0, sunrise[0], sunrise[1], sunrise[2], sunrise[3]);
      for (let j = 0; j <= 16; j++) {
        const a = (j * Math.PI * 2) / 16, s = Math.sin(a), co = Math.cos(a);
        v.set(s * 120, co * 120, -co * 40 * sunrise[3]).applyMatrix4(m);
        p.setXYZ(j + 1, v.x, v.y, v.z);
        c.setXYZW(j + 1, sunrise[0], sunrise[1], sunrise[2], 0);
      }
      p.needsUpdate = c.needsUpdate = true;
    }
    // glRotatef(-90, 0,1,0); glRotatef(angle * 360, 1,0,0).
    this.celestial.rotation.set(angle * Math.PI * 2, -Math.PI / 2, 0);
    const l = moonPhase % 4, i = Math.floor(moonPhase / 4) % 2;
    this.moonMaterial.uniforms.uvRect.value.set(l / 4, 1 - (i + 1) / 2, 1 / 4, 1 / 2);
    const clear = 1 - rain;
    this.sun.material.uniforms.alpha.value = this.moonMaterial.uniforms.alpha.value = clear;
    this.stars.material.uniforms.brightness.value = stars * clear;
    this.stars.visible = stars * clear > 0;
  }
  render(renderer, camera, clear) {
    this.camera.quaternion.copy(camera.quaternion);
    this.camera.fov = camera.fov;
    this.camera.aspect = camera.aspect;
    this.camera.updateProjectionMatrix();
    renderer.setClearColor(clear, 1);
    renderer.clear();
    renderer.render(this.scene, this.camera);
  }
}

// renderCloudsFancy: each clouds.png pixel is a 12 x 4 x 12 block cell; shades
// 0.7 bottom, 1.0 top, 0.9 x sides, 0.8 z sides; colour from World.getCloudColour
// at 80% alpha; the layer drifts 0.03 blocks per tick towards +x.
export class Clouds {
  constructor(lighting, height, radius = 24) {
    this.height = height;
    this.radius = radius;
    this.material = new THREE.ShaderMaterial({
      uniforms: { ...lighting.uniforms, color: { value: new THREE.Vector3(1, 1, 1) } },
      vertexShader: "attribute float shade;varying float vShade;varying float vFogDistance;void main(){vShade=shade;vec4 mv=modelViewMatrix*vec4(position,1.);vFogDistance=length(mv.xyz);gl_Position=projectionMatrix*mv;}",
      fragmentShader: `uniform vec3 color;varying float vShade;uniform vec3 fogColor;uniform float fogNear,fogFar,fogDensity;varying float vFogDistance;
void main(){float f=fogDensity>0.?1.-exp(-fogDensity*vFogDistance):clamp((vFogDistance-fogNear)/(fogFar-fogNear),0.,1.);gl_FragColor=vec4(mix(color*vShade,fogColor,f),.8);}`,
      transparent: true,
      // renderCloudsFancy disables face culling.
      side: THREE.DoubleSide,
    });
    // Fancy clouds draw depth first, then colour, so inner faces stay hidden.
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
    this.depth = new THREE.Mesh(this.mesh.geometry, this.material.clone());
    this.depth.material.uniforms = this.material.uniforms;
    this.depth.material.colorWrite = false;
    this.depth.renderOrder = 1;
    this.mesh.renderOrder = 2;
    this.mesh.frustumCulled = this.depth.frustumCulled = false;
    this.key = "";
    this.loadImage();
  }
  // clouds.png (possibly a pack's): the opaque-texel grid the volumes are built from. `gen` is the media generation (refresh).
  loadImage(gen = mediaGeneration()) {
    const image = new Image();
    image.onload = () => {
      const c = document.createElement("canvas");
      c.width = image.width;
      c.height = image.height;
      const x = c.getContext("2d");
      x.drawImage(image, 0, 0);
      const data = x.getImageData(0, 0, c.width, c.height).data;
      this.size = c.width;
      this.filled = new Uint8Array(c.width * c.height);
      // Empty texels carry alpha 1; the 0.1 alpha test discards them.
      for (let i = 0; i < this.filled.length; i++) this.filled[i] = data[i * 4 + 3] > 25 ? 1 : 0;
      this.key = "";
    };
    image.src = versioned("/media/1.7.10/environment/clouds.png", gen);
  }
  reload(gen) { this.loadImage(gen); }
  cell(px, pz) {
    const s = this.size;
    return this.filled[(((pz % s) + s) % s) * s + (((px % s) + s) % s)];
  }
  // The Graphics option: renderClouds (Fast) draws a flat layer of 8-block texels, 32 texels either side
  // (a 32-block grid over 256 blocks each way), uniform colour at 0.8 alpha and no depth pass;
  // renderCloudsFancy draws the 12 x 4 x 12 block volumes.
  setFancy(fancy) {
    if (this.fancy === fancy) return;
    this.fancy = fancy;
    this.key = "";
  }
  setEnabled(on) {
    this.enabled = on;
    this.mesh.visible = on;
    this.depth.visible = on && this.fancy !== false;
  }
  build(px0, pz0) {
    if (this.fancy === false) return this.buildFast(px0, pz0);
    const p = [], shade = [], idx = [], r = this.radius * 2 + 1, h = 4;
    const face = (verts, s) => {
      const v = p.length / 3;
      for (const q of verts) p.push(...q);
      shade.push(s, s, s, s);
      idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
    };
    for (let i = 0; i < r; i++)
      for (let k = 0; k < r; k++) {
        if (!this.cell(px0 + i, pz0 + k)) continue;
        const x0 = i * 12, x1 = x0 + 12, z0 = k * 12, z1 = z0 + 12;
        face([[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]], 0.7);
        face([[x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0]], 1);
        if (!this.cell(px0 + i - 1, pz0 + k)) face([[x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0]], 0.9);
        if (!this.cell(px0 + i + 1, pz0 + k)) face([[x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1]], 0.9);
        if (!this.cell(px0 + i, pz0 + k - 1)) face([[x1, 0, z0], [x0, 0, z0], [x0, h, z0], [x1, h, z0]], 0.8);
        if (!this.cell(px0 + i, pz0 + k + 1)) face([[x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1]], 0.8);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute("shade", new THREE.Float32BufferAttribute(shade, 1));
    g.setIndex(idx);
    this.mesh.geometry.dispose();
    this.mesh.geometry = this.depth.geometry = g;
  }
  buildFast(px0, pz0) {
    const p = [], shade = [], idx = [], r = 64, S = 8;
    for (let i = 0; i < r; i++)
      for (let k = 0; k < r; k++) {
        if (!this.cell(px0 + i, pz0 + k)) continue;
        const v = p.length / 3, x0 = i * S, x1 = x0 + S, z0 = k * S, z1 = z0 + S;
        p.push(x0, 0, z1, x1, 0, z1, x1, 0, z0, x0, 0, z0);
        shade.push(1, 1, 1, 1);
        idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute("shade", new THREE.Float32BufferAttribute(shade, 1));
    g.setIndex(idx);
    this.mesh.geometry.dispose();
    this.mesh.geometry = this.depth.geometry = g;
  }
  // `ticks` counts client ticks (plus the partial tick); colour is 0-1 RGB.
  update(camera, ticks, color) {
    this.material.uniforms.color.value.set(...color);
    if (!this.filled) return;
    if (this.fancy === false) {
      // d2 = x + drift; the texel at k blocks from the camera is (k + d2) / 8.
      const drift = ticks * 0.03, cx = Math.floor((camera.position.x + drift) / 8) - 32, cz = Math.floor(camera.position.z / 8) - 32, key = "f" + cx + "," + cz;
      if (key !== this.key) {
        this.key = key;
        this.build(cx, cz);
      }
      this.mesh.position.set(cx * 8 - drift, this.height + 0.33, cz * 8);
      this.depth.position.copy(this.mesh.position);
      this.depth.visible = false;
      return;
    }
    this.depth.visible = this.enabled !== false;
    const drift = ticks * 0.03,
      cx = Math.floor((camera.position.x + drift) / 12) - this.radius,
      cz = Math.floor(camera.position.z / 12 + 0.33) - this.radius,
      key = cx + "," + cz;
    if (key !== this.key) {
      this.key = key;
      this.build(cx, cz);
    }
    this.mesh.position.set(cx * 12 - drift, this.height + 0.33, (cz - 0.33) * 12);
    this.depth.position.copy(this.mesh.position);
  }
}
