// Step generators: a long computation written as a generator that yields between independent pieces (light.js, dimensions.js
// Teleporter). `drain` runs one to its end at once, which is the old synchronous call; `runSteps` runs it in slices behind a
// loading screen. The statements and their order are the same, so the result does not depend on how the steps are spread.
export function drain(steps) {
  for (let r = steps.next(); ; r = steps.next()) if (r.done) return r.value;
}
// Runs `steps` for about `budgetMs` at a time, awaiting `pause()` (a frame) between slices; resolves with the generator's value.
// The clock is read every `every` steps so a very fine-grained generator does not spend its time in performance.now().
export async function runSteps(steps, pause, { budgetMs = 12, every = 16, now = () => performance.now() } = {}) {
  let end = now() + budgetMs, n = 0;
  for (let r = steps.next(); ; r = steps.next()) {
    if (r.done) return r.value;
    if (++n % every === 0 && now() >= end) { await pause(); end = now() + budgetMs; }
  }
}

// A pause between slices of loading-screen work that does not wait for a frame: a macrotask (MessageChannel) lets input and the browser's
// own rendering run in between, and `nextPaint`'s two frames (about 33 ms) per 12 ms slice were most of the time the mesh and light
// slices took (batch 29). A real animation frame is still waited for once `frameMs` of tasks have gone by without one, so the
// screen keeps painting. `frame` and `now` are injectable for tests.
export function taskPause({ frameMs = 100, now = () => performance.now(), frame = () => new Promise((r) => requestAnimationFrame(() => r())), channel = () => new MessageChannel() } = {}) {
  let lastFrame = now();
  return async () => {
    if (now() - lastFrame >= frameMs) { await frame(); lastFrame = now(); return; }
    await new Promise((resolve) => { const c = channel(); c.port1.onmessage = () => { c.port1.close?.(); resolve(); }; c.port2.postMessage(0); });
  };
}
