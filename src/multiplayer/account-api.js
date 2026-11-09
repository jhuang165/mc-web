import { apiBase } from './protocol.js';

// Account requests to the dedicated server's /api/. The session token is a
// bearer header, never a cookie or URL parameter.
export class AccountApi {
  constructor(serverAddress, { storage = globalThis.localStorage, fetch = globalThis.fetch.bind(globalThis), unreachable = 'Could not reach the server. Check that Tailscale is connected.' } = {}) {
    this.base = apiBase(serverAddress);
    this.storage = storage; this.fetch = fetch;
    this.unreachable = unreachable;
    this.key = 'mc-web-session:' + this.base;
    try { this.session = JSON.parse(storage.getItem(this.key) ?? 'null')?.session ?? null; } catch { this.session = null; }
    this.account = null;
  }
  remember(session) {
    this.session = session;
    try {
      if (session) this.storage.setItem(this.key, JSON.stringify({ session }));
      else this.storage.removeItem(this.key);
    } catch {} // A browser that refuses persistence can still use an in-memory session.
  }
  async request(path, { method = 'GET', json, body, type } = {}) {
    const headers = {}, requestSession = this.session;
    if (requestSession) headers.Authorization = 'Bearer ' + requestSession;
    if (json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
    else if (type) headers['Content-Type'] = type;
    let response;
    try { response = await this.fetch(new URL(path, this.base), { method, headers, body, cache: 'no-store', signal: globalThis.AbortSignal?.timeout?.(12000) }); }
    catch { throw new Error(this.unreachable); }
    const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
    if (response.status === 401 && path !== 'login' && this.session === requestSession) { this.remember(null); this.account = null; }
    if (!response.ok) throw new Error(data.error || `Server answered ${response.status}.`);
    if (data.account && (this.session === requestSession || path === 'login' || path === 'register')) this.account = data.account;
    return data;
  }
  async signIn(name, password) { const d = await this.request('login', { method: 'POST', json: { name, password } }); this.remember(d.session); return d.account; }
  async register(name, password, invite) { const d = await this.request('register', { method: 'POST', json: { name, password, invite } }); this.remember(d.session); return d.account; }
  async me() { return (await this.request('me')).account; }
  async signOut() { try { await this.request('logout', { method: 'POST' }); } finally { this.remember(null); this.account = null; } }
  async rename(name) { return (await this.request('me', { method: 'PATCH', json: { name } })).account; }
  async uploadSkin(png) { return (await this.request('skin', { method: 'PUT', body: png, type: 'image/png' })).account; }
  async clearSkin() { return (await this.request('skin', { method: 'DELETE' })).account; }
  async invite() { return this.request('invites', { method: 'POST' }); }
  skinUrl(hash) { return hash ? new URL(`skins/${hash}.png`, this.base).href : null; }
}
