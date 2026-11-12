// /scoreboard as 1.7.10 CommandScoreboard (bk): objectives list/add/remove/setdisplay, players list/set/add/remove/reset and teams
// list/add/remove/empty/join/leave/option (color, friendlyfire, seeFriendlyInvisibles; 1.7.10 has no nametagVisibility, no
// players enable/test/operation and no dataTag). Argument counts, check order, exception classes (WrongUsage messages are wrapped
// in "Usage: ...") and message arguments follow the bytecode and are replayed from public/research/scoreboard-reference.json.
import { translation } from "./chat-component.js";
import { JavaHashSet } from "./java-hash.js";
import { Scoreboard, slotIndex, SLOT_NAMES, isCriteria, criteriaNames, isReadOnly } from "./scoreboard.js";

// CommandBase.joinNiceString: "a", "a and b", "a, b and c".
export const joinNiceString = (items) => items.map(String).reduce((s, v, i, a) => (i === 0 ? v : s + (i === a.length - 1 ? " and " : ", ") + v), "");

// EnumChatFormatting in declaration order: [name, code, fancy].
const FORMATS = [["BLACK", "0"], ["DARK_BLUE", "1"], ["DARK_GREEN", "2"], ["DARK_AQUA", "3"], ["DARK_RED", "4"], ["DARK_PURPLE", "5"], ["GOLD", "6"], ["GRAY", "7"], ["DARK_GRAY", "8"], ["BLUE", "9"], ["GREEN", "a"], ["AQUA", "b"], ["RED", "c"], ["LIGHT_PURPLE", "d"], ["YELLOW", "e"], ["WHITE", "f"], ["OBFUSCATED", "k", true], ["BOLD", "l", true], ["STRIKETHROUGH", "m", true], ["UNDERLINE", "n", true], ["ITALIC", "o", true], ["RESET", "r"]];
// EnumChatFormatting.getValueByName: the lower-cased input against the lower-case names ("Dark_Red" works, "darkred" does not).
export function formattingByName(name) { const f = FORMATS.find(([n]) => n.toLowerCase() === String(name).toLowerCase()); return f ? { name: f[0].toLowerCase(), code: "§" + f[1], fancy: !!f[2] } : null; }
// getValidValues(true, false): the colours and reset (fancy styles excluded), as friendly (lower-case) names.
export const COLOR_VALUES = Object.freeze(FORMATS.filter((f) => !f[2]).map(([n]) => n.toLowerCase()));
const TEAM_OPTIONS = ["color", "friendlyfire", "seeFriendlyInvisibles"];
const eq = (a, b) => a.toLowerCase() === b.toLowerCase();

export function createScoreboardCommands(ctx) {
  const { host, usage, CommandException, parseInt32, parseIntMin, selectPlayer, tr } = ctx;
  let own = null; // a host without a scoreboard (tests, previews) gets a private one
  const board = () => host.scoreboard ?? (own ??= new Scoreboard());
  const fail = (key, ...args) => { throw new CommandException(key, args); };
  const usageWith = (key, ...args) => { throw new CommandException(key, args, "usage"); };
  // ICommandSender.addChatMessage (the sender's own lines; headers DARK_GREEN) and CommandBase.func_152373_a (notifyAdmins).
  const tell = (text) => host.print(text);
  const header = (key, ...args) => tell("§2" + tr(key, ...args));
  const notify = (key, ...args) => { (host.feedback ?? host.print)(tr(key, ...args), translation(key, ...args)); host.changed?.(); };
  const isPlayerSender = () => !host.isCommandBlock;
  const senderName = () => host.playerName ?? host.name ?? "Player";
  // CommandBase.func_96332_d: a selector must match a player; any other text is taken as the score holder's name as typed.
  const holder = (s) => {
    if (s.startsWith("@")) { const p = selectPlayer(s); if (p) return p; throw new CommandException("commands.generic.player.notFound", [], "player"); }
    return s;
  };
  // getObjective / getTeam (bk.a(String, boolean) / bk.a(String)).
  const objective = (name, write) => {
    const o = board().objective(name);
    if (!o) fail("commands.scoreboard.objectiveNotFound", name);
    if (write && isReadOnly(o.criteria)) fail("commands.scoreboard.objectiveReadOnly", name);
    return o;
  };
  const team = (name) => { const t = board().team(name); if (!t) fail("commands.scoreboard.teamNotFound", name); return t; };
  const rest = (a, i) => a.slice(i).join(" "); // func_147178_a without selectors: the words joined by spaces

  const objectives = {
    list() {
      const list = board().objectiveList();
      if (!list.length) fail("commands.scoreboard.objectives.list.empty");
      header("commands.scoreboard.objectives.list.count", list.length);
      for (const o of list) tell(tr("commands.scoreboard.objectives.list.entry", o.name, o.displayName, o.criteria));
    },
    add(a) {
      const name = a[2], criteria = a[3];
      if (!isCriteria(criteria)) usageWith("commands.scoreboard.objectives.add.wrongType", criteria);
      if (board().objective(name)) fail("commands.scoreboard.objectives.add.alreadyExists", name);
      if (name.length > 16) fail("commands.scoreboard.objectives.add.tooLong", name, 16);
      if (!name.length) usage("commands.scoreboard.objectives.add.usage");
      let display = null;
      if (a.length > 4) {
        display = rest(a, 4);
        if (display.length > 32) fail("commands.scoreboard.objectives.add.displayTooLong", display, 32);
      }
      const o = board().addObjective(name, criteria);
      if (display) board().setDisplayName(o, display);
      notify("commands.scoreboard.objectives.add.success", name);
    },
    remove(a) {
      const o = objective(a[2], false);
      board().removeObjective(o);
      notify("commands.scoreboard.objectives.remove.success", a[2]);
    },
    setdisplay(a) {
      const slotArg = a[2], o = a.length === 4 ? objective(a[3], false) : null, slot = slotIndex(slotArg);
      if (slot < 0) fail("commands.scoreboard.objectives.setdisplay.invalidSlot", slotArg);
      board().setSlot(slot, o);
      if (o) notify("commands.scoreboard.objectives.setdisplay.successSet", SLOT_NAMES[slot], o.name);
      else notify("commands.scoreboard.objectives.setdisplay.successCleared", SLOT_NAMES[slot]);
    },
  };

  const players = {
    list(a) {
      if (a.length > 2) {
        const p = holder(a[2]), scores = board().playerScores(p);
        if (!scores.length) fail("commands.scoreboard.players.list.player.empty", p);
        header("commands.scoreboard.players.list.player.count", scores.length, p);
        for (const s of scores) tell(tr("commands.scoreboard.players.list.player.entry", s.value, s.objective.displayName, s.objective.name));
      } else {
        const names = board().playerNames();
        if (!names.length) fail("commands.scoreboard.players.list.empty");
        header("commands.scoreboard.players.list.count", names.length);
        tell(joinNiceString(names));
      }
    },
    // set / add / remove: the name, then the objective (writable), then the number; always reported as players.set.success.
    change(a, op) {
      const p = holder(a[2]), o = objective(a[3], true);
      const n = op === "set" ? parseInt32(a[4]) : parseIntMin(a[4], 1);
      const b = board(), s = op === "set" ? b.setScore(p, o, n) : b.addScore(p, o, op === "add" ? n : -n);
      notify("commands.scoreboard.players.set.success", o.name, p, s.value);
    },
    reset(a) {
      const p = holder(a[2]);
      board().resetPlayer(p);
      notify("commands.scoreboard.players.reset.success", p);
    },
  };

  const teams = {
    list(a) {
      if (a.length > 2) {
        const t = team(a[2]), members = [...t.members];
        if (!members.length) fail("commands.scoreboard.teams.list.player.empty", t.name);
        header("commands.scoreboard.teams.list.player.count", members.length, t.name);
        tell(joinNiceString(members));
      } else {
        const list = board().teamList();
        if (!list.length) fail("commands.scoreboard.teams.list.empty");
        header("commands.scoreboard.teams.list.count", list.length);
        for (const t of list) tell(tr("commands.scoreboard.teams.list.entry", t.name, t.displayName, t.members.size));
      }
    },
    add(a) {
      const name = a[2];
      if (board().team(name)) fail("commands.scoreboard.teams.add.alreadyExists", name);
      if (name.length > 16) fail("commands.scoreboard.teams.add.tooLong", name, 16);
      if (!name.length) usage("commands.scoreboard.teams.add.usage");
      let display = null;
      if (a.length > 3) {
        display = rest(a, 3);
        if (display.length > 32) fail("commands.scoreboard.teams.add.displayTooLong", display, 32);
      }
      const t = board().createTeam(name);
      if (display) board().setTeam(t, { displayName: display });
      notify("commands.scoreboard.teams.add.success", name);
    },
    remove(a) {
      const t = team(a[2]);
      board().removeTeam(t);
      notify("commands.scoreboard.teams.remove.success", t.name);
    },
    empty(a) {
      const t = team(a[2]), members = [...t.members];
      if (!members.length) fail("commands.scoreboard.teams.empty.alreadyEmpty", t.name);
      for (const p of members) board().leaveTeam(p);
      notify("commands.scoreboard.teams.empty.success", members.length, t.name);
    },
    // join: the team name is not checked up front; Scoreboard.func_151392_a fails only for a missing team.
    join(a) {
      const name = a[2], ok = new JavaHashSet(), bad = new JavaHashSet(), b = board();
      if (isPlayerSender() && a.length === 3) (b.joinTeam(senderName(), name) ? ok : bad).add(senderName());
      else for (const arg of a.slice(3)) { const p = holder(arg); (b.joinTeam(p, name) ? ok : bad).add(p); }
      if (ok.size) notify("commands.scoreboard.teams.join.success", ok.size, name, joinNiceString(order(ok)));
      if (bad.size) fail("commands.scoreboard.teams.join.failure", bad.size, name, joinNiceString(order(bad)));
    },
    leave(a) {
      const ok = new JavaHashSet(), bad = new JavaHashSet(), b = board();
      if (isPlayerSender() && a.length === 2) (b.leaveTeam(senderName()) ? ok : bad).add(senderName());
      else for (const arg of a.slice(2)) { const p = holder(arg); (b.leaveTeam(p) ? ok : bad).add(p); }
      if (ok.size) notify("commands.scoreboard.teams.leave.success", ok.size, joinNiceString(order(ok)));
      if (bad.size) fail("commands.scoreboard.teams.leave.failure", bad.size, joinNiceString(order(bad)));
    },
    option(a) {
      const t = team(a[2]), option = a[3].toLowerCase(); // the messages show the option lower-cased
      if (!TEAM_OPTIONS.some((o) => eq(o, option))) usage("commands.scoreboard.teams.option.usage");
      if (a.length === 4) {
        if (eq(option, "color")) usageWith("commands.scoreboard.teams.option.noValue", option, joinNiceString(COLOR_VALUES));
        usageWith("commands.scoreboard.teams.option.noValue", option, joinNiceString(["true", "false"]));
      }
      const value = a[4];
      if (eq(option, "color")) {
        const f = formattingByName(value);
        if (!f || f.fancy) usageWith("commands.scoreboard.teams.option.noValue", option, joinNiceString(COLOR_VALUES));
        board().setTeam(t, { prefix: f.code, suffix: "§r" });
      } else {
        if (!eq(value, "true") && !eq(value, "false")) usageWith("commands.scoreboard.teams.option.noValue", option, joinNiceString(["true", "false"]));
        board().setTeam(t, eq(option, "friendlyfire") ? { friendlyFire: eq(value, "true") } : { seeFriendlyInvisibles: eq(value, "true") });
      }
      notify("commands.scoreboard.teams.option.success", option, t.name, value);
    },
  };
  // The success/failure name sets are HashSets: joinNiceString lists them in HashSet order.
  const order = (set) => [...set];

  function scoreboard(a) {
    if (a.length >= 1) {
      const sub = a[0];
      if (eq(sub, "objectives")) {
        if (a.length === 1) usage("commands.scoreboard.objectives.usage");
        const v = a[1];
        if (eq(v, "list")) return objectives.list();
        if (eq(v, "add")) { if (a.length >= 4) return objectives.add(a); usage("commands.scoreboard.objectives.add.usage"); }
        if (eq(v, "remove")) { if (a.length === 3) return objectives.remove(a); usage("commands.scoreboard.objectives.remove.usage"); }
        if (eq(v, "setdisplay")) { if (a.length === 3 || a.length === 4) return objectives.setdisplay(a); usage("commands.scoreboard.objectives.setdisplay.usage"); }
        usage("commands.scoreboard.objectives.usage");
      }
      if (eq(sub, "players")) {
        if (a.length === 1) usage("commands.scoreboard.players.usage");
        const v = a[1];
        if (eq(v, "list")) { if (a.length <= 3) return players.list(a); usage("commands.scoreboard.players.list.usage"); }
        for (const op of ["add", "remove", "set"]) if (eq(v, op)) { if (a.length === 5) return players.change(a, op); usage(`commands.scoreboard.players.${op}.usage`); }
        if (eq(v, "reset")) { if (a.length === 3) return players.reset(a); usage("commands.scoreboard.players.reset.usage"); }
        usage("commands.scoreboard.players.usage");
      }
      if (eq(sub, "teams")) {
        if (a.length === 1) usage("commands.scoreboard.teams.usage");
        const v = a[1];
        if (eq(v, "list")) { if (a.length <= 3) return teams.list(a); usage("commands.scoreboard.teams.list.usage"); }
        if (eq(v, "add")) { if (a.length >= 3) return teams.add(a); usage("commands.scoreboard.teams.add.usage"); }
        if (eq(v, "remove")) { if (a.length === 3) return teams.remove(a); usage("commands.scoreboard.teams.remove.usage"); }
        if (eq(v, "empty")) { if (a.length === 3) return teams.empty(a); usage("commands.scoreboard.teams.empty.usage"); }
        if (eq(v, "join")) { if (a.length >= 4 || (a.length === 3 && isPlayerSender())) return teams.join(a); usage("commands.scoreboard.teams.join.usage"); }
        if (eq(v, "leave")) { if (a.length >= 3 || isPlayerSender()) return teams.leave(a); usage("commands.scoreboard.teams.leave.usage"); }
        if (eq(v, "option")) { if (a.length === 4 || a.length === 5) return teams.option(a); usage("commands.scoreboard.teams.option.usage"); }
        usage("commands.scoreboard.teams.usage");
      }
    }
    usage("commands.scoreboard.usage");
  }

  // CommandScoreboard.addTabCompletionOptions (index = position of the word being completed, 0-based after "scoreboard").
  function complete(index, a, playerNames) {
    const b = board(), sub = (a[0] ?? "").toLowerCase(), v = (a[1] ?? "").toLowerCase();
    if (index === 0) return ["objectives", "players", "teams"];
    if (sub === "objectives") {
      if (index === 1) return ["list", "add", "remove", "setdisplay"];
      if (v === "add" && index === 3) return criteriaNames();
      if (v === "remove" && index === 2) return b.objectiveList().map((o) => o.name);
      if (v === "setdisplay" && index === 2) return SLOT_NAMES.slice();
      if (v === "setdisplay" && index === 3) return b.objectiveList().map((o) => o.name);
    } else if (sub === "players") {
      if (index === 1) return ["set", "add", "remove", "reset", "list"];
      if (["set", "add", "remove"].includes(v)) {
        if (index === 2) return playerNames;
        if (index === 3) return b.objectiveList().filter((o) => !isReadOnly(o.criteria)).map((o) => o.name);
      } else if ((v === "reset" || v === "list") && index === 2) return b.playerNames();
    } else if (sub === "teams") {
      if (index === 1) return ["add", "remove", "join", "leave", "empty", "list", "option"];
      if (v === "join") { if (index === 2) return b.teamNames(); if (index >= 3) return playerNames; }
      else if (v === "leave") return playerNames;
      else if ((v === "empty" || v === "list" || v === "remove") && index === 2) return b.teamNames();
      else if (v === "option") {
        if (index === 2) return b.teamNames();
        if (index === 3) return TEAM_OPTIONS.slice();
        if (index === 4) return eq(a[3] ?? "", "color") ? COLOR_VALUES.slice() : eq(a[3] ?? "", "friendlyfire") || eq(a[3] ?? "", "seeFriendlyInvisibles") ? ["true", "false"] : [];
      }
    }
    return [];
  }
  return { handlers: { scoreboard }, complete: (name, index, a, playerNames) => complete(index, a, playerNames) };
}
