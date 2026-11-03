import java.lang.reflect.*;
import java.security.MessageDigest;
import java.util.*;

// Unchanged 1.7.10 MapGenVillage (avn) and MapGenVillage.Start (avo), StructureVillagePieces (avp: Start awa,
// Well awf, Path awb, Torch avt, House1 avq, Church avy, House4Garden avw, WoodHut avx, Hall avv, Field1 avr,
// Field2 avs, Blacksmith avz, Library awc, PieceWeight avu), the village base class awd (desert substitution,
// getAverageGroundLevel, spawnVillagers), the structure framework (aqx/ave/avm/avk/asv), WeightedRandomChestContent
// (qx), ItemDoor.func_150924_a (ach) and a real EntityVillager (yv). The World is an explicit block-access double
// over analytic fixtures (flat, hills with water/leaves/tall grass, dunes) with the real WorldChunkManager (aib).
// MapGenStructureData persistence is stubbed (loadItemData null, setItemData ignored).
public class VillageProbe {
  static String jstr(String s){return TerrainProbe.q(s);}
  static String key(int x,int y,int z){return x+","+y+","+z;}
  static String stack(add s){
    if(s==null)return "null";
    StringBuilder e=new StringBuilder("[");dq tags=ade.bR.g(s);
    for(int i=0;i<tags.c();i++){if(i>0)e.append(',');dh t=tags.b(i);e.append('[').append(t.e("id")).append(',').append(t.e("lvl")).append(']');}
    return "["+adb.b(s.b())+","+s.b+","+s.k()+","+e+"]]";
  }
  static void put(MessageDigest d,int... a){for(int v:a)for(int s=0;s<32;s+=8)d.update((byte)(v>>s));}
  static int hash3(int x,int y,int z){return (x*73856093)^(y*19349663)^(z*83492791);}
  // Fixture columns; mirrored in src/village-generator.test.js.
  static int ground(String f,int x,int z){
    if(f.equals("flat"))return 63;
    return 62+((hash3(x>>3,7,z>>3)>>>5)&7)+((hash3(x>>1,11,z>>1)>>>9)&1);
  }
  static int fixture(String f,int x,int y,int z){
    if(y<0||y>=256)return 0;
    if(y==0)return 7;
    int h=ground(f,x,z);
    if(y<=h-4)return 1;
    if(f.equals("dunes")){if(y<h)return y>=h-3?24:12;if(y==h)return 12;}
    else{if(y<h)return 3;if(y==h)return 2;}
    if(f.equals("hills")){
      if(y<=63)return 9;
      int k=hash3(x,3,z)&31;
      if((k==0&&(y==h+3||y==h+4)))return 18;
      if(k==1&&y==h+1)return 31;
    }
    return 0;
  }
  static class Chest extends aow {
    List<String> calls=new ArrayList<>();
    public void a(int slot,add s){calls.add("["+slot+","+stack(s)+"]");super.a(slot,s);}
    public void e(){}
  }
  static class W extends TerrainProbe.W {
    String fixture;Map<String,aji> edits=new HashMap<>();Map<String,aor> tiles=new LinkedHashMap<>();
    MessageDigest calls,writes;int callCount,writeCount;StringBuilder fullWrites;List<String> entities=new ArrayList<>();
    void call(int... a){callCount++;put(calls,a);}
    aji raw(int bx,int by,int bz){
      if(by<0||by>=256||bx< -30000000||bx>=30000000||bz< -30000000||bz>=30000000)return aji.e(0);
      aji edit=edits.get(key(bx,by,bz));if(edit!=null)return edit;
      return aji.e(fixture(fixture,bx,by,bz));
    }
    public aji a(int bx,int by,int bz){call(0,bx,by,bz);return raw(bx,by,bz);}
    public boolean c(int x,int y,int z){call(1,x,y,z);return a(x,y,z).o()==awt.a;}
    public boolean d(int x,int y,int z,aji b,int meta,int flags){call(2,x,y,z,aji.b(b),meta,flags);if(y<0||y>=256||x< -30000000||x>=30000000||z< -30000000||z>=30000000)return false;
      String k=key(x,y,z);edits.put(k,b);writeCount++;put(writes,x,y,z,aji.b(b),meta,flags);
      if(fullWrites!=null){if(fullWrites.length()>1)fullWrites.append(',');fullWrites.append('[').append(x).append(',').append(y).append(',').append(z).append(',').append(aji.b(b)).append(',').append(meta).append(',').append(flags).append(']');}
      tiles.remove(k);if(b==ajn.ae)tiles.put(k,new Chest());return true;
    }
    // notifyBlocksOfNeighborChange: neighbour callbacks are not run by the double; the call is recorded.
    public void d(int x,int y,int z,aji b){call(7,x,y,z,aji.b(b));}
    // World.getTopSolidOrLiquidBlock over this double (native Chunk.getTopFilledSegment()+15 only skips air).
    public int i(int x,int z){call(6,x,z);for(int y=255;y>0;y--){aji b=raw(x,y,z);if(b.o().c()&&b.o()!=awt.j)return y+1;}return -1;}
    public ahu a(int x,int z){return manager.a(x,z);}
    public aor o(int x,int y,int z){call(4,x,y,z);return tiles.get(key(x,y,z));}
    public boolean d(sa e){
      call(5,(int)Math.floor(e.s),(int)Math.floor(e.t),(int)Math.floor(e.u));
      if(!(e instanceof yv))throw new AssertionError(e.getClass().getName());
      yv v=(yv)e;
      entities.add("["+jstr("Villager")+","+e.s+","+e.t+","+e.u+","+v.bZ()+"]");return true;
    }
    public ayl a(Class c,String n){return null;}
    public void a(String n,ayl d){}
    String tileList(){StringBuilder s=new StringBuilder("[");
      for(Map.Entry<String,aor> en:tiles.entrySet()){if(s.length()>1)s.append(',');s.append('[').append(jstr(en.getKey())).append(',');
        Chest c=(Chest)en.getValue();s.append(jstr("chest")).append(",[");for(int i=0;i<27;i++){if(i>0)s.append(',');s.append(stack(c.a(i)));}s.append("],[").append(String.join(",",c.calls)).append(']');s.append(']');}
      return s.append(']').toString();}
  }
  static W world(long seed,ahm type,ahm providerType,String fixture)throws Exception{
    W w=(W)TerrainProbe.unsafe.allocateInstance(W.class);w.seed=seed;w.fixture=fixture;w.edits=new HashMap<>();w.tiles=new LinkedHashMap<>();w.entities=new ArrayList<>();
    w.manager=new aib(seed,type);w.info=(ays)TerrainProbe.unsafe.allocateInstance(ays.class);
    for(Field f:ays.class.getDeclaredFields())if(f.getType()==ahm.class){f.setAccessible(true);f.set(w.info,type);}
    TerrainProbe.set(w.info,"a",seed);
    w.calls=MessageDigest.getInstance("SHA-1");w.writes=MessageDigest.getInstance("SHA-1");
    Object provider=TerrainProbe.unsafe.allocateInstance(aqq.class);TerrainProbe.set(provider,"c",providerType);
    TerrainProbe.field(ahb.class,"t").set(w,provider);
    TerrainProbe.set(w,"s",new Random(0));
    for(Field f:ahb.class.getDeclaredFields())if(f.getType()==List.class&&!Modifier.isStatic(f.getModifiers())){f.setAccessible(true);f.set(w,new ArrayList<>());}
    return w;
  }
  static String bb(asv b){return "["+b.a+","+b.b+","+b.c+","+b.d+","+b.e+","+b.f+"]";}
  static Field declared(Class<?> c,String n)throws Exception{Field f=c.getDeclaredField(n);f.setAccessible(true);return f;}
  // Same text as JSON.stringify of the JS piece description: [name, mode, depth, bb x6, HPos, VCount, Desert, ...extras].
  static String piece(avk p)throws Exception{
    StringBuilder s=new StringBuilder("[");asv b=p.c();
    s.append(jstr(avi.a(p))).append(',').append(p.g).append(',').append(p.h).append(',').append(b.a).append(',').append(b.b).append(',').append(b.c).append(',').append(b.d).append(',').append(b.e).append(',').append(b.f);
    s.append(',').append(declared(awd.class,"k").getInt(p)).append(',').append(declared(awd.class,"a").getInt(p)).append(',').append(declared(awd.class,"b").getBoolean(p));
    if(p instanceof awa)s.append(',').append(declared(awa.class,"b").getBoolean(p)).append(',').append(declared(awa.class,"c").getInt(p));
    else if(p instanceof awb)s.append(',').append(declared(awb.class,"a").getInt(p));
    else if(p instanceof avr){for(String n:new String[]{"a","b","c","d"})s.append(',').append(aji.b((aji)declared(avr.class,n).get(p)));}
    else if(p instanceof avs){for(String n:new String[]{"a","b"})s.append(',').append(aji.b((aji)declared(avs.class,n).get(p)));}
    else if(p instanceof avw)s.append(',').append(declared(avw.class,"a").getBoolean(p));
    else if(p instanceof avx)s.append(',').append(declared(avx.class,"a").getBoolean(p)).append(',').append(declared(avx.class,"b").getInt(p));
    else if(p instanceof avz)s.append(',').append(declared(avz.class,"b").getBoolean(p));
    return s.append(']').toString();
  }
  static String pieces(avm st)throws Exception{StringBuilder s=new StringBuilder("[");for(Object o:st.b()){if(s.length()>1)s.append(',');s.append(piece((avk)o));}return s.append(']').toString();}
  static String sha(String s)throws Exception{return TerrainProbe.hex(MessageDigest.getInstance("SHA-1").digest(s.getBytes("UTF-8")));}
  static Map<?,?> map(ave m)throws Exception{return (Map<?,?>)TerrainProbe.field(ave.class,"d").get(m);}
  static Random rand(aqx m)throws Exception{return (Random)TerrainProbe.field(aqx.class,"b").get(m);}
  static String startList(ave m,int full)throws Exception{
    StringBuilder s=new StringBuilder("[");int n=0;
    for(Object o:map(m).values()){avm st=(avm)o;if(s.length()>1)s.append(',');String p=pieces(st);
      s.append("{\"chunk\":[").append(st.e()).append(',').append(st.f()).append("],\"bb\":").append(bb(st.a())).append(",\"valid\":").append(st.d()).append(",\"pieceCount\":").append(st.b().size()).append(",\"piecesSha1\":").append(jstr(sha(p)));
      if(n++<full)s.append(",\"pieces\":").append(p);s.append('}');}
    return s.append(']').toString();
  }
  static long populationSeed(long seed,int cx,int cz){Random r=new Random(seed);long a=r.nextLong()/2L*2L+1L,b=r.nextLong()/2L*2L+1L;return (long)cx*a+(long)cz*b^seed;}
  static int[][] coverage(asv b){List<int[]> l=new ArrayList<>();
    for(int cx=Math.floorDiv(b.a-23+15,16);cx<=Math.floorDiv(b.d-8,16);cx++)for(int cz=Math.floorDiv(b.c-23+15,16);cz<=Math.floorDiv(b.f-8,16);cz++)l.add(new int[]{cx,cz});
    return l.toArray(new int[0][]);}

  // The real MapGenVillage with a world; the size/distance options go through its own parser.
  static avn gen(W w,int size,int distance){
    Map<String,String> o=new LinkedHashMap<>();if(size!=0)o.put("size",""+size);if(distance!=32)o.put("distance",""+distance);
    avn m=new avn(o);try{TerrainProbe.set(m,"c",w);}catch(Exception e){throw new RuntimeException(e);}return m;
  }
  static String biomeName(ahu b){return b==null?"null":""+b.ay;}

  // Native candidate scan over a chunk window: [x,z,biomeId at the village centre].
  static List<int[]> scan(long seed,ahm type,int x0,int z0,int size,int distance)throws Exception{
    W w=world(seed,type,ahm.b,"flat");avn m=gen(w,0,distance);Method t=avn.class.getDeclaredMethod("a",int.class,int.class);t.setAccessible(true);
    List<int[]> out=new ArrayList<>();
    for(int x=x0;x<x0+size;x++)for(int z=z0;z<z0+size;z++)if((Boolean)t.invoke(m,x,z))out.add(new int[]{x,z,w.manager.a(x*16+8,z*16+8).ay});
    return out;
  }

  // One village replay: the native func_151539_a driver from `centre`, then populate calls over every sizeable start.
  static void village(String label,long seed,ahm type,String typeName,int size,int distance,String fixture,boolean flatProvider,int[] centre,int fullChunks,int fullStarts)throws Exception{
    W w=world(seed,type,flatProvider?ahm.c:ahm.b,fixture);avn m=gen(w,size,distance);
    m.a((apu)null,w,centre[0],centre[1],(aji[])null);
    String after=jstr(""+rand(m).nextLong());
    String starts=startList(m,fullStarts);
    StringBuilder rows=new StringBuilder("[");int full=0;
    List<avm> order=new ArrayList<>();for(Object o:map(m).values())order.add((avm)o);
    // Populate every chunk covering a sizeable start, once, x-outer z-inner over each start in map order.
    LinkedHashSet<String> done=new LinkedHashSet<>();List<int[]> chunkList=new ArrayList<>();
    for(avm st:order)if(st.d())for(int[] c:coverage(st.a()))if(done.add(c[0]+","+c[1]))chunkList.add(c);
    for(int[] c:chunkList){
      w.calls=MessageDigest.getInstance("SHA-1");w.writes=MessageDigest.getInstance("SHA-1");w.callCount=0;w.writeCount=0;w.entities=new ArrayList<>();w.fullWrites=full<fullChunks?new StringBuilder("["):null;
      Random r=new Random(populationSeed(seed,c[0],c[1]));boolean ok=m.a(w,r,c[0],c[1]);
      if(rows.length()>1)rows.append(',');
      rows.append("{\"chunk\":[").append(c[0]).append(',').append(c[1]).append("],\"result\":").append(ok).append(",\"writeCount\":").append(w.writeCount).append(",\"writesSha1\":").append(jstr(TerrainProbe.hex(w.writes.digest())))
        .append(",\"callCount\":").append(w.callCount).append(",\"callsSha1\":").append(jstr(TerrainProbe.hex(w.calls.digest()))).append(",\"entities\":[").append(String.join(",",w.entities)).append("],\"nextLong\":").append(jstr(""+r.nextLong()));
      if(w.fullWrites!=null&&w.writeCount>0){full++;rows.append(",\"writes\":").append(w.fullWrites).append(']');}
      rows.append('}');
    }
    System.out.println("{\"kind\":\"village\",\"label\":"+jstr(label)+",\"worldSeed\":"+jstr(""+seed)+",\"type\":"+jstr(typeName)+",\"size\":"+size+",\"distance\":"+distance+",\"fixture\":"+jstr(fixture)+",\"flatProvider\":"+flatProvider
      +",\"centre\":["+centre[0]+","+centre[1]+"],\"randomAfter\":"+after+",\"keys\":"+keys(m)+",\"starts\":"+starts+",\"chunks\":"+rows+"],\"tiles\":"+w.tileList()+",\"startsAfter\":"+startList(m,0)+"}");
  }
  static String keys(ave m)throws Exception{StringBuilder k=new StringBuilder("[");for(Object o:map(m).values()){avm st=(avm)o;if(k.length()>1)k.append(',');k.append('[').append(st.e()).append(',').append(st.f()).append(']');}return k.append(']').toString();}

  // ItemDoor.func_150924_a over every facing and every air/stone/door state of the four neighbour blocks.
  static void doors()throws Exception{
    StringBuilder rows=new StringBuilder("[");int[] states={0,1,64};
    for(int facing=0;facing<4;facing++)for(int s=0;s<81;s++){
      W w=world(0,ahm.b,ahm.b,"flat");int dx=0,dz=0;if(facing==0)dz=1;if(facing==1)dx=-1;if(facing==2)dz=-1;if(facing==3)dx=1;
      int[] st=new int[4];int t=s;for(int i=0;i<4;i++){st[i]=states[t%3];t/=3;}
      w.edits.put(key(5-dx,70,5-dz),aji.e(st[0]));w.edits.put(key(5-dx,71,5-dz),aji.e(st[1]));w.edits.put(key(5+dx,70,5+dz),aji.e(st[2]));w.edits.put(key(5+dx,71,5+dz),aji.e(st[3]));
      w.fullWrites=new StringBuilder("[");ach.a(w,5,70,5,facing,ajn.ao);
      if(rows.length()>1)rows.append(',');
      rows.append('[').append(facing).append(',').append(st[0]).append(',').append(st[1]).append(',').append(st[2]).append(',').append(st[3]).append(',').append(w.fullWrites).append("],").append(w.callCount).append(',').append(jstr(TerrainProbe.hex(w.calls.digest()))).append(']');
    }
    System.out.println("{\"kind\":\"door\",\"cases\":"+rows+"]}");
  }

  static void config()throws Exception{
    StringBuilder mats=new StringBuilder("[");for(int id=0;id<256;id++){aji b=aji.e(id);if(id>0)mats.append(',');mats.append('[').append(id).append(',').append(b.o()==awt.a).append(',').append(b.o().d()).append(',').append(b.o().c()).append(',').append(b.r()).append(',').append(b.o()==awt.j).append(']');}
    StringBuilder loot=new StringBuilder("[");for(qx row:(qx[])TerrainProbe.field(avz.class,"a").get(null)){if(loot.length()>1)loot.append(',');add st=(add)TerrainProbe.get(row,"b");loot.append('[').append(stack(st)).append(',').append(TerrainProbe.get(row,"c")).append(',').append(TerrainProbe.get(row,"d")).append(',').append(TerrainProbe.get(row,"a")).append(',').append(st.e()).append(']');}
    StringBuilder ids=new StringBuilder("{");String[] names={"a","d","e","f","g","i","j","k","n","r","s","z","A","F","J","L","T","U","X","Z","aB","aJ","aY","aZ","aa","ad","ae","ai","aj","ak","al","ao","ap","aq","ar","at","av","aw","bC","bM","bN","bg","bl","bz"};
    for(String n:names){if(ids.length()>1)ids.append(',');ids.append(jstr(n)).append(':').append(aji.b((aji)TerrainProbe.field(ajn.class,n).get(null)));}
    // Desert substitution as awd.b(aji,int) / awd.c(aji,int) on a piece with Desert set.
    Object desertPiece=TerrainProbe.unsafe.allocateInstance(avq.class);declared(awd.class,"b").setBoolean(desertPiece,true);
    Method mb=awd.class.getDeclaredMethod("b",aji.class,int.class),mc=awd.class.getDeclaredMethod("c",aji.class,int.class);mb.setAccessible(true);mc.setAccessible(true);
    StringBuilder sub=new StringBuilder("[");
    for(int id=0;id<256;id++)for(int meta=0;meta<16;meta++){aji b=aji.e(id);aji nb=(aji)mb.invoke(desertPiece,b,meta);int nm=(Integer)mc.invoke(desertPiece,b,meta);
      if(nb!=b||nm!=meta){if(sub.length()>1)sub.append(',');sub.append('[').append(id).append(',').append(meta).append(',').append(aji.b(nb)).append(',').append(nm).append(']');}}
    StringBuilder prof=new StringBuilder("[");
    Method pm=awd.class.getDeclaredMethod("b",int.class);pm.setAccessible(true);
    for(Class<?> c:new Class<?>[]{avq.class,avy.class,avz.class,avv.class,avr.class,avs.class,avt.class,avw.class,avx.class,awc.class,awf.class,awb.class}){
      Object p=TerrainProbe.unsafe.allocateInstance(c);if(prof.length()>1)prof.append(',');
      prof.append('[').append(jstr(c.getName())).append(',').append(pm.invoke(p,0)).append(',').append(pm.invoke(p,1)).append(',').append(pm.invoke(p,2)).append(']');}
    System.out.println("{\"kind\":\"config\",\"materials\":"+mats+"],\"loot\":"+loot+"],\"blocks\":"+ids+"},\"desert\":"+sub+"],\"professions\":"+prof+"],\"villageBiomes\":"+biomes(avn.e)+",\"size\":"+TerrainProbe.get(gen(world(0,ahm.b,ahm.b,"flat"),0,32),"f")+",\"providerLevels\":["+world(0,ahm.b,ahm.b,"flat").t.i()+","+world(0,ahm.b,ahm.c,"flat").t.i()+"]}");
  }
  static String biomes(List l){StringJoiner s=new StringJoiner(",","[","]");for(Object o:l)s.add(""+((ahu)o).ay);return s.toString();}

  public static void main(String[] args)throws Exception{
    Field uf=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");uf.setAccessible(true);TerrainProbe.unsafe=(sun.misc.Unsafe)uf.get(null);aji.p();adb.l();
    String mode=args.length>0?args[0]:"run";
    if(mode.equals("scan")){
      // scan <distance> <type> <window size>: candidate chunks per seed as x,z:biomeId.
      int distance=args.length>1?Integer.parseInt(args[1]):32;ahm t=args.length>2&&args[2].equals("largeBiomes")?ahm.d:ahm.b;int size=args.length>3?Integer.parseInt(args[3]):96;
      for(long seed:new long[]{0,17,8675309,-123456789,1,2,3,4,5,6,7,8,9,10,11,12,42,100,1000,99999,Long.MIN_VALUE,Long.MAX_VALUE}){
        StringBuilder s=new StringBuilder();for(int[] c:scan(seed,t,-size/2,-size/2,size,distance))s.append(' ').append(c[0]).append(',').append(c[1]).append(':').append(c[2]);
        System.out.println(seed+" "+TerrainProbe.type(t)+s);}
      return;
    }
    config();doors();
    for(String[] spec:CASES){
      long seed=Long.parseLong(spec[1]);ahm t=spec[2].equals("amplified")?ahm.e:spec[2].equals("largeBiomes")?ahm.d:ahm.b;
      village(spec[0],seed,t,spec[2],Integer.parseInt(spec[3]),Integer.parseInt(spec[4]),spec[5],spec[6].equals("flat"),new int[]{Integer.parseInt(spec[7]),Integer.parseInt(spec[8])},Integer.parseInt(spec[9]),Integer.parseInt(spec[10]));
    }
  }
  // label, seed, type, size, distance, fixture, provider, centre x, centre z, full-write chunks, full-piece starts. Candidates come from the scan mode.
  static String[][] CASES={{"plains-hills-a","8675309","default","0","32","hills","normal","7","-10","6","99"},{"plains-size1","8675309","default","1","32","hills","normal","44","-9","0","99"},{"plains-neg-neg-seed","-123456789","default","0","32","hills","normal","1","-9","0","99"},{"plains-flat-small","-123456789","default","0","32","flat","normal","-17","-19","99","99"},{"savanna-hills","4","default","0","32","hills","normal","44","17","3","99"},{"savanna-neg-x-flat","11","default","0","32","flat","normal","-24","21","99","99"},{"desert-dunes-neg-x","11","default","0","32","dunes","normal","-19","34","4","99"},{"desert-dunes-size2","11","default","2","32","dunes","normal","17","41","12","99"},{"desert-invalid-start","10","default","0","32","dunes","normal","4","-26","0","99"},{"plains-size1-hills","9","default","1","32","hills","normal","19","-26","99","99"},{"plains-flat-provider","100","default","0","32","hills","flat","17","0","0","99"},{"plains-size3-neg-x","17","default","3","32","hills","normal","-25","5","0","99"},{"plains-neg-neg-dunes","8675309","default","0","32","dunes","normal","-47","-18","0","99"},{"plains-invalid-neg-neg","17","default","0","32","hills","normal","-32","-27","0","99"},{"plains-tiny","10","default","0","32","hills","normal","11","33","99","99"},{"plains-tiny-b","8675309","default","0","32","hills","normal","-44","41","99","99"},{"plains-off-centre","-123456789","default","0","32","hills","normal","-18","-11","0","99"},{"plains-flat-flat-provider","3","default","0","32","flat","flat","44","9","0","99"},{"distance12-three-villages","100","default","0","12","hills","normal","8","-4","6","99"},{"distance12-size1-dunes","9","default","1","12","dunes","normal","-5","-16","0","99"},{"distance12-two-villages","-123456789","default","0","12","hills","normal","8","-4","0","99"},{"distance12-desert","10","default","0","12","dunes","normal","10","-20","0","99"},{"largeBiomes-plains","100","largeBiomes","0","32","hills","normal","33","-17","3","99"},{"largeBiomes-neg","0","largeBiomes","0","32","flat","normal","-25","21","0","99"},{"distance12-size1-hills","99999","default","1","12","hills","normal","7","-20","0","99"}};
}
