// Drives tools/probes/CommandProbe.java against the unchanged 1.7.10 client JAR: every command ServerCommandManager registers
// (name, aliases, required permission level, usage key), CommandBase's static argument parsers, the item/block/entity/potion/
// enchantment/game-rule registries and the en_US.lang strings the commands print. Also extracts, from javap bytecode, the
// registration groups of ServerCommandManager, the single-player permission rule (EntityPlayerMP.canCommandSenderUseCommand,
// IntegratedServer.getOpPermissionLevel), CommandHelp's page size and colours, and the GuiNewChat/GuiChat constants.
// Writes public/research/commands-reference.json (replayed by src/commands.test.js and src/chat.test.js) and the generated
// src/command-data.js. Needs a JDK, the pinned client JAR (tools/research or MC_RESEARCH) and guava / log4j-api / commons-lang3 /
// netty-all / gson / commons-io JARs (MC_PROBE_LIBS lists extra directories' JARs).
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, access, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const exec = promisify(execFile),
  root = path.dirname(fileURLToPath(import.meta.url)),
  exists = (p) => access(p).then(() => true, () => false);
const researchDirs = [process.env.MC_RESEARCH, path.join(root, "research"), path.join(root, "../../tools/research")].filter(Boolean);
let research;
for (const dir of researchDirs) if (await exists(path.join(dir, "minecraft-1.7.10.jar"))) { research = dir; break; }
if (!research) throw new Error("Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.");
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "command-probe"), clientSha1 = "e80d9b3bf5085002218d4be59e668bac718abbc6";
assert.equal(createHash("sha1").update(await readFile(jar)).digest("hex"), clientSha1);
async function library(prefix) {
  for (const p of (process.env.MC_PROBE_LIBS || "").split(path.delimiter).filter(Boolean)) if (path.basename(p).startsWith(prefix)) return p;
  for (const dir of [path.join(os.homedir(), "Library/Application Support/minecraft/libraries"), path.join(os.homedir(), ".minecraft/libraries"), path.join(os.homedir(), ".gradle/caches")]) {
    if (!(await exists(dir))) continue;
    const { stdout } = await exec("find", [dir, "-name", prefix + "*.jar", "-not", "-name", "*sources*"], { maxBuffer: 1 << 24 });
    const hit = stdout.split("\n").filter(Boolean).sort().reverse().find((p) => !/\b(sources|javadoc)\b/.test(p));
    if (hit) return hit;
  }
  throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs = await Promise.all(["guava-", "log4j-api-", "commons-lang3-", "netty-all-", "gson-", "commons-io-"].map(library));
const classes = path.join(out, "classes"), probe = path.join(out, "probe");
await rm(out, { recursive: true, force: true });
await mkdir(classes, { recursive: true });
await mkdir(probe, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 });
const cp = [probe, classes, ...libs].join(path.delimiter);
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/CommandProbe.java")]);
const javap = async (cls) => (await exec("javap", ["-p", "-c", "-constants", "-cp", classes, cls], { maxBuffer: 1 << 27 })).stdout;

// ---- ServerCommandManager constructor: the registered classes and which branch registers them ----
const manager = await javap("bl");
const ctor = manager.split("\n  public void a(")[0];
const registered = [];
let group = "always";
for (const line of ctor.split("\n")) {
  if (/MinecraftServer\.X:\(\)Z/.test(line)) group = "dedicated";
  const m = /new\s+#\d+\s+\/\/ class (\w+)$/.exec(line.trim().replace(/^\d+:\s*/, ""));
  if (m) {
    if (m[1] === "bg") group = "lan";
    registered.push({ class: m[1], group });
  }
}
assert.equal(registered.length, 48, "48 command classes register in ServerCommandManager");
const always = registered.filter((r) => r.group === "always");
assert.equal(always.length, 31);
assert.equal(registered.filter((r) => r.group === "dedicated").length, 16);
assert.deepEqual(registered.filter((r) => r.group === "lan").map((r) => r.class), ["bg"]);

const { stdout } = await exec("java", ["-cp", cp, "CommandProbe", registered.map((r) => r.class).join(",")], { maxBuffer: 1 << 27 });
const lines = stdout.split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
const commands = lines.filter((l) => l.kind === "command").map(({ kind, ...c }) => ({ ...c, group: registered.find((r) => r.class === c.class).group }));
assert.equal(commands.length, 48);
for (const c of commands) assert.ok(c.name && !c.loadError, `command class ${c.class} did not load: ${c.loadError}`);
const parse = lines.filter((l) => l.kind === "parse").map(({ kind, ...p }) => p);
const section = (kind) => lines.find((l) => l.kind === kind).entries;
const registries = Object.fromEntries(lines.filter((l) => l.kind === "registry").map((l) => [l.registry, l.entries]));
const entities = section("entities"), potions = section("potions"), enchantments = section("enchantments"), gamerules = section("gamerules"), gametypes = section("gametypes");
assert.equal(gamerules.length, 9);
assert.equal(potions.length, 23);
for (const [id, , again] of potions) assert.equal(id, again, "Potion.id equals the array index");

// ---- single-player permission rule ----
const player = await javap("mw");
const permission = player.split("public boolean a(int, java.lang.String);")[1].split("\n  public ")[0];
for (const [word, marker] of [["seed", /ldc\s+#\d+\s+\/\/ String seed[\s\S]*?isDedicatedServer|ldc\s+#\d+\s+\/\/ String seed/], ["tell", /String tell/], ["help", /String help/], ["me", /String me\b/]]) assert.match(permission, marker, `${word} is special-cased`);
assert.match(permission, /MinecraftServer\.X:\(\)Z\n\s+\d+: ifne/, "seed is open when the server is not dedicated");
assert.match(permission, /Method oi\.g:\(Lcom\/mojang\/authlib\/GameProfile;\)Z/, "other commands need ServerConfigurationManager.func_152596_g (op)");
assert.match(permission, /Method MinecraftServer\.l:\(\)I|Method net\/minecraft\/server\/MinecraftServer\.l:\(\)I/, "the op level comes from MinecraftServer.func_110455_j");
assert.match(await javap("bsx"), /public int l\(\);\n\s+Code:\n\s+0: iconst_4\n\s+1: ireturn/, "IntegratedServer.getOpPermissionLevel is 4");
const config = await javap("oi");
const isOp = config.split("public boolean g(com.mojang.authlib.GameProfile);")[1].split("\n  public ")[0];
assert.match(isOp, /MinecraftServer\.N:\(\)Z[\s\S]*ays\.v:\(\)Z[\s\S]*equalsIgnoreCase/, "the owner is an op when the world allows commands");
// ---- CommandHandler / CommandHelp / notifyAdmins ----
const handler = await javap("z");
for (const key of ["commands.generic.permission", "commands.generic.usage", "commands.generic.exception"]) assert.ok(handler.includes(`String ${key}`), key);
assert.ok((handler.match(/Field a\.m:La;/g) || []).length >= 5, "every failure is coloured with EnumChatFormatting.RED (a.m)");
const help = await javap("au");
assert.match(help, /bipush\s+7\n/, "seven commands per help page");
assert.match(help, /commands\.help\.header[\s\S]*Field a\.c:La;/, "header is DARK_GREEN (a.c)");
assert.match(help, /commands\.help\.footer[\s\S]*Field a\.k:La;/, "footer is GREEN (a.k)");
assert.match(manager, /String commandBlockOutput/);
assert.match(manager, /String chat\.type\.admin/);
// ---- GuiNewChat / GuiChat ----
const newChat = await javap("bcc"), guiChat = await javap("bct");
assert.match(newChat, /public static int a\(float\);\n\s+Code:\n\s+0: sipush\s+320\n\s+3: istore_1\n\s+4: bipush\s+40/, "chat width 320 .. 40");
assert.match(newChat, /public static int b\(float\);\n\s+Code:\n\s+0: sipush\s+180\n\s+3: istore_1\n\s+4: bipush\s+20/, "chat height 180 .. 20");
assert.match(newChat, /public int i\(\);[\s\S]*?bipush\s+9\n\s+\d+: idiv/, "visible lines = height / 9");
assert.match(newChat, /sipush\s+200\n[\s\S]*?double 200\.0d[\s\S]*?double 10\.0d[\s\S]*?double 255\.0d/, "fade after 200 ticks, (10 * (1 - age/200)) squared, 255 alpha");
assert.match(newChat, /float 0\.9f[\s\S]*?float 0\.1f/, "opacity * 0.9 + 0.1");
assert.match(newChat, /float 20\.0f/, "translate (2, 20)");
assert.ok((newChat.match(/bipush\s+100\n/g) || []).length >= 2, "100 stored lines and 100 sent messages");
assert.match(guiChat, /bipush\s+100\n/, "input field max length 100");
assert.match(guiChat, /ldc\s+#\d+\s+\/\/ int -2147483648/, "input background Integer.MIN_VALUE");
assert.match(guiChat, /bipush\s+14\n/, "input box top height - 14");
for (const code of [15, 28, 156, 200, 208, 201, 209]) assert.match(guiChat, new RegExp(`\\b${code}\\n`), `GuiChat.keyTyped handles key ${code}`);
const settings = await javap("bbj");
const defaults = {};
for (const [field, label] of [["C", "chatScale"], ["D", "chatWidth"], ["E", "chatHeightUnfocused"], ["F", "chatHeightFocused"], ["q", "chatOpacity"]]) {
  const m = new RegExp(`(?:fconst_(\\d)|ldc\\s+#\\d+\\s+// float ([\\d.]+)f)\\n\\s+\\d+: putfield\\s+#\\d+\\s+// Field ${field}:F`).exec(settings);
  assert.ok(m, `default of ${label}`);
  defaults[label] = Number(m[1] ?? m[2]);
}
assert.deepEqual(defaults, { chatScale: 1, chatWidth: 1, chatHeightUnfocused: 0.44366196, chatHeightFocused: 1, chatOpacity: 1 });
const f = Math.fround;
const chatWidth = (v) => Math.floor(f(f(v * 280) + 40)), chatHeight = (v) => Math.floor(f(f(v * 160) + 20));
const chat = {
  maxLines: 100, maxSent: 100, lineHeight: 9, fadeTicks: 200, inputMaxLength: 100, translate: [2, 20],
  defaults, width: chatWidth(defaults.chatWidth), heightFocused: chatHeight(defaults.chatHeightFocused), heightUnfocused: chatHeight(defaults.chatHeightUnfocused),
  keys: { tab: 15, enter: 28, numpadEnter: 156, up: 200, down: 208, pageUp: 201, pageDown: 209 },
  inputBackground: "0x80000000 (Integer.MIN_VALUE) from (2, height - 14) to (width - 2, height - 2); text 0xE0E0E0 at (4, height - 12)",
};
assert.equal(chat.width, 320);
assert.equal(chat.heightFocused, 180);
assert.equal(chat.heightUnfocused, 90);

// ---- en_US.lang ----
const lang = (await exec("unzip", ["-p", jar, "assets/minecraft/lang/en_US.lang"], { maxBuffer: 1 << 24 })).stdout;
const strings = {};
for (const line of lang.split("\n")) {
  const m = /^([\w.\-]+)=(.*)$/.exec(line.replace(/\r$/, ""));
  if (m && /^(commands\.|chat\.type\.|gameMode\.|potion\.|enchantment\.|death\.|multiplayer\.player\.joined|selectWorld\.allowCommands|gui\.done)/.test(m[1])) strings[m[1]] = m[2];
}
assert.equal(strings["commands.generic.permission"], "You do not have permission to use this command");
assert.equal(strings["commands.time.set"], "Set the time to %d");
for (const c of commands) assert.ok(strings[c.usage], `lang has ${c.usage}`);

const digest = async (name) => createHash("sha256").update((await exec("unzip", ["-p", jar, name + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const names = { bl: "ServerCommandManager", z: "CommandHandler", y: "CommandBase", au: "CommandHelp", mw: "EntityPlayerMP", bsx: "IntegratedServer", oi: "ServerConfigurationManager", bcc: "GuiNewChat", bct: "GuiChat", bbj: "GameSettings" };
const reference = {
  target: "Minecraft Java 1.7.10",
  clientSha1,
  classes: Object.fromEntries(await Promise.all(Object.keys(names).map(async (c) => [c, { name: names[c], sha256: await digest(c) }]))),
  method:
    "tools/probes/CommandProbe.java instantiates the 48 command classes ServerCommandManager's constructor registers (its class list and the dedicated/LAN branches are read from javap bytecode, since the constructor needs a MinecraftServer) and reads getCommandName, getCommandAliases, getRequiredPermissionLevel and getCommandUsage; drives CommandBase's static parsers with a proxy ICommandSender; dumps Item/Block registries, EntityList, Potion, Enchantment, GameRules and GameType. Permission rule, help paging and chat constants are asserted against javap bytecode.",
  commands,
  permissionRule: {
    singleplayer: "EntityPlayerMP.canCommandSenderUseCommand(level, name): 'seed' is always allowed when the server is not dedicated; 'tell', 'help' and 'me' are always allowed; everything else requires ServerConfigurationManager.func_152596_g (op): the world owner when WorldInfo.areCommandsAllowed (Allow Cheats), then IntegratedServer.getOpPermissionLevel() = 4 >= the command's level.",
    openToLan: "GuiShareToLan 'Allow Cheats' sets ServerConfigurationManager.commandsAllowedForAll (field s) for guests; the owner still needs the world's commandsAllowed flag.",
  },
  failureColour: "EnumChatFormatting.RED (a.m) for commands.generic.permission, .usage, .exception and every CommandException",
  help: { perPage: 7, header: "DARK_GREEN", footer: "GREEN", footerOnlyFirstPage: true },
  chat,
  parse,
  registries,
  entities,
  potions,
  enchantments,
  gamerules,
  gametypes,
  strings,
};
await writeFile(path.join(root, "../public/research/commands-reference.json"), JSON.stringify(reference) + "\n");

// ---- generated runtime data (the strings and registry names the browser command layer needs) ----
const keep = (re) => Object.fromEntries(Object.entries(strings).filter(([k]) => re.test(k)));
const data = `// Generated by tools/verify-commands.mjs from the unchanged 1.7.10 client JAR (CommandProbe.java). Do not edit by hand.
export const COMMAND_LIST = ${JSON.stringify(commands.map(({ name, aliases, permission, usage, group }) => ({ name, aliases, permission, usage, group })))};
export const LANG = ${JSON.stringify(strings)};
export const ITEM_REGISTRY = ${JSON.stringify(registries.item)};
export const BLOCK_REGISTRY = ${JSON.stringify(registries.block)};
export const ENTITY_NAMES = ${JSON.stringify(entities)};
export const POTION_NAMES = ${JSON.stringify(potions)};
export const ENCHANTMENT_NAMES = ${JSON.stringify(enchantments)};
export const GAME_RULES = ${JSON.stringify(gamerules)};
`;
await writeFile(path.join(root, "../src/command-data.js"), data);
console.log(`PASS: ${commands.length} commands (${always.length} always registered), ${parse.length} parser cases, ${registries.item.length} item names, ${registries.block.length} block names, ${entities.length} entities, ${Object.keys(strings).length} strings`);
