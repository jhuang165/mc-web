// b51ct. Builds the command texts of CommandHelp, CommandBase.getItemByText / getBlockByText, CommandBase.notifyAdmins (chat.type.admin) and
// CommandGameRule from the unchanged 1.7.10 ChatComponentTranslation [fr], ChatComponentText [fq] and ChatStyle [fn], and records their
// IChatComponent.Serializer [fk] JSON. The command classes themselves are server-only (the jar is the client jar), so the component trees
// (key, arguments, style) are the ones those methods build, written from the 1.7.10 sources. Colours: c DARK_GREEN, k GREEN, h GRAY.
// tools/verify-cmd-texts.mjs writes public/research/cmd-texts-reference.json; src/cmd-texts-b51.test.js replays it.
public class CmdTextsProbe {
  static String json(String s) {
    StringBuilder b = new StringBuilder("\"");
    for (char c : s.toCharArray()) {
      if (c == '"' || c == '\\') b.append('\\').append(c);
      else if (c < 32 || c > 126) b.append(String.format("\\u%04x", (int) c));
      else b.append(c);
    }
    return b.append('"').toString();
  }
  static String row(String name, fj c) { return "[" + json(name) + "," + json(fk.a(c)) + "]"; }
  static fj styled(fj c, a color) { c.b().a(color); return c; }
  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    fj inner = new fr("commands.give.success", "Stone", 5, "Player");
    fr admin = new fr("chat.type.admin", "@", inner);
    admin.b().a(a.h).b(true);
    fj tpInner = new fr("commands.tp.success.coordinates", "Player", 1.5, 64.0, -3.0);
    fr admin2 = new fr("chat.type.admin", "Rcon", tpInner);
    admin2.b().a(a.h).b(true);
    fj[] comps = {
      styled(new fr("commands.help.header", 1, 5), a.c),
      styled(new fr("commands.help.header", 2, 5), a.c),
      new fr("commands.achievement.usage"),
      styled(new fr("commands.help.footer"), a.k),
      styled(new fr("commands.generic.deprecatedId", "minecraft:stone"), a.h),
      styled(new fr("commands.generic.deprecatedId", "minecraft:iron_pickaxe"), a.h),
      admin, admin2,
      new fq("doFireTick = true"),
      new fq("commandBlockOutput, doDaylightCycle, doFireTick, doMobLoot, doMobSpawning, doTileDrops, keepInventory, mobGriefing, naturalRegeneration"),
    };
    String[] names = {"helpHeader1", "helpHeader2", "helpLine", "helpFooter", "deprecatedItem", "deprecatedItem2", "adminGive", "adminTp", "gameruleQuery", "gameruleList"};
    StringBuilder o = new StringBuilder();
    for (int i = 0; i < comps.length; i++) o.append(i > 0 ? "," : "").append(row(names[i], comps[i]));
    System.out.println("{\"name\":\"texts\",\"rows\":[" + o + "]}");
  }
}
