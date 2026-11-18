// Batch 78 mpperf78: the real dedicated server over real localhost WebSockets with N headless node clients.
// node tools/bench-sockets78.mjs [--clients=8] [--mobs=200] [--secs=20] [--warm=5] [--walk=1] [--pen=0]
// Starts server/server.js (createDedicatedServer, port 0, 127.0.0.1, temp data dir) in this process and the clients in a child process (so client JSON.parse is not on the server's CPU time
// as far as the OS shares cores). Per tick it records the whole tick callback (simulation.tick + encode + send + the per-player loop), the simulation.tick part, JSON.stringify time inside the
// callback (the encode cost) and WebSocket.send time (framing and the socket write). Bytes sent come from WebSocket.prototype.send on the server side; the clients also count bytes per
// message type. Binds only to 127.0.0.1; no remote endpoint is contacted. Everything is shut down and the temp directory removed at the end.
// b80 mpperf80 --wire: also keeps every payload the server sends during the measured window (per socket, in order) and afterwards measures, offline on those bytes, what
// permessage-deflate would cost and save (zlib deflateRaw per message without context takeover, and context takeover modelled as the previous 32 KB of that socket as a preset
// dictionary; levels 1 and 6) and the bulk cost of TLS record encryption (AES-128-GCM and ChaCha20-Poly1305 over 16 KB records; no handshake, no kernel or framing cost). The server
// itself is unchanged (perMessageDeflate stays off, no TLS in node; the live server's TLS ends at the Funnel proxy).
import { performance } from 'node:perf_hooks';
import { fork } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { PROTOCOL, IDLE_INPUT } from '../src/multiplayer/protocol.js';

const arg = (n, d) => (process.argv.find(a => a.startsWith(`--${n}=`)) ?? `=${d}`).split('=')[1];
const CLIENTS = +arg('clients', 8), MOBS = +arg('mobs', 200), SECS = +arg('secs', 20), WARM = +arg('warm', 5), PEN = +arg('pen', 0);
const ORIGIN = 'http://localhost:5179', SELF = fileURLToPath(import.meta.url);
const lcg = (seed) => { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };

if (process.argv.includes('--child')) {
  // ---- client process: join, walk about, ack keep-alives, count what arrives ----
  const port = +arg('port', 0), sessions = JSON.parse(arg('sessions', '[]')), walk = arg('walk', 1) === '1';
  const stats = sessions.map(() => ({ bytes: 0, msgs: 0, byType: {}, welcome: false, closed: null }));
  const rnd = lcg(7), sockets = [];
  sessions.forEach((session, i) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/multiplayer`, { origin: ORIGIN }), st = stats[i]; sockets.push(ws);
    let yaw = rnd() * 6, f = 0;
    ws.on('open', () => ws.send(JSON.stringify({ type: 'join', protocol: PROTOCOL, chunks: true, session })));
    ws.on('message', (d) => {
      const n = d.length ?? Buffer.byteLength(d); st.bytes += n; st.msgs++;
      let m; try { m = JSON.parse(d.toString()); } catch { return; }
      st.byType[m.type] = (st.byType[m.type] ?? 0) + n;
      if (m.type === 'welcome') st.welcome = true;
      if (m.type === 'pingKeepAlive') ws.send(JSON.stringify({ type: 'pingKeepAliveAck', id: m.id }));
    });
    ws.on('close', (code, reason) => { st.closed = `${code} ${reason}`; });
    ws.on('error', () => {});
    const timer = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN || !st.welcome) return;
      if (walk && rnd() < 0.05) { yaw = rnd() * 6; f = rnd() < 0.7 ? 1 : 0; }
      ws.send(JSON.stringify({ type: 'input', controls: { ...IDLE_INPUT, forward: f }, yaw, pitch: 0, current: 0, hotbar: Array(9).fill(null) }));
    }, 50);
    ws.on('close', () => clearInterval(timer));
  });
  process.on('message', (m) => {
    if (m === 'report') process.send({ stats });
    if (m === 'stop') { for (const ws of sockets) ws.close(); setTimeout(() => process.exit(0), 200); }
  });
  process.send({ ready: true });
} else {
  // ---- server process ----
  const { World } = await import('../src/world.js');
  const { DedicatedSimulation } = await import('../src/multiplayer/simulation.js');
  const { createDedicatedServer } = await import('../server/server.js');
  const SIZE = 200, TICK_MS = 50;
  const world = new World('mpperf78');
  for (let x = 4; x < SIZE; x++) for (let z = 4; z < SIZE; z++) { world.put(x, 9, z, 1, 0, false); for (let y = 10; y <= 20; y++) world.put(x, y, z, 0, 0, false); }
  world.spawn = () => ({ x: SIZE / 2 + 0.5, y: 10, z: SIZE / 2 + 0.5 });
  const sim = new DedicatedSimulation({}, { world, gameMode: 'survival', mobs: true, rules: { chunkStream: true, maxPlayers: 32 } });
  sim.gameRules.doMobSpawning = 'false'; sim.gameRules.doDaylightCycle = 'false'; sim.difficulty = 2; sim.mobs.mobs.difficulty = 2; sim.time = 18000;
  const host = sim.mobs.mobs, rnd = lcg(5), KINDS = ['pig', 'cow', 'sheep', 'chicken', 'zombie', 'skeleton', 'creeper', 'villager'];
  host.entities.length = 0;
  for (let i = 0; i < MOBS; i++) {
    const kind = PEN ? 'cow' : KINDS[i % KINDS.length], c = SIZE / 2, spread = PEN || 60;
    const m = host.create(kind, c + (rnd() - 0.5) * spread, 10, c + (rnd() - 0.5) * spread); m.persistent = true; host.entities.push(m);
  }

  // timing hooks, installed before the server starts its interval
  const acc = { tick: [], sim: [], encode: [], send: [], sendBytes: 0, sends: 0 };
  let inTick = false, encodeMs = 0, sendMs = 0, measuring = false, simMs = 0;
  const realInterval = globalThis.setInterval;
  globalThis.setInterval = (fn, ms, ...rest) => ms !== TICK_MS ? realInterval(fn, ms, ...rest) : realInterval(() => {
    inTick = true; encodeMs = 0; sendMs = 0; simMs = 0; const t0 = performance.now();
    try { fn(); } finally { const dt = performance.now() - t0; inTick = false; if (measuring) { acc.tick.push(dt); acc.sim.push(simMs); acc.encode.push(encodeMs); acc.send.push(sendMs); } }
  }, ms, ...rest);
  const realStringify = JSON.stringify;
  JSON.stringify = function (...a) { if (!inTick) return realStringify.apply(this, a); const t = performance.now(); const r = realStringify.apply(this, a); encodeMs += performance.now() - t; return r; };
  const realSend = WebSocket.prototype.send;
  const WIRE = process.argv.includes('--wire'), wire = new Map();
  WebSocket.prototype.send = function (data, ...rest) { const t = inTick ? performance.now() : 0; try { return realSend.call(this, data, ...rest); } finally { if (inTick) sendMs += performance.now() - t; if (measuring) { acc.sendBytes += Buffer.byteLength(data); acc.sends++; if (WIRE) { let l = wire.get(this); if (!l) wire.set(this, (l = [])); l.push(Buffer.from(data)); } } } };
  const realSimTick = sim.tick.bind(sim);
  sim.tick = (...a) => { const t = performance.now(); try { return realSimTick(...a); } finally { simMs += performance.now() - t; } };

  const dir = await mkdtemp(path.join(os.tmpdir(), 'mc-web-sockets78-'));
  const token = 'bench-only-not-a-deployed-server-key';
  const app = await createDedicatedServer({ port: 0, bind: '127.0.0.1', token, dataFile: path.join(dir, 'world.json'), simulation: sim, tickMs: TICK_MS, saveMs: 3600000, origins: [ORIGIN] });
  let child, code = 0;
  try {
    const sessions = [];
    for (let i = 0; i < CLIENTS; i++) sessions.push((await app.accounts.register({ invite: token, name: `Bench${i}`, password: 'correct horse battery' }, token)).session);
    child = fork(SELF, ['--child', `--port=${app.port}`, `--sessions=${JSON.stringify(sessions)}`, `--walk=${arg('walk', 1)}`]);
    const msg = (want) => new Promise((resolve) => { const h = (m) => { if (want(m)) { child.off('message', h); resolve(m); } }; child.on('message', h); });
    await msg((m) => m.ready);
    const joined = async () => { for (let i = 0; i < 400; i++) { if (sim.players.size >= CLIENTS) return; await new Promise(r => setTimeout(r, 25)); } throw new Error(`only ${sim.players.size} of ${CLIENTS} joined`); };
    await joined();
    await new Promise(r => setTimeout(r, WARM * 1000));
    measuring = true; const t0 = performance.now(), lagT = []; let last = performance.now();
    const lag = realInterval(() => { const n = performance.now(); lagT.push(n - last - 10); last = n; }, 10);
    await new Promise(r => setTimeout(r, SECS * 1000));
    measuring = false; clearInterval(lag); const secs = (performance.now() - t0) / 1000;
    child.send('report'); const { stats } = await msg((m) => m.stats);
    const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))] ?? 0; };
    const mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
    const n = acc.tick.length, mobsTracked = host.entities.length;
    console.log(`clients=${CLIENTS} mobs=${mobsTracked}${PEN ? ` (cow pen ${PEN} x ${PEN})` : ''} secs=${secs.toFixed(1)} ticks=${n} (${(n / secs).toFixed(1)}/s, nominal 20) players=${sim.players.size} closed=${stats.filter(s => s.closed).length}`);
    console.log(`tick callback ms: mean=${mean(acc.tick).toFixed(2)} p95=${pct(acc.tick, .95).toFixed(2)} max=${Math.max(...acc.tick).toFixed(1)}   simulation.tick=${mean(acc.sim).toFixed(2)}  JSON.stringify(encode)=${mean(acc.encode).toFixed(2)}  ws.send=${mean(acc.send).toFixed(2)}  rest(tracker views, loop)=${(mean(acc.tick) - mean(acc.sim) - mean(acc.encode) - mean(acc.send)).toFixed(2)}`);
    console.log(`server sent: ${(acc.sendBytes / secs / CLIENTS / 1024).toFixed(1)} KB/s per player, ${(acc.sends / secs / CLIENTS).toFixed(1)} msgs/s per player, ${(acc.sendBytes / Math.max(1, acc.sends)).toFixed(0)} B/msg`);
    const byType = {}; for (const s of stats) for (const [k, v] of Object.entries(s.byType)) byType[k] = (byType[k] ?? 0) + v;
    const tot = Object.values(byType).reduce((a, b) => a + b, 0);
    console.log(`client received by type (all measured + warm-up + join): ${Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${(100 * v / tot).toFixed(0)}%`).join(', ')}; total ${(tot / 1024).toFixed(0)} KB; welcome ${(stats[0].byType.welcome / 1024).toFixed(0)} KB`);
    console.log(`event-loop lag over 10 ms timer: mean=${mean(lagT).toFixed(2)} p95=${pct(lagT, .95).toFixed(1)} max=${Math.max(...lagT).toFixed(0)}`);
    if (WIRE) wireReport([...wire.values()], secs, n);
  } catch (e) { console.error(e); code = 1; }
  finally {
    try { child?.send('stop'); } catch {}
    await app.close(); await rm(dir, { recursive: true, force: true });
    setTimeout(() => process.exit(code), 400);
  }
}

// --wire: offline cost of compression and TLS record encryption over the captured payloads (see the header). ms figures are per server tick (all sockets together).
function wireReport(lists, secs, ticks) {
  const all = lists.flat(), raw = all.reduce((a, b) => a + b.length, 0);
  const out = [`wire: ${all.length} messages, ${(raw / 1024).toFixed(0)} KB raw over ${secs.toFixed(1)} s (${ticks} ticks)`];
  for (const level of [1, 6]) {
    let t = performance.now(), bytes = 0; const packed = [];
    for (const b of all) { const z = zlib.deflateRawSync(b, { level }); packed.push(z); bytes += z.length; } // RFC 7692 also strips the 4-byte sync tail; deflateRawSync ends with a final block instead
    const perMsg = performance.now() - t;
    t = performance.now(); let ctxBytes = 0;
    // context takeover, modelled: each message deflated with the previous 32 KB that socket sent as the preset dictionary (the LZ77 window a kept context would hold);
    // the dictionary load makes this an upper bound on the time
    for (const l of lists) { let win = Buffer.alloc(0); for (const b of l) { ctxBytes += zlib.deflateRawSync(b, { level, dictionary: win }).length; win = Buffer.concat([win, b]); if (win.length > 32768) win = win.subarray(win.length - 32768); } }
    const ctx = performance.now() - t;
    t = performance.now(); let back = 0;
    for (const z of packed) back += zlib.inflateRawSync(z).length;
    const inflate = performance.now() - t;
    out.push(`  deflate level ${level}: no context takeover ${(100 * bytes / raw).toFixed(1)}% of raw, ${(perMsg / ticks).toFixed(2)} ms/tick; context takeover ${(100 * ctxBytes / raw).toFixed(1)}% of raw, ${(ctx / ticks).toFixed(2)} ms/tick; client inflate (no takeover) ${(inflate / ticks).toFixed(2)} ms/tick for all clients together${back === raw ? '' : ' (ROUND TRIP MISMATCH)'}`);
  }
  for (const alg of ['aes-128-gcm', 'chacha20-poly1305']) {
    const key = crypto.randomBytes(alg === 'aes-128-gcm' ? 16 : 32), t = performance.now(); let n = 0;
    for (const b of all) for (let o = 0; o < b.length; o += 16384) { const c = crypto.createCipheriv(alg, key, crypto.randomBytes(12), { authTagLength: 16 }); n += c.update(b.subarray(o, o + 16384)).length; c.final(); c.getAuthTag(); }
    out.push(`  TLS record encryption ${alg}: ${((performance.now() - t) / ticks).toFixed(3)} ms/tick over ${(n / 1024).toFixed(0)} KB (cipher only, one record per message or 16 KB)`);
  }
  console.log(out.join('\n'));
}
