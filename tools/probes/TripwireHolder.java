// Scripted player stand-in for RedstoneProbe's "harvest" event: BlockTripWire.onBlockHarvested only reads
// getCurrentEquippedItem (EntityPlayer.bF). Allocated without running a constructor.
public class TripwireHolder extends yz {
  add held;
  TripwireHolder() { super(null, null); }
  public add bF() { return held; }
  protected void c() {}
  public void a(dh d) {}
  public void b(dh d) {}
  public r f_() { return null; }
  public boolean a(int i, String s) { return true; }
  public String b_() { return "probe"; }
  public fj c_() { return null; }
  public void a(fj m) {}
  public ahb d() { return null; }
  public boolean f() { return false; }
}
