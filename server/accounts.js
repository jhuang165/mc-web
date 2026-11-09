// Invite-only accounts for the dedicated browser world. Passwords are scrypt
// hashes with per-account salts; session tokens and invite codes are stored
// only as SHA-256 hashes. Skins are 64 x 32 PNGs addressed by content hash.
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { validName } from '../src/multiplayer/protocol.js';
import { pngSize, SKIN_WIDTH, SKIN_HEIGHT, MAX_SKIN_BYTES } from '../src/skin.js';

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
// OWASP's 16 MiB scrypt configuration for the public profile service; legacy dedicated accounts keep their old KDF.
export const PROFILE_SCRYPT = Object.freeze({ ...SCRYPT, p: 5 });
export const SESSION_MS = 30 * 24 * 3600 * 1000, INVITE_MS = 7 * 24 * 3600 * 1000;
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I
const sha = value => createHash('sha256').update(value).digest('hex');
const scrypt = (password, salt, params = SCRYPT) => new Promise((resolve, reject) =>
  scryptCallback(password.normalize('NFKC'), salt, 32, params, (error, key) => error ? reject(error) : resolve(key)));
export const validPassword = p => typeof p === 'string' && p.length >= 8 && p.length <= 128;
export const normalEmail = email => typeof email === 'string' ? email.trim().toLowerCase() : '';
export const validEmail = email => typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
export const normalInvite = code => typeof code === 'string' ? code.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';

export class AccountError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export class AccountStore {
  constructor(data = {}, { file = null, now = () => Date.now(), openRegistration = false, requireEmail = false, passwordParams = SCRYPT } = {}) {
    if (data.version !== undefined && data.version !== 1) throw new Error('Unsupported accounts file version');
    this.file = file; this.now = now;
    this.openRegistration = openRegistration; this.requireEmail = requireEmail;
    this.passwordParams = { ...passwordParams };
    this.accounts = new Map((data.accounts ?? []).map(a => [a.id, a]));
    this.sessions = new Map((data.sessions ?? []).map(s => [s.hash, s]));
    this.invites = new Map((data.invites ?? []).map(i => [i.hash, i]));
    this.skins = new Map();
    for (const a of this.accounts.values()) if (a.skin) this.skins.set(a.skinHash, Buffer.from(a.skin, 'base64'));
    this.failures = new Map(); // lower-case name → [timestamps], not saved
    this.attempts = []; // every login/register attempt in the last minute
    this.saving = Promise.resolve();
  }
  static async open(file, options = {}) {
    let data = {};
    try { data = JSON.parse(await readFile(file, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    return new AccountStore(data, { ...options, file });
  }
  serialize() {
    const now = this.now();
    return { version: 1, accounts: [...this.accounts.values()],
      sessions: [...this.sessions.values()].filter(s => s.expires > now), invites: [...this.invites.values()].filter(i => i.expires > now) };
  }
  save() {
    if (!this.file) return Promise.resolve();
    const data = JSON.stringify(this.serialize()), file = this.file;
    this.saving = this.saving.catch(() => {}).then(async () => {
      await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
      await writeFile(file + '.tmp', data, { mode: 0o600 });
      await rename(file + '.tmp', file);
    });
    return this.saving;
  }
  byName(name) {
    const lower = String(name).toLowerCase();
    for (const a of this.accounts.values()) if (a.name.toLowerCase() === lower) return a;
    return null;
  }
  public(a) { return { id: a.id, name: a.name, admin: !!a.admin, skin: a.skinHash ?? null }; }
  self(a) { return { ...this.public(a), email: a.email ?? '' }; }
  byEmail(email) {
    const key = normalEmail(email);
    if (!key) return null;
    for (const a of this.accounts.values()) if (normalEmail(a.email) === key) return a;
    return null;
  }
  // Shared limit on password checks (every client arrives from Serve as
  // 127.0.0.1) plus a per-name lockout after repeated failures.
  throttle(name) {
    const now = this.now();
    this.attempts = this.attempts.filter(t => now - t < 60000);
    if (this.attempts.length >= 30) throw new AccountError(429, 'Too many sign-in attempts. Wait a minute and try again.');
    this.attempts.push(now);
    const fails = (this.failures.get(String(name).toLowerCase()) ?? []).filter(t => now - t < 300000);
    if (fails.length >= 5) throw new AccountError(429, 'Too many wrong passwords for that name. Wait five minutes.');
  }
  fail(name) {
    const key = String(name).toLowerCase();
    this.failures.set(key, [...(this.failures.get(key) ?? []), this.now()]);
  }
  newSession(account) {
    const token = randomBytes(32).toString('base64url');
    this.sessions.set(sha(token), { hash: sha(token), account: account.id, expires: this.now() + SESSION_MS });
    return token;
  }
  // `serverKey`: the owner's private MC_WEB_TOKEN. Using it as the invite makes
  // an admin account, which is how the first account is created.
  async register({ invite, name, email, password }, serverKey) {
    this.throttle(name);
    if (!validName(name)) throw new AccountError(400, 'Names are 1–16 letters, numbers or underscores.');
    if (!validPassword(password)) throw new AccountError(400, 'Passwords are 8–128 characters.');
    email = normalEmail(email);
    if ((this.requireEmail || email) && !validEmail(email)) throw new AccountError(400, 'Enter a valid email address.');
    if (email && this.byEmail(email)) throw new AccountError(409, 'That email address is already registered.');
    const admin = typeof invite === 'string' && typeof serverKey === 'string' && Buffer.byteLength(invite) === Buffer.byteLength(serverKey) &&
      timingSafeEqual(Buffer.from(invite), Buffer.from(serverKey));
    const inviteHash = admin ? null : sha(normalInvite(invite)), record = inviteHash && this.invites.get(inviteHash);
    if (!this.openRegistration && !admin && (!record || record.expires <= this.now())) throw new AccountError(403, 'That invite code is wrong, used or expired.');
    if (this.byName(name)) throw new AccountError(409, 'That name is taken.');
    const salt = randomBytes(16);
    const account = { id: randomUUID(), name, salt: salt.toString('base64'), hash: (await scrypt(password, salt, this.passwordParams)).toString('base64'), passwordParams: { ...this.passwordParams },
      admin, createdAt: this.now(), invitedBy: admin || this.openRegistration ? null : record.createdBy, skin: null, skinHash: null,
      ...(email ? { email } : {}) };
    // Re-check after the asynchronous hash: two registrations may race.
    if (this.byName(name)) throw new AccountError(409, 'That name is taken.');
    if (email && this.byEmail(email)) throw new AccountError(409, 'That email address is already registered.');
    if (!this.openRegistration && !admin) { if (!this.invites.has(inviteHash)) throw new AccountError(403, 'That invite code is wrong, used or expired.'); this.invites.delete(inviteHash); }
    this.accounts.set(account.id, account);
    const session = this.newSession(account);
    await this.save();
    return { session, account: this.public(account) };
  }
  async login({ name, password }) {
    const account = typeof name === 'string' ? this.byName(name) ?? this.byEmail(name) : null;
    const identity = account?.name ?? name;
    this.throttle(identity);
    // Hash even for an unknown name so timing does not reveal which names exist.
    const salt = account ? Buffer.from(account.salt, 'base64') : randomBytes(16);
    const params = account ? account.passwordParams ?? SCRYPT : this.passwordParams;
    const allowed = validPassword(password), key = await scrypt(allowed ? password : '', salt, params);
    if (!allowed || !account || !timingSafeEqual(key, Buffer.from(account.hash, 'base64'))) {
      this.fail(identity); throw new AccountError(401, 'Wrong name or password.');
    }
    if (this.passwordParams.N * this.passwordParams.r * this.passwordParams.p > params.N * params.r * params.p) {
      const upgradedSalt = randomBytes(16);
      account.hash = (await scrypt(password, upgradedSalt, this.passwordParams)).toString('base64');
      account.salt = upgradedSalt.toString('base64'); account.passwordParams = { ...this.passwordParams };
    }
    const session = this.newSession(account);
    await this.save();
    return { session, account: this.public(account) };
  }
  authenticate(token) {
    if (typeof token !== 'string' || token.length > 100) return null;
    const s = this.sessions.get(sha(token));
    if (!s || s.expires <= this.now()) return null;
    return this.accounts.get(s.account) ?? null;
  }
  async logout(token) { if (typeof token === 'string' && this.sessions.delete(sha(token))) await this.save(); }
  async createInvite(createdBy) {
    const bytes = randomBytes(10);
    const code = [...bytes].map(b => INVITE_ALPHABET[b % INVITE_ALPHABET.length]).join('');
    const pretty = code.slice(0, 5) + '-' + code.slice(5);
    this.invites.set(sha(code), { hash: sha(code), createdBy, expires: this.now() + INVITE_MS });
    await this.save();
    return { code: pretty, expires: this.now() + INVITE_MS };
  }
  async rename(account, name) {
    if (!validName(name)) throw new AccountError(400, 'Names are 1–16 letters, numbers or underscores.');
    const other = this.byName(name);
    if (other && other.id !== account.id) throw new AccountError(409, 'That name is taken.');
    account.name = name; await this.save();
    return this.public(account);
  }
  async setSkin(account, png) {
    if (!Buffer.isBuffer(png) || png.length > MAX_SKIN_BYTES) throw new AccountError(413, 'Skins must be at most 16 KB.');
    const size = pngSize(png);
    if (!size || size.width !== SKIN_WIDTH || size.height !== SKIN_HEIGHT) throw new AccountError(400, 'Upload a 64 × 32 PNG skin.');
    const hash = sha(png).slice(0, 20);
    this.dropSkin(account);
    account.skin = png.toString('base64'); account.skinHash = hash; this.skins.set(hash, png);
    await this.save();
    return this.public(account);
  }
  async clearSkin(account) { this.dropSkin(account); account.skin = account.skinHash = null; await this.save(); return this.public(account); }
  dropSkin(account) {
    if (account.skinHash && ![...this.accounts.values()].some(a => a !== account && a.skinHash === account.skinHash)) this.skins.delete(account.skinHash);
  }
}
