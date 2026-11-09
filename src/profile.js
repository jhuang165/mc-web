import { AccountApi } from './multiplayer/account-api.js';
import { validName } from './multiplayer/protocol.js';

const env = import.meta.env ?? {};
export const PROFILE_API_URL = env.VITE_PROFILE_API_URL || (env.DEV ? 'http://localhost:8090/api/' : 'https://ledoge0.tail92abaf.ts.net/api/');

export class ProfileApi extends AccountApi {
  constructor(base = PROFILE_API_URL, options = {}) {
    const url = new URL(base);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid account service URL.');
    if (globalThis.location?.protocol === 'https:' && url.protocol !== 'https:') throw new Error('The account service requires HTTPS.');
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    super(url.href, { ...options, unreachable: 'The account service is unavailable. Please try again.' });
  }
  async register(name, email, password) {
    const data = await this.request('register', { method: 'POST', json: { name, email, password } });
    this.remember(data.session); return data.account;
  }
}

// Only a server-verified session can enter play. A cached username or image never counts as authentication.
export class ProfileSession {
  constructor(api = new ProfileApi()) { this.api = api; this.account = null; this.checked = false; this.checking = false; this.error = ''; this.listeners = new Set(); this.revision = 0; }
  get authenticated() { return !!this.account && !!this.api.session; }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  notify() { for (const fn of this.listeners) fn(this.account); }
  accept(account) {
    if (!account || typeof account.id !== 'string' || !validName(account.name)) throw new Error('Invalid account reply.');
    this.account = this.api.account = account; this.checked = true; this.checking = false; this.error = ''; this.notify(); return account;
  }
  async check() {
    const revision = ++this.revision;
    this.checking = true; this.error = '';
    try {
      const account = this.api.session ? await this.api.me() : null;
      if (revision !== this.revision) return this.authenticated;
      if (account) this.accept(account); else { this.account = null; this.notify(); }
    } catch (error) {
      if (revision === this.revision) { this.account = null; this.error = this.api.session ? error.message : ''; this.notify(); }
    } finally { if (revision === this.revision) { this.checked = true; this.checking = false; this.notify(); } }
    return this.authenticated;
  }
  async signIn(name, password) { this.revision++; return this.accept(await this.api.signIn(name, password)); }
  async register(name, email, password) { this.revision++; return this.accept(await this.api.register(name, email, password)); }
  async signOut() {
    this.revision++;
    try { await this.api.signOut(); } catch {} // local sign-out still succeeds during an outage
    finally { this.api.remember(null); this.account = null; this.api.account = null; this.checked = true; this.checking = false; this.error = ''; this.notify(); }
  }
}
