import * as THREE from "three";
import { SIZE, HEIGHT, SEA, BLOCKS, hash } from "./world.js";
const FACES = [
  {
    n: [1, 0, 0],
    v: [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ],
    shade: 0.78,
  },
  {
    n: [-1, 0, 0],
    v: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
    shade: 0.64,
  },
  {
    n: [0, 1, 0],
    v: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
    shade: 1,
  },
  {
    n: [0, -1, 0],
    v: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
    shade: 0.5,
  },
  {
    n: [0, 0, 1],
    v: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
    shade: 0.9,
  },
  {
    n: [0, 0, -1],
    v: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
    shade: 0.72,
  },
];
function atlas() {
  const canvas = document.createElement("canvas");
  canvas.width = 32 * 16;
  canvas.height = 16;
  const c = canvas.getContext("2d");
  const colors = [
    "#79984b",
    "#7d6345",
    "#876745",
    "#90918a",
    "#77603e",
    "#b49a65",
    "#527d42",
    "#dbcca0",
    "#b99a69",
    "#ac6b54",
    "#bddedc",
    "#629bb9",
    "#474b43",
    ...BLOCKS.slice(12).map((b) => b.color),
  ];
  colors.forEach((base, t) => {
    c.fillStyle = base;
    c.fillRect(t * 16, 0, 16, 16);
    for (let x = 0; x < 16; x++)
      for (let y = 0; y < 16; y++) {
        const v = hash(x, y, t * 73);
        c.fillStyle =
          v > 0.55
            ? `rgba(255,255,225,${(v - 0.55) * 0.28})`
            : `rgba(25,26,15,${(0.55 - v) * 0.3})`;
        c.fillRect(t * 16 + x, y, 1, 1);
      }
    if (t === 1) {
      c.fillStyle = "#719648";
      for (let x = 0; x < 16; x++)
        c.fillRect(t * 16 + x, 0, 1, 3 + Math.floor(hash(x, 0, 4) * 4));
    }
    if (t === 4) {
      c.fillStyle = "#58452c";
      for (let x = 1; x < 16; x += 4) c.fillRect(t * 16 + x, 0, 1, 16);
    }
    if (t === 5) {
      c.strokeStyle = "#80683e";
      for (let k = 2; k < 8; k += 2)
        c.strokeRect(t * 16 + k, k, 16 - k * 2, 16 - k * 2);
    }
    if (t === 8) {
      c.fillStyle = "#8d744d";
      for (let y = 3; y < 16; y += 4) c.fillRect(t * 16, y, 16, 1);
      c.fillRect(t * 16 + 6, 0, 1, 4);
      c.fillRect(t * 16 + 12, 4, 1, 4);
    }
    if (t === 9) {
      c.fillStyle = "#d4bc9c";
      for (let y = 3; y < 16; y += 4) {
        c.fillRect(t * 16, y, 16, 1);
        for (let x = y % 8; x < 16; x += 8) c.fillRect(t * 16 + x, y - 3, 1, 3);
      }
    }
    if (t === 10) {
      c.fillStyle = "#6e9690";
      c.fillRect(t * 16, 0, 1, 16);
      c.fillRect(t * 16, 15, 16, 1);
      c.fillStyle = "#e2f0e8";
      c.fillRect(t * 16 + 3, 4, 2, 6);
      c.fillRect(t * 16 + 6, 2, 1, 3);
    }
    if (t === 13) {
      c.strokeStyle = "#565e57";
      for (let y = 0; y < 16; y += 5) {
        c.beginPath();
        c.moveTo(t * 16, y);
        c.lineTo(t * 16 + 16, y);
        c.stroke();
        for (let x = (y % 2) * 3; x < 16; x += 7)
          c.strokeRect(t * 16 + x, y, 7, 5);
      }
    }
    if (t === 14) {
      c.fillStyle = "#5e422a";
      for (let x = 3; x < 16; x += 5) c.fillRect(t * 16 + x, 0, 1, 16);
      for (let y = 3; y < 16; y += 5) c.fillRect(t * 16, y, 16, 1);
    }
    if (t === 15) {
      c.fillStyle = "#464b45";
      c.fillRect(t * 16 + 3, 3, 10, 4);
      c.fillRect(t * 16 + 3, 9, 10, 5);
    }
    if (t >= 16 && t <= 19) {
      c.fillStyle = ["#343e37", "#c8a48b", "#76e1d7", "#e5c967"][t - 16];
      for (let i = 0; i < 9; i++) {
        const x = 2 + Math.floor(hash(i, 3, t) * 11),
          y = 2 + Math.floor(hash(i, 7, t) * 11);
        c.fillRect(t * 16 + x, y, 2, 2);
      }
    }
    if (t === 23) {
      c.fillStyle = "#4b3d5c";
      for (let i = 0; i < 9; i++)
        c.fillRect(
          t * 16 + Math.floor(hash(i, 2, 3) * 14),
          Math.floor(hash(i, 6, 3) * 14),
          3,
          2,
        );
    }
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}
function tile(b, face) {
  if (b === 1) return face === 2 ? 0 : face === 3 ? 2 : 1;
  if (b === 2) return 2;
  if (b === 3) return 3;
  if (b === 4) return face === 2 || face === 3 ? 5 : 4;
  if (b >= 12) return b + 1;
  return { 5: 6, 6: 7, 7: 8, 8: 9, 9: 10, 10: 11, 11: 12 }[b] ?? 3;
}
export class VoxelScene {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#c6dddd");
    this.scene.fog = new THREE.Fog("#c6dddd", 65, 155);
    this.camera = new THREE.PerspectiveCamera(
      65,
      innerWidth / innerHeight,
      0.1,
      280,
    );
    this.camera.rotation.order = "YXZ";
    this.ambient = new THREE.HemisphereLight("#fff7df", "#68795b", 2.2);
    this.scene.add(this.ambient);
    this.sun = new THREE.DirectionalLight("#fff2d7", 2.3);
    this.sun.position.set(-60, 100, 40);
    this.scene.add(this.sun);
    this.sunDisc = new THREE.Mesh(
      new THREE.BoxGeometry(7, 7, 0.25),
      new THREE.MeshBasicMaterial({ color: "#fff3c4" }),
    );
    this.moonDisc = new THREE.Mesh(
      new THREE.BoxGeometry(5, 5, 0.25),
      new THREE.MeshBasicMaterial({ color: "#c7d7db" }),
    );
    this.scene.add(this.sunDisc, this.moonDisc);
    this.torchMaterial = new THREE.MeshLambertMaterial({ color: "#996b3f" });
    this.flameMaterial = new THREE.MeshBasicMaterial({ color: "#ffcb76" });
    this.torchLights = Array.from({ length: 4 }, () => {
      const l = new THREE.PointLight("#ffbd67", 0, 13, 1.4);
      this.scene.add(l);
      return l;
    });
    this.skyColor = new THREE.Color();
    this.setTime(6000);
    this.material = new THREE.MeshLambertMaterial({
      map: atlas(),
      vertexColors: true,
    });
    this.waterMaterial = new THREE.MeshLambertMaterial({
      color: "#81bfd0",
      transparent: true,
      opacity: 0.66,
      side: THREE.DoubleSide,
    });
    this.chunks = new Map();
    this.clouds = new THREE.Group();
    const cm = new THREE.MeshLambertMaterial({
      color: "#f7f4e7",
      transparent: true,
      opacity: 0.87,
    });
    for (let i = 0; i < 20; i++) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(
          10 + hash(i, 2, 8) * 17,
          1.3,
          5 + hash(i, 4, 2) * 7,
        ),
        cm,
      );
      mesh.position.set(
        hash(i, 0, 4) * 260 - 60,
        58 + hash(i, 0, 7) * 8,
        hash(i, 1, 3) * 220 - 40,
      );
      this.clouds.add(mesh);
    }
    this.scene.add(this.clouds);
    this.outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.008, 1.008, 1.008)),
      new THREE.LineBasicMaterial({
        color: "#f9f9e5",
        transparent: true,
        opacity: 0.85,
      }),
    );
    this.scene.add(this.outline);
    this.outline.visible = false;
    this.resize = () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    };
    window.addEventListener("resize", this.resize);
  }
  setWorld(world) {
    this.world = world;
    for (const v of this.chunks.values()) {
      this.scene.remove(v);
      for (const child of v.children) child.geometry.dispose();
    }
    this.chunks.clear();
    for (let x = 0; x < SIZE; x += 16)
      for (let z = 0; z < SIZE; z += 16) this.buildChunk(x, z);
  }
  buildChunk(cx, cz) {
    const key = `${cx},${cz}`,
      old = this.chunks.get(key);
    if (old) {
      this.scene.remove(old);
      for (const child of old.children) child.geometry.dispose();
    }
    const p = [],
      n = [],
      uv = [],
      color = [],
      idx = [],
      wp = [],
      wi = [];
    let vi = 0,
      wvi = 0;
    const w = this.world;
    for (let x = cx; x < cx + 16; x++)
      for (let z = cz; z < cz + 16; z++)
        for (let y = 0; y < HEIGHT; y++) {
          const b = w.get(x, y, z);
          if (!b || b === 20) continue;
          if (b === 10) {
            if (!w.get(x, y + 1, z)) {
              wp.push(
                x,
                y + 0.87,
                z + 1,
                x + 1,
                y + 0.87,
                z + 1,
                x + 1,
                y + 0.87,
                z,
                x,
                y + 0.87,
                z,
              );
              wi.push(wvi, wvi + 1, wvi + 2, wvi, wvi + 2, wvi + 3);
              wvi += 4;
            }
            continue;
          }
          FACES.forEach((f, fi) => {
            const nb = w.get(x + f.n[0], y + f.n[1], z + f.n[2]);
            if (nb && nb !== 10 && nb !== 20) return;
            const t = tile(b, fi),
              u0 = (t * 16 + 0.2) / 512,
              u1 = (t * 16 + 15.8) / 512;
            const variation = 0.96 + hash(x, z, y) * 0.07;
            for (const v of f.v) {
              p.push(x + v[0], y + v[1], z + v[2]);
              n.push(...f.n);
              const shade = f.shade * variation;
              color.push(shade, shade, shade);
            }
            uv.push(u0, 0.015, u1, 0.015, u1, 0.985, u0, 0.985);
            idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
            vi += 4;
          });
        }
    const group = new THREE.Group();
    group.userData.torches = [];
    for (let x = cx; x < cx + 16; x++)
      for (let z = cz; z < cz + 16; z++)
        for (let y = 0; y < HEIGHT; y++)
          if (w.get(x, y, z) === 20) {
            const stem = new THREE.Mesh(
              new THREE.BoxGeometry(0.12, 0.5, 0.12),
              this.torchMaterial,
            );
            stem.position.set(x + 0.5, y + 0.25, z + 0.5);
            const flame = new THREE.Mesh(
              new THREE.BoxGeometry(0.15, 0.16, 0.15),
              this.flameMaterial,
            );
            flame.position.set(x + 0.5, y + 0.55, z + 0.5);
            group.add(stem, flame);
            group.userData.torches.push(
              new THREE.Vector3(x + 0.5, y + 0.65, z + 0.5),
            );
          }
    if (p.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(n, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute("color", new THREE.Float32BufferAttribute(color, 3));
      g.setIndex(idx);
      g.computeBoundingSphere();
      group.add(new THREE.Mesh(g, this.material));
    }
    if (wp.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(wp, 3));
      g.setIndex(wi);
      g.computeVertexNormals();
      group.add(new THREE.Mesh(g, this.waterMaterial));
    }
    this.chunks.set(key, group);
    this.scene.add(group);
  }
  updateBlock(x, z) {
    const cx = Math.floor(x / 16) * 16,
      cz = Math.floor(z / 16) * 16;
    this.buildChunk(cx, cz);
    if (x % 16 === 0 && cx > 0) this.buildChunk(cx - 16, cz);
    if (x % 16 === 15 && cx + 16 < SIZE) this.buildChunk(cx + 16, cz);
    if (z % 16 === 0 && cz > 0) this.buildChunk(cx, cz - 16);
    if (z % 16 === 15 && cz + 16 < SIZE) this.buildChunk(cx, cz + 16);
  }
  preview(time) {
    this.setTime(6000);
    this.camera.position.set(
      91 + Math.sin(time * 0.025) * 4,
      48,
      108 + Math.cos(time * 0.025) * 4,
    );
    this.camera.lookAt(49, 20, 44);
    this.outline.visible = false;
  }
  setTime(ticks) {
    const a = ((ticks % 24000) / 24000 - 0.25) * Math.PI * 2;
    this.daylight = Math.max(0.04, Math.min(1, (Math.cos(a) + 0.2) * 1.7));
    this.skyColor
      .set("#152337")
      .lerp(new THREE.Color("#c6dddd"), this.daylight);
    this.scene.background.copy(this.skyColor);
    this.scene.fog.color.copy(this.skyColor);
    this.ambient.intensity = 0.19 + this.daylight * 2.01;
    this.sun.intensity = 0.12 + this.daylight * 2.18;
    this.sun.position.set(Math.sin(a) * 100, Math.cos(a) * 100, 40);
    this.sunDisc.position.set(
      64 + Math.sin(a) * 115,
      24 + Math.cos(a) * 115,
      15,
    );
    this.sunDisc.lookAt(64, 24, 64);
    this.moonDisc.position.set(
      64 - Math.sin(a) * 115,
      24 - Math.cos(a) * 115,
      100,
    );
    this.moonDisc.lookAt(64, 24, 64);
  }
  render(time) {
    this.clouds.position.x = Math.sin(time * 0.004) * 5;
    const torches = [...this.chunks.values()]
      .flatMap((c) => c.userData.torches || [])
      .filter((p) => p.distanceToSquared(this.camera.position) < 30 * 30)
      .sort(
        (a, b) =>
          a.distanceToSquared(this.camera.position) -
          b.distanceToSquared(this.camera.position),
      );
    this.torchLights.forEach((light, i) => {
      light.intensity = torches[i] ? 6 : 0;
      if (torches[i]) light.position.copy(torches[i]);
    });
    this.renderer.render(this.scene, this.camera);
  }
  setDistance(distance) {
    this.scene.fog.near = distance * 0.48;
    this.scene.fog.far = distance;
  }
  setDrops(drops) {
    this.dropMarkers ??= [];
    while (this.dropMarkers.length > drops.length) {
      const m = this.dropMarkers.pop();
      this.scene.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    }
    drops.forEach((d, i) => {
      if (!this.dropMarkers[i]) {
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(0.4, 0.4, 0.4),
          new THREE.MeshLambertMaterial({
            color: "#d6c49a",
            emissive: "#5b5038",
            emissiveIntensity: 0.4,
          }),
        );
        this.dropMarkers[i] = m;
        this.scene.add(m);
      }
      this.dropMarkers[i].position.set(
        d.position.x,
        d.position.y + 0.3,
        d.position.z,
      );
      this.dropMarkers[i].rotation.y = this.camera.rotation.y + 0.7;
    });
  }
}
