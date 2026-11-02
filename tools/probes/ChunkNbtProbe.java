import java.io.*;
import java.lang.reflect.*;
import java.util.*;

// Executes the unchanged private AnvilChunkLoader payload writer and reader.
// World construction, entities/tile entities and file IO are outside this probe.
public class ChunkNbtProbe {
  static sun.misc.Unsafe unsafe;
  static Field field(Class<?> c, String name) throws Exception {
    for (; c != null; c = c.getSuperclass()) {
      try { Field f = c.getDeclaredField(name); f.setAccessible(true); return f; }
      catch (NoSuchFieldException e) {}
    }
    throw new NoSuchFieldException(name);
  }
  public static class W extends ahb {
    long time;
    List pending;
    List<String> scheduled;
    W() { super((azc)null, null, (aqo)null, (ahj)null, null); }
    protected apu j() { return null; }
    protected int p() { return 0; }
    public sa a(int id) { return null; }
    public long I() { return time; }
    public List a(apx c, boolean remove) { return pending; }
    public void b(int x, int y, int z, aji b, int delay, int priority) {
      scheduled.add("[" + aji.b(b) + "," + x + "," + y + "," + z + "," + delay + "," + priority + "]");
    }
  }
  static final int[] POOL = {0,1,2,3,8,10,18,54,175,255};
  static final long[] TIMES = {0,1,-1,Long.MAX_VALUE,Long.MIN_VALUE,9007199254740993L,-9007199254740993L};
  static final long[] DELAYS = {0,1,-1,2147483648L,4294967301L,-2147483649L};
  static int[] sections(int n) {
    switch (n % 6) {
      case 0: return new int[0];
      case 1: return new int[]{0};
      case 2: return new int[]{0,15};
      case 3: int[] all = new int[16]; for(int i=0;i<16;i++)all[i]=i; return all;
      case 4: return new int[]{3,7};
      default: return new int[]{15};
    }
  }
  static apx fixture(W w, int n) throws Exception {
    apx c = new apx(w, n % 2 == 1 ? -1875000 : -3+n, 1874999-n);
    c.k = n % 2 == 0; c.l = n % 3 == 0; c.s = TIMES[(n+2)%TIMES.length]; c.o = true;
    for(int i=0;i<256;i++){c.f[i]=(i*37+n)%257;c.m()[i]=(byte)((i+n*3)&255);}
    for(int y:sections(n)) {
      apz s = new apz(y<<4, !w.t.g);
      for(int i=0;i<4096;i++)s.g()[i]=(byte)(n%6==1?0:POOL[(i*7+y*3+n)%POOL.length]);
      for(int i=0;i<2048;i++) {
        s.j().a[i]=(byte)(i*5+y+n); s.k().a[i]=(byte)(i*7+n*11);
        if(!w.t.g)s.l().a[i]=(byte)(i*13+y*17+n);
      }
      if((n+y)%3==0){apv add=s.m();for(int i=0;i<2048;i++)add.a[i]=(byte)(i%17==0?0x10:0);}
      c.i()[y]=s;
    }
    return c;
  }
  static String gzip(dh root) throws Exception { return Base64.getEncoder().encodeToString(du.a(root)); }
  static byte[] raw(dh root) throws Exception {
    ByteArrayOutputStream bytes=new ByteArrayOutputStream();du.a(root,(DataOutput)new DataOutputStream(bytes));return bytes.toByteArray();
  }
  static dh write(aqk loader, Method writer, apx chunk, W w) throws Exception {
    dh level=new dh(),root=new dh();writer.invoke(loader,chunk,w,level);root.a("Level",level);return root;
  }
  static String summary(apx c) throws Exception {
    StringJoiner sections = new StringJoiner(",","[","]");
    for(int i=0;i<16;i++)if(c.i()[i]!=null){apz s=c.i()[i];sections.add("["+i+","+field(apz.class,"b").getInt(s)+","+field(apz.class,"c").getInt(s)+"]");}
    return "{\"x\":"+c.g+",\"z\":"+c.h+",\"inhabitedTime\":\""+c.s+"\",\"terrain\":"+c.k+",\"light\":"+c.l+",\"sections\":"+sections+"}";
  }
  public static void main(String[] args) throws Exception {
    Field uf=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");uf.setAccessible(true);unsafe=(sun.misc.Unsafe)uf.get(null);
    aji.p();
    aqk loader=new aqk(new File("unused-probe-path"));
    Method writer=aqk.class.getDeclaredMethod("a",apx.class,ahb.class,dh.class);writer.setAccessible(true);
    Method reader=aqk.class.getDeclaredMethod("a",ahb.class,dh.class);reader.setAccessible(true);
    for(int n=0;n<14;n++) {
      W w=(W)unsafe.allocateInstance(W.class);w.time=TIMES[n%TIMES.length];w.scheduled=new ArrayList<>();
      aqo provider=(aqo)unsafe.allocateInstance(aqq.class);provider.g=n%2==1;field(ahb.class,"t").set(w,provider);
      if(n%3!=0)w.pending=new ArrayList();
      if(n%3==2)for(int j=0;j<3;j++){
        ahs tick=new ahs(-48+j, j*127, 31-j, aji.e(new int[]{8,10,12}[j]));
        tick.a(w.time+DELAYS[(n+j)%DELAYS.length]);tick.a(j-1);w.pending.add(tick);
      }
      apx original=fixture(w,n);
      dh saved=write(loader,writer,original,w), input=(dh)saved.b();
      dh level=input.m("Level");
      if(n==10)level.o("Biomes");
      if(n==11){level.o("TerrainPopulated");level.o("LightPopulated");level.o("InhabitedTime");level.o("LastUpdate");}
      if(n==8){dq list=level.c("Sections",10);dh duplicate=(dh)list.b(0).b();duplicate.a("Y",(byte)0);duplicate.a("Blocks",new byte[4096]);list.a(duplicate);}
      apx loaded=(apx)reader.invoke(loader,w,level);
      String state=summary(loaded);
      dh rewritten=write(loader,writer,loaded,w);
      String scheduled=String.join(",",w.scheduled);
      if(args.length>0) {
        dh imported;
        try(DataInputStream stream=new DataInputStream(new FileInputStream(new File(args[0],n+".nbt")))){imported=du.a((DataInput)stream,new ds(16*1024*1024));}
        w.scheduled.clear();
        apx actual=(apx)reader.invoke(loader,w,imported.m("Level"));
        if(!summary(actual).equals(state)||!String.join(",",w.scheduled).equals(scheduled))throw new AssertionError("JS load "+n);
        if(!Arrays.equals(raw(write(loader,writer,actual,w)),raw(rewritten)))throw new AssertionError("JS rewrite "+n);
      } else System.out.println("{\"index\":"+n+",\"hasSky\":"+(!provider.g)+",\"time\":\""+w.time+"\",\"saveGzip\":\""+gzip(saved)+"\",\"inputGzip\":\""+gzip(input)+"\",\"loadedGzip\":\""+gzip(rewritten)+"\",\"summary\":"+state+",\"scheduled\":["+scheduled+"]}");
    }
    if(args.length>0)System.out.println("14 JS chunk payloads read and rewritten by original AnvilChunkLoader");
  }
}
