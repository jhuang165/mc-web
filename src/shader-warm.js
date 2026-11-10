// Shader warm-up behind a loading screen. Three's WebGLRenderer.compileAsync polls every material it collected for `currentProgram.isReady()` and, when a
// material was disposed meanwhile, reads `undefined.isReady` inside a setTimeout: the promise then never settles. The render loop keeps running during a
// trip (MobRenderer.update and DropRenderer.remove dispose the materials of entities that left), so a trip with a mob or item in the old view stayed on
// "Downloading terrain" for good (batch 40). This version drops a material that lost its program, never throws, and gives up after `timeoutMs`.
export function compileReady(renderer, scene, camera, { pollMs = 10, timeoutMs = 20000, setTimer = setTimeout, now = () => performance.now() } = {}) {
  let materials;
  try { materials = new Set(renderer.compile(scene, camera)); } catch { return Promise.resolve(); }
  const end = now() + timeoutMs;
  return new Promise((resolve) => {
    const check = () => {
      try {
        for (const material of [...materials]) {
          const program = renderer.properties.get(material)?.currentProgram;
          if (!program || program.isReady()) materials.delete(material); // no program: the material was disposed (or never linked); nothing to wait for
        }
      } catch { materials.clear(); }
      if (!materials.size || now() >= end) resolve();
      else setTimer(check, pollMs);
    };
    check();
  });
}
