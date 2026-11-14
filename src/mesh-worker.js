// Column mesh worker (see mesh-region.js): receives region snapshots, answers with typed arrays. Colormaps arrive first.
import { setColormaps } from "./biome-colors.js";
import { runMeshJob } from "./mesh-region.js";
import { setTerrainSizes } from "./block-textures.js";

self.onmessage = ({ data }) => {
  if (data.type === "colormaps") { setColormaps(data.grass, data.foliage); return; }
  // The page's terrain atlas layout (sprite sizes of an HD pack): the same stitch gives the same uvs here (batch 65).
  if (data.type === "terrainLayout") { setTerrainSizes(data.sizes, { maxSize: data.maxSize, mip: data.mip }); return; }
  try {
    const { message, transfer } = runMeshJob(data);
    self.postMessage(message, transfer);
  } catch (error) {
    self.postMessage({ type: "error", id: data.id, message: String(error?.message ?? error) });
  }
};
