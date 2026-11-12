// b50cmdoutput. Records the unchanged CommandBlockLogic [agp] last output (addChatMessage agp.a(fj), the NBT LastOutput through
// fk.a(fj), the GUI text fj.c()) for plain, translated (ChatComponentTranslation fr, with args, nested usage), styled and TrackOutput=false
// outputs, and the loading of old-shape / invalid LastOutput strings. tools/verify-cmd-output.mjs writes
// public/research/cmd-output-reference.json; src/cmd-output-b50.test.js replays it.
public class CmdOutputProbe {
  static String json(String s) {
    if (s == null) return "null";
    StringBuilder b = new StringBuilder("\"");
    for (char c : s.toCharArray()) {
      if (c == '"' || c == '\\') b.append('\\').append(c);
      else if (c < 32 || c == 0x2028 || c == 0x2029) b.append(String.format("\\u%04x", (int) c));
      else b.append(c);
    }
    return b.append('"').toString();
  }
  static String scrub(String s) { return s == null ? null : s.replaceAll("\\d\\d:\\d\\d:\\d\\d", "hh:mm:ss"); }
  static xn cart(MinecartProbe.MW w) { return new xn(w, 0.5, 0.5, 0.5); }
  static fj red(fj c) { c.b().a(a.m); return c; }
  static String saved(xn c) {
    dh tag = new dh();
    c.e().a(tag);
    return tag.b("LastOutput", 8) ? tag.j("LastOutput") : null;
  }
  static String row(String name, xn c) throws Exception {
    fj out = c.e().h();
    String text;
    try { text = out == null ? null : out.c(); } catch (Throwable t) { text = "!" + t.getClass().getSimpleName(); }
    return "[" + json(name) + "," + json(scrub(out == null ? null : fk.a(out))) + "," + json(scrub(saved(c))) + "," + json(scrub(text)) + "]";
  }
  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    PlantProbe.unsafe = MobMoveProbe.unsafe();
    MinecartProbe.MW w = MinecartProbe.world(new int[0][]);
    StringBuilder o = new StringBuilder();
    String[] names = {"text", "notFound", "tpCoords", "give", "usage", "greenText", "sibling", "numbers", "emptyText", "special", "styledAll", "styledArg"};
    fj[] comps = {
      new fq("done"),
      red(new fr("commands.generic.notFound")),
      new fr("commands.tp.success.coordinates", "Player", 1.5, 64.0, -3.0),
      new fr("commands.give.success", "Stone", 5, "Player"),
      red(new fr("commands.generic.usage", new fr("commands.tp.usage"))),
      new fq("ok").a(new fn().a(a.k)),
      new fq("a").a(new fq("b")),
      new fr("commands.xp.success", 10, "Player"),
      new fq(""),
      new fq("say \"hi\" <&> = ' \u00a7c é \u2028 \\ \n\t"),
      new fq("x").a(new fn().a(a.m).a(true).b(true).c(true).d(true).e(true)).a(new fq("y")),
      new fr("commands.tp.success", new fq("P").a(new fn().a(a.h)), "T"),
    };
    for (int i = 0; i < comps.length; i++) {
      xn c = cart(w);
      c.e().a(comps[i]);
      o.append(i > 0 ? "," : "").append(row(names[i], c));
    }
    // TrackOutput false
    xn off = cart(w);
    dh t = new dh();
    t.a("TrackOutput", false);
    off.e().b(t);
    off.e().a(new fq("done"));
    o.append(",").append(row("trackOff", off));
    // a second message replaces the first
    xn two = cart(w);
    two.e().a(new fq("one"));
    two.e().a(new fq("two"));
    o.append(",").append(row("second", two));
    // loading LastOutput strings
    String[] loads = {"{\"text\":\"[12:00:00] old\"}", "{\"extra\":[\"msg\"],\"text\":\"[12:00:00] \"}", "\"plain\"", "{\"translate\":\"commands.generic.notFound\",\"color\":\"red\"}", "[\"a\",\"b\"]", "not json", "", "{\"text\":1"};
    StringBuilder l = new StringBuilder();
    for (int i = 0; i < loads.length; i++) {
      dh tag = new dh();
      tag.a("LastOutput", loads[i]);
      xn c = cart(w);
      String res;
      try { c.e().b(tag); res = row("load", c); } catch (Throwable ex) { res = "[\"load\",\"!" + ex.getClass().getSimpleName() + "\"]"; }
      l.append(i > 0 ? "," : "").append("[").append(json(loads[i])).append(",").append(res).append("]");
    }
    System.out.println("{\"name\":\"outputs\",\"rows\":[" + o + "]}");
    System.out.println("{\"name\":\"loads\",\"rows\":[" + l + "]}");
  }
}
