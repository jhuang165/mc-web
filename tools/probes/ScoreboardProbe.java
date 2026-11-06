import com.google.gson.*;
import java.io.*;
import java.lang.reflect.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

// /scoreboard evidence from the unchanged Minecraft Java 1.7.10 client JAR. Run by tools/verify-scoreboard.mjs; one JSON object per
// output line.
//  * command: scripted lines through the real CommandScoreboard (bk.b(ac, String[])) on a fresh Scoreboard (bac) per script (d() is
//    overridden; the native one asks the server's overworld). The sender is a plain ICommandSender (not an EntityPlayer, so "teams
//    join <team>" / "teams leave" without names take the usage branch). Each line records the sender's chat lines (addChatMessage:
//    colour code + unformatted text), the CommandBase.notifyAdmins calls (through the static IAdminCommand hook: key, args, text) and
//    a thrown CommandException's class and text (CommandHandler wraps WrongUsageException in commands.generic.usage).
//  * state: after each script, the scoreboard's objectives / score holders / teams in HashMap order, every objective's
//    getSortedScores (bac.i) order, ScorePlayerTeam.formatPlayerName for each holder, the display slots, and ScoreboardSaveData
//    (bad.b) written as the uncompressed MapStorage file body (CompressedStreamTools.write of {data: ...}), plus the bytes again
//    after bad.a reads it into a new Scoreboard.
//  * criteria: IScoreObjectiveCriteria.field_96643_a (bah.a) keys in HashMap order.
//  * formatting: EnumChatFormatting.getValueByName (a.b) for team colour inputs and getValidValues(true, false).
public class ScoreboardProbe {
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
  static String arr(Collection<?> c) {
    StringBuilder b = new StringBuilder("[");
    for (Object o : c) { if (b.length() > 1) b.append(','); b.append(o == null ? "null" : o instanceof Number ? o.toString() : q(String.valueOf(o))); }
    return b.append(']').toString();
  }
  static String args(Object[] a) {
    List<Object> l = new ArrayList<>();
    for (Object o : a) l.add(o instanceof fj ? ((fj) o).c() : o);
    return arr(l);
  }

  static bac board;
  static final List<String> out = new ArrayList<>();

  static class Board extends bk {
    @Override protected bac d() { return board; }
  }
  static class Sender implements ac {
    public String b_() { return "Probe"; }
    public fj c_() { return new fq("Probe"); }
    public void a(fj c) {
      a color = c.b().a();
      out.add("{\"t\":\"chat\",\"color\":" + q(color == null ? "" : color.toString()) + ",\"text\":" + q(c.c()) + "}");
    }
    public boolean a(int level, String command) { return true; }
    public r f_() { return new r(0, 0, 0); }
    public ahb d() { return null; }
  }

  static String hex(dh tag) throws Exception {
    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    du.a(tag, (DataOutput) new DataOutputStream(bytes));
    StringBuilder b = new StringBuilder();
    for (byte x : bytes.toByteArray()) b.append(String.format("%02x", x & 0xff));
    return b.toString();
  }
  static dh saveFile(bac sb) {
    bad data = new bad();
    data.a(sb);
    dh tag = new dh();
    data.b(tag);
    dh root = new dh();
    root.a("data", tag);
    return root;
  }

  static void state(String script) throws Exception {
    StringBuilder b = new StringBuilder("{\"case\":\"state\",\"script\":" + q(script));
    List<String> objs = new ArrayList<>();
    StringBuilder sorted = new StringBuilder("{");
    for (Object o : board.c()) {
      azx obj = (azx) o;
      objs.add(obj.b());
      if (sorted.length() > 1) sorted.append(',');
      List<String> rows = new ArrayList<>();
      for (Object s : board.i(obj)) rows.add(((azz) s).e() + "=" + ((azz) s).c());
      sorted.append(q(obj.b())).append(':').append(arr(rows));
    }
    b.append(",\"objectives\":").append(arr(objs));
    StringBuilder od = new StringBuilder("[");
    for (Object o : board.c()) { azx obj = (azx) o; if (od.length() > 1) od.append(','); od.append(arr(Arrays.asList(obj.b(), obj.c().a(), obj.d(), String.valueOf(obj.c().b())))); }
    b.append(",\"objectiveDetails\":").append(od.append(']'));
    b.append(",\"holders\":").append(arr(new ArrayList<Object>(board.d())));
    b.append(",\"sorted\":").append(sorted.append('}'));
    List<String> formatted = new ArrayList<>();
    for (Object p : board.d()) formatted.add(azy.a(board.i((String) p), (String) p));
    b.append(",\"formatted\":").append(arr(formatted));
    StringBuilder teams = new StringBuilder("[");
    for (Object o : board.g()) {
      azy t = (azy) o;
      if (teams.length() > 1) teams.append(',');
      teams.append("{\"name\":").append(q(t.b())).append(",\"display\":").append(q(t.c())).append(",\"prefix\":").append(q(t.e())).append(",\"suffix\":").append(q(t.f()))
        .append(",\"friendlyFire\":").append(t.g()).append(",\"seeFriendlyInvisibles\":").append(t.h()).append(",\"members\":").append(arr(t.d())).append('}');
    }
    b.append(",\"teams\":").append(teams.append(']'));
    List<String> slots = new ArrayList<>();
    for (int i = 0; i < 3; i++) slots.add(board.a(i) == null ? null : board.a(i).b());
    b.append(",\"slots\":").append(arr(slots));
    dh file = saveFile(board);
    b.append(",\"nbt\":").append(q(hex(file)));
    bac back = new bac();
    bad reader = new bad();
    reader.a(back);
    reader.a(file.m("data"));
    b.append(",\"roundTrip\":").append(q(hex(saveFile(back))));
    System.out.println(b.append('}'));
  }

  public static void main(String[] argv) throws Exception {
    aji.p(); adb.l(); pp.a();
    JsonObject cases = new JsonParser().parse(new String(Files.readAllBytes(Paths.get(argv[0])), StandardCharsets.UTF_8)).getAsJsonObject();
    Field hook = y.class.getDeclaredField("a");
    hook.setAccessible(true);
    hook.set(null, (x) (sender, command, flags, key, a) ->
      out.add("{\"t\":\"notify\",\"key\":" + q(key) + ",\"args\":" + args(a) + ",\"text\":" + q(new fr(key, a).c()) + "}"));
    Board command = new Board();
    Sender sender = new Sender();

    for (Map.Entry<String, JsonElement> script : cases.getAsJsonObject("scripts").entrySet()) {
      board = new bac();
      for (JsonElement e : script.getValue().getAsJsonArray()) {
        String line = e.getAsString();
        String[] split = ("scoreboard " + line).split(" ");
        String[] a = Arrays.copyOfRange(split, 1, split.length);
        out.clear();
        try {
          command.b(sender, a);
        } catch (ci x) {
          out.add("{\"t\":\"error\",\"cls\":\"usage\",\"key\":" + q(x.getMessage()) + ",\"text\":" + q(new fr("commands.generic.usage", new fr(x.getMessage(), x.a())).c()) + "}");
        } catch (cd x) {
          out.add("{\"t\":\"error\",\"cls\":" + q(x instanceof cf ? "syntax" : x.getClass() == cd.class ? "command" : x.getClass().getName()) + ",\"key\":" + q(x.getMessage()) + ",\"text\":" + q(new fr(x.getMessage(), x.a()).c()) + "}");
        } catch (Throwable x) {
          out.add("{\"t\":\"exception\",\"cls\":" + q(x.getClass().getName()) + ",\"text\":" + q(String.valueOf(x.getMessage())) + "}");
        }
        System.out.println("{\"case\":\"command\",\"script\":" + q(script.getKey()) + ",\"line\":" + q(line) + ",\"out\":[" + String.join(",", out) + "]}");
      }
      state(script.getKey());
    }

    List<String> criteria = new ArrayList<>();
    for (Object k : bah.a.keySet()) criteria.add((String) k);
    StringBuilder ro = new StringBuilder("[");
    for (Object k : bah.a.keySet()) if (((bah) bah.a.get(k)).b()) { if (ro.length() > 1) ro.append(','); ro.append(q((String) k)); }
    System.out.println("{\"case\":\"criteria\",\"keys\":" + arr(criteria) + ",\"readOnly\":" + ro.append(']') + "}");

    for (JsonElement e : cases.getAsJsonArray("formatting")) {
      a f = a.b(e.getAsString());
      System.out.println("{\"case\":\"formatting\",\"input\":" + q(e.getAsString()) + ",\"name\":" + q(f == null ? null : f.d()) + ",\"code\":" + q(f == null ? null : f.toString()) + ",\"fancy\":" + (f != null && f.b()) + "}");
    }
    System.out.println("{\"case\":\"validValues\",\"values\":" + arr(a.a(true, false)) + "}");
    for (JsonElement e : cases.getAsJsonArray("nice")) {
      List<Object> items = new ArrayList<>();
      for (JsonElement i : e.getAsJsonArray()) items.add(i.getAsString());
      System.out.println("{\"case\":\"nice\",\"items\":" + arr(items) + ",\"text\":" + q(y.a(items.toArray())) + "}");
    }
  }
}
