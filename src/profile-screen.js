import { validName } from './multiplayer/protocol.js';

// Required sign-in for this build, separate from the still-paused multiplayer connection screen.
export function accountScreen({ session, back, done = back }) {
  let mode = 'login', busy = false, error = '', name = '', email = '', password = '', completed = false;
  let submitAction = () => {};
  const complete = () => { if (!completed) { completed = true; password = ''; done(); } };
  const screen = {
    id: 'account-sign-in', escape: () => { if (!busy) back(); },
    key: e => { if (e.code === 'Enter' || e.code === 'NumpadEnter') { void submitAction(); return true; } return false; },
    init(g, w, h) {
      if (session.authenticated) { complete(); return; }
      const x = Math.floor(w / 2) - 150, top = Math.max(60, Math.floor(h / 2) - 60);
      g.text('Your Account', w / 2, 12, { center: true });
      g.text('Sign in to play with your username and skin.', w / 2, 26, { center: true, color: 0xaaaaaa });
      for (const [i, [key, label]] of [['login', 'Sign In'], ['register', 'Create Account']].entries())
        g.button({ x: x + i * 152, y: top - 26, w: 148, h: 20 }, label, () => { mode = key; error = ''; password = ''; g.build(); }, { enabled: !busy && mode !== key });
      const fields = mode === 'register' ? [['Username', name, 16, v => { name = v; }], ['Email', email, 254, v => { email = v; }], ['Password', password, 128, v => { password = v; }]]
        : [['Username or email', name, 254, v => { name = v; }], ['Password', password, 128, v => { password = v; }]];
      fields.forEach(([label, value, maxLength, input], i) => {
        const y = top + i * 32;
        g.text(label, x, y, { color: 0xaaaaaa });
        const field = g.field({ x, y: y + 10, w: 300, h: 16 }, { label, value, maxLength, input, secret: label === 'Password', enabled: !busy });
        if (field.el) {
          field.el.autocomplete = label === 'Password' ? mode === 'register' ? 'new-password' : 'current-password' : label === 'Email' ? 'email' : 'username';
          if (label === 'Email') field.el.inputMode = 'email';
        }
      });
      const message = error || session.error || (busy ? 'Contacting the account service…' : mode === 'register' ? 'Password: 8–128 characters. Use your email or name to sign in.' : 'An account is required to enter your worlds.');
      const lines = message.match(/.{1,48}(?:\s|$)|.{1,48}/g) ?? [];
      lines.slice(0, 2).forEach((line, i) => g.text(line.trim(), w / 2, top + 100 + i * 10, { center: true, color: error || session.error ? 0xff7777 : 0xaaaaaa }));
      const submit = async () => {
        if (busy) return;
        if (mode === 'register' && !validName(name.trim())) { error = 'Usernames use 1–16 letters, numbers or underscores.'; g.build(); return; }
        if (password.length < 8) { error = 'Passwords must have at least 8 characters.'; g.build(); return; }
        if (!name.trim()) { error = 'Enter your username or email.'; g.build(); return; }
        busy = true; error = ''; g.build();
        try {
          if (mode === 'register') await session.register(name.trim(), email.trim(), password);
          else await session.signIn(name.trim(), password);
          complete();
        } catch (e) { error = e.message; password = ''; }
        finally { busy = false; g.build(); }
      };
      submitAction = submit;
      g.button({ x, y: top + 128, w: 148, h: 20 }, busy ? 'Please wait…' : mode === 'register' ? 'Register' : 'Sign In', submit, { enabled: !busy });
      g.button({ x: x + 152, y: top + 128, w: 148, h: 20 }, 'Back', back, { enabled: !busy });
    },
  };
  return screen;
}
