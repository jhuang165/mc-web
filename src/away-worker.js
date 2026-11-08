// Worker for away-world.js: posts "ready" once the module graph is loaded, then runs one plan per message.
import { runAway } from "./away-world.js";
import { populationBlockMapperReady } from "./population-world.js";

const ready = populationBlockMapperReady.then(() => self.postMessage({ type: "ready" }));
self.onmessage = async ({ data }) => {
  try {
    await ready;
    const result = await runAway(data);
    const transfer = result ? result.columns.flatMap((c) => [c.cells.buffer, c.values.buffer, c.order.buffer]) : [];
    self.postMessage({ type: "result", result }, transfer);
  } catch (error) {
    self.postMessage({ type: "error", message: String(error?.message ?? error) });
  }
};
