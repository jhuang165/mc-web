// Batch 44 stand-in for EntityItem (xk), shadowing the game class on the probe classpath only: the fields RenderItem reads (age a, hover start c) and the stack getter f()
// that normally reads the DataWatcher. Everything else is Entity's.
public class xk extends sa {
  public xk() { super((ahb) null); }
  public int a;
  public float c;
  public add stack;
  public add f() { return stack; }
  protected void c() {}
  protected void a(dh tag) {}
  protected void b(dh tag) {}
}
