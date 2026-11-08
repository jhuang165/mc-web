// Column mesh worker (see mesh-region.js): receives region snapshots, answers with typed arrays. Colormaps arrive first.
import { setColormaps } from "./biome-colors.js";
import { runMeshJob } from "./mesh-region.js";

self.onmessage = ({ data }) => {
  if (data.type === "colormaps") { setColormaps(data.grass, data.foliage); return; }
  try {
    const { message, transfer } = runMeshJob(data);
    self.postMessage(message, transfer);
  } catch (error) {
    self.postMessage({ type: "error", id: data.id, message: String(error?.message ?? error) });
  }
};
