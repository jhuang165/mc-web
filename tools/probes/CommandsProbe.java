import com.google.gson.*;
import java.io.*;
import java.lang.reflect.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

// Batch 13 command evidence from the unchanged Minecraft Java 1.7.10 client JAR with its own libraries (gson 2.2.4, guava 15.0,
// commons-lang3 3.1, log4j 2.0-beta9). Run by tools/verify-commands-b13.mjs; one JSON object per output line.
//  * tellraw: IChatComponent.Serializer (fk.a(String)) on every case of the case file, with CommandMessageRaw's handling of a
//    JsonParseException (ExceptionUtils.getRootCause message into commands.tellraw.jsonException); the parsed component's
//    getFormattedText (d), getUnformattedText (c), its iteration (class, text, formatting code, resolved click and hover events)
//    and the serializer's JSON back (fk.a(fj)).
//  * font / wrap: FontRenderer.getStringWidth and trimStringToWidth (bbu) with the ascii widths of menu-screens.js, and
//    GuiNewChat.func_146237_a (bcc) on allocated Minecraft / GameSettings instances: the drawn lines' formatted text and parts.
//  * achievement: StatList.func_151177_a (pp.a(String)) lookups and each achievement's func_150955_j (ph.j) component.
//  * spread: CommandSpreadPlayers.func_110670_a / func_110668_a (br) with a seeded java.util.Random on an allocated world.
//  * profiler: Profiler.getProfilingData (qi.b) on a filled profilingMap.
//  * scoreboard: see ScoreboardProbe.java (tools/verify-scoreboard.mjs, scoreboard-reference.json).
public class CommandsProbe {
  static String q(String s) {
    if (s == null) return "null";
    StringBuilder b = new StringBuilder("\"");
    for (char c : s.toCharArray()) {
      if (c == '"' || c == '\\') b.append('\\').append(c);
      else if (c < 0x20 || c > 0x7e) b.append(String.format("\\u%04x", (int) c));
      else b.append(c);
    }
    return b.append('"').toString();
  }
  static Object get(Class<?> c, Object o, String n) throws Exception { Field f = c.getDeclaredField(n); f.setAccessible(true); return f.get(o); }
  static void set(Class<?> c, Object o, String n, Object v) throws Exception { Field f = c.getDeclaredField(n); f.setAccessible(true); f.set(o, v); }
  static sun.misc.Unsafe unsafe() throws Exception { Field f = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); f.setAccessible(true); return (sun.misc.Unsafe) f.get(null); }
  static Method method(Class<?> c, String name, Class<?>... types) throws Exception { Method m = c.getDeclaredMethod(name, types); m.setAccessible(true); return m; }

  static String style(fn s) {
    StringBuilder b = new StringBuilder("{");
    b.append("\"code\":").append(q(s.j()));
    fh click = s.h();
    if (click != null) b.append(",\"click\":[").append(q(click.a().b())).append(',').append(q(click.b())).append(']');
    fl hover = s.i();
    if (hover != null) b.append(",\"hover\":[").append(q(hover.a().b())).append(',').append(q(hover.b().d())).append(',').append(q(hover.b().c())).append(']');
    return b.append('}').toString();
  }
  static String parts(fj c) {
    StringBuilder b = new StringBuilder("[");
    for (Object o : c) {
      fj p = (fj) o;
      if (b.length() > 1) b.append(',');
      b.append("{\"cls\":").append(q(p instanceof fq ? "text" : p instanceof fr ? "translation" : p.getClass().getName()));
      b.append(",\"text\":").append(q(p.e())).append(",\"style\":").append(style(p.b())).append('}');
    }
    return b.append(']').toString();
  }
  static String rootMessage(Throwable t) {
    Throwable r = org.apache.commons.lang3.exception.ExceptionUtils.getRootCause(t);
    return r == null ? "" : r.getMessage();
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l(); pp.a();
    JsonObject cases = new JsonParser().parse(new String(Files.readAllBytes(Paths.get(args[0])), StandardCharsets.UTF_8)).getAsJsonObject();

    for (fi a : fi.values()) System.out.println("{\"case\":\"clickAction\",\"name\":" + q(a.name()) + ",\"canonical\":" + q(a.b()) + ",\"chat\":" + a.a() + "}");
    for (fm a : fm.values()) System.out.println("{\"case\":\"hoverAction\",\"name\":" + q(a.name()) + ",\"canonical\":" + q(a.b()) + ",\"chat\":" + a.a() + "}");
    for (a f : a.values()) System.out.println("{\"case\":\"formatting\",\"name\":" + q(f.name()) + ",\"code\":" + q(f.toString()) + "}");

    // ---- tellraw ----
    for (JsonElement e : cases.getAsJsonArray("tellraw")) {
      String input = e.getAsString();
      StringBuilder b = new StringBuilder("{\"case\":\"tellraw\",\"input\":" + q(input));
      fj c = null;
      try {
        c = fk.a(input);
        b.append(",\"outcome\":").append(q(c == null ? "null" : "ok"));
      } catch (JsonParseException x) {
        String m = rootMessage(x);
        b.append(",\"outcome\":\"parse\",\"exception\":").append(q(x.getClass().getSimpleName())).append(",\"root\":").append(q(org.apache.commons.lang3.exception.ExceptionUtils.getRootCause(x) == null ? null : org.apache.commons.lang3.exception.ExceptionUtils.getRootCause(x).getClass().getSimpleName()));
        b.append(",\"message\":").append(q(m)).append(",\"chat\":").append(q(new fr("commands.tellraw.jsonException", m).c()));
      } catch (Throwable x) {
        b.append(",\"outcome\":\"generic\",\"exception\":").append(q(x.getClass().getName())).append(",\"message\":").append(q(x.getMessage()));
      }
      if (c != null) {
        try {
          fj shown = fk.a(fk.a(c)); // what the client renders: S02PacketChat carries the serialized component
          String f = q(shown.d()), un = q(shown.c()), ps = parts(shown);
          b.append(",\"formatted\":").append(f).append(",\"unformatted\":").append(un).append(",\"parts\":").append(ps);
        } catch (Throwable x) {
          b.append(",\"renderError\":").append(q(x.getClass().getSimpleName() + ": " + x.getMessage()));
        }
        try { b.append(",\"json\":").append(q(fk.a(c))); } catch (Throwable x) { b.append(",\"jsonError\":").append(q(String.valueOf(x))); }
      }
      System.out.println(b.append('}'));
    }

    // ---- FontRenderer and GuiNewChat ----
    sun.misc.Unsafe u = unsafe();
    int[] ascii = {4, 2, 5, 6, 6, 6, 6, 3, 5, 5, 5, 6, 2, 6, 2, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 2, 2, 5, 6, 5, 6, 7, 6, 6, 6, 6, 6, 6, 6, 6, 4, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 4, 6, 4, 6, 6, 3, 6, 6, 6, 6, 6, 5, 6, 6, 2, 6, 5, 3, 6, 6, 6, 6, 6, 6, 6, 4, 6, 6, 6, 6, 6, 6, 5, 2, 5, 7};
    bbu font = (bbu) u.allocateInstance(bbu.class);
    int[] widths = new int[256];
    Arrays.fill(widths, 6);
    for (int i = 0; i < ascii.length; i++) widths[32 + i] = ascii[i];
    set(bbu.class, font, "d", widths); set(bbu.class, font, "e", new byte[65536]); set(bbu.class, font, "k", false); font.a = 9; font.b = new Random(0);
    for (JsonElement e : cases.getAsJsonArray("width")) {
      String s = e.getAsString();
      System.out.println("{\"case\":\"width\",\"text\":" + q(s) + ",\"width\":" + font.a(s) + "}");
    }
    for (JsonElement e : cases.getAsJsonArray("trim")) {
      JsonArray a = e.getAsJsonArray();
      String s = a.get(0).getAsString(); int w = a.get(1).getAsInt();
      System.out.println("{\"case\":\"trim\",\"text\":" + q(s) + ",\"limit\":" + w + ",\"result\":" + q(font.a(s, w, false)) + "}");
    }
    bbj gs = (bbj) u.allocateInstance(bbj.class);
    bao mc = (bao) u.allocateInstance(bao.class);
    set(bao.class, mc, "l", font); set(bao.class, mc, "u", gs); set(bao.class, null, "M", mc);
    Method layout = method(bcc.class, "a", fj.class, int.class, int.class, boolean.class);
    for (JsonElement e : cases.getAsJsonArray("wrap")) {
      JsonArray a = e.getAsJsonArray();
      String input = a.get(0).getAsString();
      float width = a.get(1).getAsFloat(), scale = a.get(2).getAsFloat();
      boolean colours = a.get(3).getAsBoolean();
      set(bbj.class, gs, "D", width); set(bbj.class, gs, "C", scale); set(bbj.class, gs, "n", colours);
      bcc chat = (bcc) u.allocateInstance(bcc.class);
      set(bcc.class, chat, "f", mc); set(bcc.class, chat, "g", new ArrayList()); set(bcc.class, chat, "h", new ArrayList()); set(bcc.class, chat, "i", new ArrayList());
      layout.invoke(chat, fk.a(input), 0, 0, false);
      List<?> lines = (List<?>) get(bcc.class, chat, "i");
      StringBuilder b = new StringBuilder("{\"case\":\"wrap\",\"input\":" + q(input) + ",\"chatWidth\":" + width + ",\"chatScale\":" + scale + ",\"colours\":" + colours + ",\"lines\":[");
      for (int i = lines.size() - 1; i >= 0; i--) { // oldest (first) line first
        fj line = ((bak) lines.get(i)).a();
        if (i < lines.size() - 1) b.append(',');
        b.append("{\"formatted\":").append(q(line.d())).append(",\"parts\":").append(parts(line)).append('}');
      }
      System.out.println(b.append("]}"));
    }

    // ---- achievements and stats ----
    for (JsonElement e : cases.getAsJsonArray("statLookup")) {
      String id = e.getAsString();
      ph s = pp.a(id);
      System.out.println("{\"case\":\"statLookup\",\"id\":" + q(id) + ",\"found\":" + (s != null) + (s == null ? "" : ",\"achievement\":" + s.d() + ",\"class\":" + q(s.getClass().getSimpleName())) + "}");
    }
    for (Object o : pc.e) {
      pb a = (pb) o;
      // ph.j() sets the bracket component's style to the name's own style object, whose parent then is itself (an inheritance cycle
      // that overflows the getters); the game only ever renders it after the S02PacketChat JSON round trip, as here.
      fj j = fk.a(fk.a(a.j()));
      System.out.println("{\"case\":\"achievementComponent\",\"id\":" + q(a.e) + ",\"formatted\":" + q(j.d()) + ",\"unformatted\":" + q(j.c()) + ",\"json\":" + q(fk.a(j)) + ",\"parts\":" + parts(j) + ",\"description\":" + q(a.f()) + "}");
    }
    StringBuilder all = new StringBuilder();
    for (Object o : pp.b) all.append(all.length() == 0 ? "" : ",").append(q(((ph) o).e));
    System.out.println("{\"case\":\"allStats\",\"ids\":[" + all + "]}");
    fj announce = fk.a(fk.a(new fr("chat.type.achievement", "Player", ((pb) pc.e.get(0)).j())));
    System.out.println("{\"case\":\"achievementChat\",\"formatted\":" + q(announce.d()) + ",\"json\":" + q(fk.a(announce)) + ",\"parts\":" + parts(announce) + "}");

    // ---- spreadplayers ----
    Object world = u.allocateInstance(Class.forName("bjf"));
    Method positions = method(br.class, "a", Random.class, int.class, double.class, double.class, double.class, double.class);
    Method spread = method(br.class, "a", bs.class, double.class, ahb.class, Random.class, double.class, double.class, double.class, double.class, bs[].class, boolean.class);
    br command = new br();
    for (JsonElement e : cases.getAsJsonArray("spread")) {
      JsonArray a = e.getAsJsonArray();
      long seed = a.get(0).getAsLong(); int count = a.get(1).getAsInt();
      double cx = a.get(2).getAsDouble(), cz = a.get(3).getAsDouble(), dist = a.get(4).getAsDouble(), range = a.get(5).getAsDouble();
      Random r = new Random(seed);
      double minX = cx - range, minZ = cz - range, maxX = cx + range, maxZ = cz + range;
      bs[] ps = (bs[]) positions.invoke(command, r, count, minX, minZ, maxX, maxZ);
      StringBuilder b = new StringBuilder("{\"case\":\"spread\",\"seed\":" + seed + ",\"count\":" + count + ",\"x\":" + cx + ",\"z\":" + cz + ",\"distance\":" + dist + ",\"range\":" + range);
      b.append(",\"initial\":[");
      for (int i = 0; i < ps.length; i++) b.append(i == 0 ? "" : ",").append('[').append(ps[i].a).append(',').append(ps[i].b).append(']');
      b.append(']');
      try {
        int it = (Integer) spread.invoke(command, new bs(cx, cz), dist, world, r, minX, minZ, maxX, maxZ, ps, false);
        b.append(",\"iterations\":").append(it).append(",\"final\":[");
        for (int i = 0; i < ps.length; i++) b.append(i == 0 ? "" : ",").append('[').append(ps[i].a).append(',').append(ps[i].b).append(']');
        b.append(']');
        double total = 0;
        for (int i = 0; i < ps.length; i++) { double m = Double.MAX_VALUE; for (int k = 0; k < ps.length; k++) if (k != i) m = Math.min(m, ps[i].a(ps[k])); total += m; }
        b.append(",\"averageDistance\":").append(q(String.format("%.2f", total / ps.length)));
        b.append(",\"next\":").append(q(String.valueOf(r.nextLong())));
      } catch (InvocationTargetException x) {
        cd ce = (cd) x.getCause();
        b.append(",\"failure\":").append(q(ce.getMessage())).append(",\"args\":[");
        Object[] ca = ce.a();
        for (int i = 0; i < ca.length; i++) b.append(i == 0 ? "" : ",").append(q(String.valueOf(ca[i])));
        b.append(']');
      }
      System.out.println(b.append('}'));
    }

    // ---- profiler ----
    for (JsonElement e : cases.getAsJsonArray("profiler")) {
      JsonObject o = e.getAsJsonObject();
      qi p = new qi();
      p.a = true;
      Map<String, Long> map = (Map<String, Long>) get(qi.class, p, "f");
      for (Map.Entry<String, JsonElement> m : o.getAsJsonObject("map").entrySet()) map.put(m.getKey(), m.getValue().getAsLong());
      List<?> res = p.b(o.get("name").getAsString());
      StringBuilder b = new StringBuilder("{\"case\":\"profiler\",\"name\":" + q(o.get("name").getAsString()) + ",\"map\":" + o.get("map") + ",\"results\":");
      if (res == null) b.append("null");
      else {
        b.append('[');
        for (int i = 0; i < res.size(); i++) {
          qj r = (qj) res.get(i);
          b.append(i == 0 ? "" : ",").append("[").append(q(r.c)).append(',').append(q(String.format("%.2f", r.a))).append(',').append(q(String.format("%.2f", r.b))).append(',').append(q(String.valueOf(r.a))).append(',').append(q(String.valueOf(r.b))).append(']');
        }
        b.append(']');
      }
      b.append(",\"after\":{");
      boolean first = true;
      for (String k : new TreeSet<String>(map.keySet())) { b.append(first ? "" : ",").append(q(k)).append(':').append(map.get(k)); first = false; }
      System.out.println(b.append("}}"));
    }
  }
}
