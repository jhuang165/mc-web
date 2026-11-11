// Runs tools/probes/IconEdgeProbe.java (an independent float32 model of the renderItemIntoGUI cube plus pixel-centre rasterisation; needs only a JDK)
// and writes public/research/icon-edge-reference.json, which src/icon-cube.test.js compares the port's rasterIcon against.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import path from "node:path";

const exec = promisify(execFile), root = path.dirname(fileURLToPath(import.meta.url)), out = await mkdtemp(path.join(tmpdir(), "iconedge-"));
try {
  await exec("javac", ["-nowarn", "-d", out, path.join(root, "probes/IconEdgeProbe.java")]);
  const { stdout } = await exec("java", ["-cp", out, "IconEdgeProbe"]);
  const lines = stdout.trim().split("\n").map((l) => JSON.parse(l)), matrix = lines.shift().matrix;
  await writeFile(path.join(root, "../public/research/icon-edge-reference.json"), JSON.stringify({
    source: "tools/verify-icon-edges.mjs: tools/probes/IconEdgeProbe.java (independent float32 composition of the bytecode-read GL11 calls; faces rasterised at pixel centres)",
    matrix, faces: lines,
  }) + "\n");
  console.log(`${lines.length} face rasters`);
} finally { await rm(out, { recursive: true, force: true }); }
