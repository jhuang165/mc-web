// Batch 57 (b57dp): headless Chrome (audio muted, own vite port) renders the display cases of tools/display-pixel/harness.js and records the centre pixels in
// public/research/display-pixel-render.json. src/display-pixel-b57.test.js compares them with the native formulas. Usage: node tools/verify-display-pixel-render.mjs [port]
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
import { renderCases } from "../src/display-light-cases.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), ".."), port = Number(process.argv[2] || 5704), debugPort = port + 1000;
const chromeBin = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const vite = spawn(path.join(root, "node_modules/.bin/vite"), ["--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd: root, stdio: "ignore" });
const profile = await mkdtemp(path.join(os.tmpdir(), "b57dp-"));
const chrome = spawn(chromeBin, ["--headless=new", "--mute-audio", "--disable-gpu-vsync", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "--no-first-run", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "about:blank"], { stdio: "ignore" });
const cleanup = async () => { chrome.kill(); vite.kill(); await sleep(300); await rm(profile, { recursive: true, force: true }); };
try {
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(500);
    try { target = (await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json()).find((t) => t.type === "page"); } catch {}
  }
  if (!target) throw new Error("no Chrome page target");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.once("open", r));
  let id = 0; const waiting = new Map();
  ws.on("message", (m) => { const d = JSON.parse(m); if (d.id && waiting.has(d.id)) { waiting.get(d.id)(d); waiting.delete(d.id); } });
  const send = (method, params = {}) => new Promise((res) => { const n = ++id; waiting.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
  for (let i = 0; i < 60; i++) { // wait for vite
    try { if ((await fetch(`http://127.0.0.1:${port}/tools/display-pixel/harness.html`)).ok) break; } catch {}
    await sleep(500);
  }
  await send("Page.navigate", { url: `http://127.0.0.1:${port}/tools/display-pixel/harness.html` });
  let ready = false;
  for (let i = 0; i < 80 && !ready; i++) { await sleep(500); ready = (await send("Runtime.evaluate", { expression: "window.__ready === true", returnByValue: true })).result?.result?.value; }
  if (!ready) throw new Error("harness not ready");
  const cases = renderCases();
  const r = await send("Runtime.evaluate", { expression: `JSON.stringify(window.__measure(${JSON.stringify(cases)}))`, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
  const ua = (await send("Runtime.evaluate", { expression: "navigator.userAgent + ' | ' + (document.createElement('canvas').getContext('webgl2').getParameter(37446))", returnByValue: true })).result.result.value;
  const results = JSON.parse(r.result.result.value);
  await writeFile(path.join(root, "public/research/display-pixel-render.json"), JSON.stringify({ target: "port render (not native pixels)", tag: "b57dp", renderer: ua, size: 8, results }) + "\n");
  console.log(`${results.length} display pixel cases; ${ua}`);
  ws.close();
} finally { await cleanup(); }
