// Batch 68 pistons5: runs tools/probes/PistonCartProbe.java (original classes: carts, boats and riders under a piston, entity onUpdate running in
// World.updateEntities before the tile entity loop) and writes public/research/piston-cart-reference.json for src/pistons5-b68.test.js.
// Needs a JDK, the pinned client JAR (tools/research or MC_RESEARCH) and guava / log4j-api / commons-lang3 / netty-all (MC_PROBE_LIBS or a launcher cache).
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile, access, rm, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const exec = promisify(execFile), root = path.dirname(fileURLToPath(import.meta.url)), exists = (p) => access(p).then(() => true, () => false);
const STONE = 1, PISTON = 33, REDSTONE_BLOCK = 152, RAIL = 66;
const ORIGIN = [4, 10, 4], SIZE = [8, 6, 6];
const PIG = 0, CART = 1, BOAT = 2, CART_RIDER = 8, BOAT_RIDER = 9;
const live = (t, label, kind, [x, y, z], [vx, vy, vz] = [0, 0, 0]) => [t, "live", x, y, z, label, kind, vx, vy, vz];
function scenario(name, { cells, events, ticks, note }) {
  const grid = [];
  for (let x = 0; x < SIZE[0]; x++) for (let y = 0; y < SIZE[1]; y++) for (let z = 0; z < SIZE[2]; z++) grid.push(cells[`${x},${y},${z}`] ?? (y === 0 ? STONE : 0));
  return { name, note, ticks, seed: 1, grid: grid.join(","), events, };
}
export const SCENARIOS = [];
const rails = (x0, x1, y, z, meta = 1) => Object.fromEntries(Array.from({ length: x1 - x0 + 1 }, (_, i) => [`${x0 + i},${y},${z}`, `${RAIL}:${meta}`]));
const push = (t = 1) => [t, "place", 0, 1, 2, REDSTONE_BLOCK, 0]; // redstone block west of a piston at (1,1,2) facing east
const east = { "1,1,2": `${PISTON}:5` };
// A: cart on a rail line in the head's cell (the head's cell rail is destroyed by the push), rails continue ahead.
SCENARIOS.push(scenario("cart-rail-head", { cells: { ...east, ...rails(2, 6, 1, 2) }, ticks: 14, note: "head extends over a rail with a resting cart on it; rails continue east", events: [live(1, 1, CART, [2, 1, 2]), push(1)] }));
SCENARIOS.push(scenario("cart-rail-moving", { cells: { ...east, ...rails(2, 6, 1, 2) }, ticks: 14, note: "same, the cart rolls east at 0.1", events: [live(1, 1, CART, [2, 1, 2], [0.1, 0, 0]), push(1)] }));
// B: stone pushed east into a rail cell with a cart (rail destroyed by the moving block).
SCENARIOS.push(scenario("cart-rail-stone", { cells: { ...east, "2,1,2": STONE, ...rails(3, 6, 1, 2) }, ticks: 14, note: "stone pushed into the next cell where a cart rests on a rail", events: [live(1, 1, CART, [3, 1, 2]), push(1)] }));
// C: cart on a bare floor, then with a rider.
SCENARIOS.push(scenario("cart-bare-head", { cells: { ...east }, ticks: 12, note: "head pushes a resting cart on bare ground", events: [live(1, 1, CART, [2, 1, 2]), push(1)] }));
SCENARIOS.push(scenario("rider-cart-bare", { cells: { ...east }, ticks: 12, note: "head pushes a resting cart with a pig rider", events: [live(1, 1, CART_RIDER, [2, 1, 2]), push(1)] }));
SCENARIOS.push(scenario("rider-cart-rail", { cells: { ...east, ...rails(2, 6, 1, 2) }, ticks: 14, note: "head pushes a resting cart with a pig rider on a rail line", events: [live(1, 1, CART_RIDER, [2, 1, 2]), push(1)] }));
SCENARIOS.push(scenario("rider-cart-wall", { cells: { ...east, "4,1,2": STONE, "4,2,2": STONE }, ticks: 12, note: "head pushes a cart with a rider into a wall two cells ahead", events: [live(1, 1, CART_RIDER, [2, 1, 2], [0.1, 0, 0]), push(1)] }));
SCENARIOS.push(scenario("rider-boat", { cells: { ...east }, ticks: 12, note: "head pushes a boat with a pig rider", events: [live(1, 1, BOAT_RIDER, [2, 1, 2]), push(1)] }));
SCENARIOS.push(scenario("rider-cart-lift", { cells: { "2,1,2": `${PISTON}:1`, "2,2,2": STONE }, ticks: 12, note: "piston facing up lifts a stone with a cart and rider on top", events: [live(1, 1, CART_RIDER, [2, 3, 2]), [1, "place", 2, 1, 1, REDSTONE_BLOCK, 0]] }));
const input = SCENARIOS.map((s) => `scenario ${s.name} ${ORIGIN.join(" ")} ${SIZE.join(" ")} ${s.ticks} ${s.seed}\ngrid ${s.grid}\n${s.events.map((e) => `event ${e.join(" ")}`).join("\n")}\n`).join("");
export async function runNative() {
  const researchDirs = [process.env.MC_RESEARCH, path.join(root, "../../tools/research")].filter(Boolean);
  let research;
  for (const dir of researchDirs) if (await exists(path.join(dir, "minecraft-1.7.10.jar"))) { research = dir; break; }
  if (!research) throw new Error("Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.");
  const jar = path.join(research, "minecraft-1.7.10.jar"), clientSha1 = "e80d9b3bf5085002218d4be59e668bac718abbc6";
  assert.equal(createHash("sha1").update(await readFile(jar)).digest("hex"), clientSha1);
  const library = async (prefix) => {
    for (const p of (process.env.MC_PROBE_LIBS || "").split(path.delimiter).filter(Boolean)) if (path.basename(p).startsWith(prefix)) return p;
    for (const dir of [path.join(research, "libs-1.7.10"), path.join(os.homedir(), "Library/Application Support/minecraft/libraries"), path.join(os.homedir(), ".minecraft/libraries"), path.join(os.homedir(), ".gradle/caches")]) {
      if (!(await exists(dir))) continue;
      const { stdout } = await exec("find", [dir, "-name", prefix + "*.jar", "-not", "-name", "*sources*"], { maxBuffer: 1 << 24 });
      const hit = stdout.split("\n").filter(Boolean).sort()[0];
      if (hit) return hit;
    }
    throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
  };
  const libs = await Promise.all(["guava-", "log4j-api-", "commons-lang3-", "netty-all-"].map(library));
  const out = path.join(research, "piston-cart-probe"), classes = path.join(out, "classes"), probe = path.join(out, "probe");
  await rm(out, { recursive: true, force: true });
  await mkdir(classes, { recursive: true }); await mkdir(probe, { recursive: true });
  await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 });
  const cp = [probe, classes, ...libs].join(path.delimiter);
  await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/PistonProbe.java"), path.join(root, "probes/PistonLiveProbe.java"), path.join(root, "probes/PistonCartProbe.java")]);
  const child = spawn("java", ["-cp", cp, "PistonCartProbe"], { stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "", stderr = "";
  child.stdout.on("data", (d) => (stdout += d)); child.stderr.on("data", (d) => (stderr += d));
  child.stdin.end(input);
  await new Promise((res, rej) => child.on("close", (c) => (c === 0 ? res() : rej(new Error("java exited " + c + "\n" + stderr)))));
  return { natives: stdout.trim().split("\n").map((l) => JSON.parse(l)), clientSha1 };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { natives, clientSha1 } = await runNative();
  assert.equal(natives.length, SCENARIOS.length);
  if (process.env.DUMP) for (const n of natives) { console.log(n.name); n.live.forEach((l, t) => console.log(" ", t + 1, l.map((e) => e.map((v) => typeof v === "number" ? +v.toFixed(4) : v).join(",")).join(" | "))); console.log("  moves", JSON.stringify(n.liveMoves)); }
  else {
    const reference = { target: "Minecraft Java 1.7.10", clientSha1, origin: ORIGIN, size: SIZE, method: "tools/probes/PistonCartProbe.java: PistonLiveProbe's world with live entities in World.loadedEntityList, so World.updateEntities runs entity onUpdate (carts, rail snapping, updateRidden) before the tile entity loop. live rows [label,posX,minY,posZ,motionX,motionY,motionZ,onGround,collidedH,fallDistance,ridingLabel] after each tick; liveMoves [tick,label,dx,dy,dz] requested of Entity.moveEntity. Region-relative.",
      scenarios: SCENARIOS.map((s, i) => ({ ...s, live: natives[i].live, liveMoves: natives[i].liveMoves })) };
    await writeFile(path.join(root, "../public/research/piston-cart-reference.json"), JSON.stringify(reference) + "\n");
    console.log("wrote", SCENARIOS.length, "scenarios");
  }
}
