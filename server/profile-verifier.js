// The gun server's view of website accounts: it never reads or writes the account database. A joining player's profile session is
// checked with the profile service over loopback (GET /api/me) and only the immutable account ID, name and skin hash are kept.
// The session itself is never logged or stored.
import http from 'node:http';

export const SESSION = /^[A-Za-z0-9_-]{1,100}$/;
export class ProfileUnavailable extends Error {}

export class ProfileVerifier {
  constructor({ base = 'http://127.0.0.1:8090', timeoutMs = 5000, request = null } = {}) {
    const url = new URL(base);
    if (url.protocol !== 'http:' || url.username || url.password) throw new Error('The profile service URL must be plain loopback HTTP.');
    this.url = url; this.timeoutMs = timeoutMs; this.request = request ?? (opts => this.#get(opts));
  }
  // { id, name, skin } for a live session, null when the profile service rejects it; throws ProfileUnavailable otherwise.
  async verify(session) {
    if (typeof session !== 'string' || !SESSION.test(session)) return null;
    const { status, body } = await this.request({ path: '/api/me', headers: { authorization: `Bearer ${session}`, accept: 'application/json' } });
    if (status === 401 || status === 403) return null;
    if (status !== 200) throw new ProfileUnavailable(`Profile service answered ${status}.`);
    let account;
    try { account = JSON.parse(body).account; } catch { throw new ProfileUnavailable('Profile service sent malformed JSON.'); }
    if (!account || typeof account.id !== 'string' || typeof account.name !== 'string') throw new ProfileUnavailable('Profile service sent no account.');
    return { id: account.id, name: account.name, skin: typeof account.skin === 'string' ? account.skin : null };
  }
  #get({ path, headers }) {
    return new Promise((resolve, reject) => {
      const req = http.get({ hostname: this.url.hostname.replace(/^\[|\]$/g, ''), port: +this.url.port || 80, path, headers, timeout: this.timeoutMs }, res => {
        const chunks = []; let size = 0;
        res.on('data', c => { size += c.length; if (size > 65536) req.destroy(new ProfileUnavailable('Profile answer too large.')); else chunks.push(c); });
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
        res.on('error', e => reject(new ProfileUnavailable(e.message)));
      });
      req.on('timeout', () => req.destroy(new ProfileUnavailable('Profile service timed out.')));
      req.on('error', e => reject(e instanceof ProfileUnavailable ? e : new ProfileUnavailable(e.code ?? 'Profile service unreachable.')));
    });
  }
}
