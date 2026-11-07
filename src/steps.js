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
