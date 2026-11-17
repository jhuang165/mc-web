// b79 potspacks79. Deserialises pack.mcmeta description JSON through the unchanged 1.7.10 IChatComponent.Serializer [fk.a(String)] (what
// PackMetadataSectionSerializer [bsh] hands the element to) and prints getFormattedText (fj.d, what ResourcePackListEntryFound draws via bsg.a().d()).
// Cases come from args (one JSON document per argument); output: {"rows":[[json, formatted|null, error|null]]}.
public class PackDescProbe {
  static String js(String s) {
    if (s == null) return "null";
    StringBuilder b = new StringBuilder("\"");
    for (char c : s.toCharArray()) {
      if (c == '"' || c == '\\') b.append('\\').append(c);
      else if (c < 32 || c > 126) b.append(String.format("\\u%04x", (int) c));
      else b.append(c);
    }
    return b.append('"').toString();
  }
  public static void main(String[] args) throws Exception {
    StringBuilder out = new StringBuilder("{\"rows\":[");
    for (int i = 0; i < args.length; i++) {
      String f = null, err = null;
      try { fj c = fk.a(args[i]); f = c == null ? null : c.d(); if (c == null) err = "null component"; }
      catch (Throwable t) { err = t.getClass().getSimpleName(); }
      out.append(i > 0 ? "," : "").append("[").append(js(args[i])).append(",").append(js(f)).append(",").append(js(err)).append("]");
    }
    System.out.println(out.append("]}"));
  }
}
