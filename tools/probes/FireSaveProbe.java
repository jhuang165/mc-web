import java.lang.reflect.Field;

// Inherited, unchanged Entity.writeToNBT/readFromNBT on an otherwise empty
// concrete Entity. Only the three abstract subtype hooks are supplied.
public class FireSaveProbe {
  static class Rec extends sa {
    Rec() { super(null); }
    protected void c() {}
    protected void a(dh tag) {}
    protected void b(dh tag) {}
  }
  public static void main(String[] args) throws Exception {
    Field fire = sa.class.getDeclaredField("e");
    fire.setAccessible(true);
    for (int value : new int[] {-32768, -20, -19, -1, 0, 1, 19, 20, 21, 159, 160, 299, 300, 32767}) {
      Rec before = new Rec();
      fire.setInt(before, value);
      dh tag = new dh();
      before.e(tag);
      Rec after = new Rec();
      after.f(tag);
      System.out.println("{\"fire\":" + value + ",\"stored\":" + tag.e("Fire") + ",\"loaded\":" + fire.getInt(after) + "}");
    }
    Rec before = new Rec();
    dh tag = new dh();
    before.e(tag);
    tag.o("Fire");
    Rec after = new Rec();
    fire.setInt(after, 300);
    after.f(tag);
    System.out.println("{\"missing\":true,\"loaded\":" + fire.getInt(after) + "}");
  }
}
