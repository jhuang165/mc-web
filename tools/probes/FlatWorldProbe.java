import java.lang.reflect.*;
import java.security.MessageDigest;
import java.util.*;
import sun.misc.Unsafe;

// Unchanged 1.7.10 FlatGeneratorInfo (ass/ast), GuiFlatPresets entries (bdq/bdr), ChunkProviderFlat.provideChunk (aqu),
// WorldChunkManagerHell (aie) and the bonus chest (WorldServer.k + WorldGeneratorBonusChest arg + mt.U contents).
public class FlatWorldProbe {
  static Unsafe unsafe;
  static String q(String s){
    if(s==null)return "null";StringBuilder b=new StringBuilder("\"");
    for(char c:s.toCharArray()){if(c=='"'||c=='\\')b.append('\\').append(c);else if(c<32||c>126)b.append(String.format("\\u%04x",(int)c));else b.append(c);}
    return b.append('"').toString();
  }
  static Object get(Object o,Class<?> c,String n)throws Exception{Field f=c.getDeclaredField(n);f.setAccessible(true);return f.get(o);}
  static String hex(byte[] a){StringBuilder s=new StringBuilder();for(byte b:a)s.append(String.format("%02x",b&255));return s.toString();}
  static String stack(add s){return s==null?"null":"["+adb.b(s.b())+","+s.b+","+s.k()+"]";}
  static int id(aji b){return b==null?-1:aji.b(b);}
  static Object staticField(String ref)throws Exception{String[] p=ref.split("\\.");Field f=Class.forName(p[0]).getDeclaredField(p[1]);f.setAccessible(true);return f.get(null);}
  static String info(ass a)throws Exception{
    StringBuilder s=new StringBuilder("{\"string\":"+q(a.toString())+",\"biome\":"+a.a()+",\"height\":"+heightSum(a)+",\"layers\":[");
    boolean first=true;
    for(Object o:a.c()){ast l=(ast)o;if(!first)s.append(',');first=false;s.append("["+id(l.b())+","+l.c()+","+l.a()+","+l.d()+"]");}
    s.append("],\"features\":[");first=true;
    for(Object e:a.b().entrySet()){Map.Entry<?,?> en=(Map.Entry<?,?>)e;if(!first)s.append(',');first=false;
      s.append("["+q((String)en.getKey())+",[");boolean f2=true;
      for(Object p:((Map<?,?>)en.getValue()).entrySet()){Map.Entry<?,?> pe=(Map.Entry<?,?>)p;if(!f2)s.append(',');f2=false;s.append("["+q((String)pe.getKey())+","+q((String)pe.getValue())+"]");}
      s.append("]]");}
    return s.append("]}").toString();
  }
  static int heightSum(ass a){int n=0;for(Object o:a.c())n+=((ast)o).a();return n;}
  static class P extends aqo { public String l(){return "probe";} }
  static class Chest extends aow {
    List<String> calls=new ArrayList<>();
    public void a(int slot,add s){calls.add("["+slot+","+stack(s)+"]");super.a(slot,s);}
    public void e(){}
  }
  public static class W extends ahb {
    long seed; aib manager; aqu gen; Map<String,apx> chunks=new HashMap<>(); Map<String,aji> edits=new HashMap<>(); Map<String,aor> tiles=new HashMap<>(); StringBuilder writes=new StringBuilder("[");
    W(){super((azc)null,null,(aqo)null,(ahj)null,null);}
    protected apu j(){return null;}protected int p(){return 0;}public sa a(int id){return null;}
    public long H(){return seed;} public aib v(){return manager;}
    static String key(int x,int y,int z){return x+","+y+","+z;}
    public apx d(int bx,int bz){int cx=bx>>4,cz=bz>>4;return chunks.computeIfAbsent(cx+","+cz,k->gen.d(cx,cz));}
    public aji a(int x,int y,int z){if(y<0||y>=256)return ajn.a;aji e=edits.get(key(x,y,z));if(e!=null)return e;return d(x,z).a(x&15,y,z&15);}
    public boolean c(int x,int y,int z){return a(x,y,z)==ajn.a;}
    public boolean d(int x,int y,int z,aji b,int meta,int flags){
      if(y<0||y>=256)return false;edits.put(key(x,y,z),b);if(writes.length()>1)writes.append(',');
      writes.append("["+x+","+y+","+z+","+aji.b(b)+","+meta+","+flags+"]");tiles.remove(key(x,y,z));if(b==ajn.ae)tiles.put(key(x,y,z),new Chest());return true;}
    public aor o(int x,int y,int z){return tiles.get(key(x,y,z));}
  }
  static W world(long seed,String preset,boolean features)throws Exception{
    W w=(W)unsafe.allocateInstance(W.class);w.seed=seed;w.chunks=new HashMap<>();w.edits=new HashMap<>();w.tiles=new HashMap<>();w.writes=new StringBuilder("[");
    w.s=new Random(seed);
    for(Field f:ahb.class.getDeclaredFields())if(!Modifier.isStatic(f.getModifiers())&&f.getType()==List.class){f.setAccessible(true);f.set(w,new ArrayList<>());}
    Field t=ahb.class.getDeclaredField("t");t.setAccessible(true);t.set(w,unsafe.allocateInstance(P.class));
    ass i=ass.a(preset);w.manager=new aie(ahu.d(i.a()),0.5f);
    w.gen=new aqu(w,seed,features,preset);Field v=ahb.class.getDeclaredField("v");v.setAccessible(true);v.set(w,w.gen);return w;
  }
  static String hashChunk(apx c,boolean meta)throws Exception{
    MessageDigest h=MessageDigest.getInstance("SHA-1");
    for(int x=0;x<16;x++)for(int z=0;z<16;z++)for(int y=0;y<256;y++){int v=meta?c.c(x,y,z):aji.b(c.a(x,y,z));h.update((byte)v);h.update((byte)(v>>8));}
    return hex(h.digest());
  }
  static void chunk(String preset,long seed,int cx,int cz)throws Exception{
    W w=world(seed,preset,false);apx c=w.gen.d(cx,cz);
    StringBuilder ids=new StringBuilder("["),meta=new StringBuilder("[");
    for(int y=0;y<256;y++){if(y>0){ids.append(',');meta.append(',');}ids.append(aji.b(c.a(3,y,5)));meta.append(c.c(3,y,5));}
    byte[] bio=c.m();int[] distinct=new int[256];for(byte b:bio)distinct[b&255]++;
    StringBuilder bs=new StringBuilder("[");for(int i=0;i<256;i++)if(distinct[i]>0){if(bs.length()>1)bs.append(',');bs.append("["+i+","+distinct[i]+"]");}
    System.out.println("{\"kind\":\"chunk\",\"preset\":"+q(preset)+",\"seed\":"+seed+",\"x\":"+cx+",\"z\":"+cz+",\"blocksSha1\":"+q(hashChunk(c,false))+",\"metaSha1\":"+q(hashChunk(c,true))+",\"column\":["+ids+"],"+meta+"]],\"biomes\":"+bs+"]}");
  }
  static void bonus(String preset,long seed,int sx,int sz)throws Exception{
    W w=world(seed,preset,false);w.s=new Random(seed);
    Field uf=mt.class.getDeclaredField("U");uf.setAccessible(true);qx[] items=(qx[])uf.get(null);
    arg gen=new arg(items,10);boolean done=false;int attempts=0;StringBuilder at=new StringBuilder("[");
    for(int i=0;i<10;i++){
      attempts++;
      int x=sx+w.s.nextInt(6)-w.s.nextInt(6);
      int z=sz+w.s.nextInt(6)-w.s.nextInt(6);
      int y=w.i(x,z)+1;
      if(at.length()>1)at.append(',');at.append("["+x+","+y+","+z+"]");
      if(gen.a(w,w.s,x,y,z)){done=true;break;}
    }
    StringBuilder chests=new StringBuilder("[");
    for(Map.Entry<String,aor> e:new TreeMap<>(w.tiles).entrySet()){if(chests.length()>1)chests.append(',');
      Chest c=(Chest)e.getValue();chests.append("["+q(e.getKey())+",["+String.join(",",c.calls)+"]]");}
    System.out.println("{\"kind\":\"bonus\",\"preset\":"+q(preset)+",\"seed\":"+seed+",\"spawn\":["+sx+","+sz+"],\"placed\":"+done+",\"attempts\":"+attempts+",\"tries\":"+at+"],\"writes\":"+w.writes+"],\"chests\":"+chests+"],\"nextLong\":"+q(""+w.s.nextLong())+"}");
  }
  static void manager()throws Exception{
    for(int biome:new int[]{1,2,4,35}){
      aie m=new aie(ahu.d(biome),0.5f);
      List<ahu> list=new ArrayList<>();for(int b:new int[]{1,4,5,18,19,21,22})list.add(ahu.d(b));
      List<ahu> villages=new ArrayList<>();for(int b:new int[]{1,2,35})villages.add(ahu.d(b));
      Random r=new Random(biome*7L);agt p=m.a(1000,-2000,112,list,r);agt p2=m.a(8,8,256,list,r);
      System.out.println("{\"kind\":\"manager\",\"biome\":"+biome+",\"viable\":"+m.a(0,0,0,villages)+",\"find\":"+(p==null?"null":"["+p.a+","+p.b+","+p.c+"]")+",\"find2\":"+(p2==null?"null":"["+p2.a+","+p2.b+","+p2.c+"]")+",\"next\":"+r.nextInt(1000)+"}");
    }
  }
  static final String[] FUZZ={"","2;7,2x3,2;1;village","2;7,2x3,2;1","2;7,2x3,2","2;7,2x3,2;","7,2x3,2","1;7,2x3,2;1","1;7,2x3,2;1;village","0;7,2x3,2;1;village","3;7,2x3,2;1","x;7,2x3,2;1","2;;1","2;1;1;lake(a=b c=d),VILLAGE(size=2 distance=9),dungeon","2;7,2x3,2;2;decoration,biome_1(x=1),","2;0;1","2;300x1;1","2;5x3:15,2:3,2x2:16,3x300;5","2;5x-2,1;1","2;256x1,1;1","2;abc;1","2;7,2x3,2;99;village","2;1x1x1;1","2;7,,2;1","2;7:x,2;1","2;3x2:1,1x35:14;8;stronghold(distance=5)","2;7,2x3,2;1;village(size=2 distance=9 a)","2;7,2x3,2;1;a(b=c)(d=e)","2;7,2x3,2;1;village(","2;7,2x3,2;1;())","2;7,2x3,2;1;vIlLaGe","2;7,2x3,2;1;;extra","2;99x7;1","2;2x1000,1;1","2;7,2x3,2;-1;village","2;7,2x3,2;300;village","2;7,2x3,2;1;lava_lake,lake,dungeon,decoration,stronghold,mineshaft,biome_1,village","2;7,2x3,2;1;zzz,aa,b,ccc,dd,eeee,ffffff,gg,hh,iii,jjj,kkk,lll,mmm","2;7,2x3,2;1;village(distance=9 size=3 x=y z=)","2;1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50;1","2;1x20:7,2x3:2,3:1;1;village","2; 7 ,2x3,2;1","2;7,2X3,2;1","2;07,2x03,02;001","2;7,2x3,2;1;village;lake","2;0x5,7;1","2;5x1x2;1;","2;7,2x3,2;1;"," ","2;+7,2x+3,2;1","2;8,9,10,11,12;1","2;7,2x3,2;0;village","2;7,2x3,2;40;village","2;7,2x3,2;255","2;7,2x3,2;256","2;7,2x3,2;1;stronghold(count=5)","2;3x0:5,1;1","2;3x300:5,1;1","2;3x1:20,1;1","2;3x1:-1,1;1","2;1,1,1,1;1;village(size=0),village(distance=12 size=2)","2;1;1;biome_1(distance=20),mineshaft(chance=0.5),stronghold(distance=40 count=2 spread=2)"};
  public static void main(String[] a)throws Exception{
    Field uf=Unsafe.class.getDeclaredField("theUnsafe");uf.setAccessible(true);unsafe=(Unsafe)uf.get(null);aji.p();adb.l();
    // Presets: GuiFlatPresets.<clinit> cannot run headless (it constructs the client RenderItem), so verify-flat-world.mjs
    // extracts each entry from that bytecode and this builds it through the same factory steps (GuiFlatPresets.func_146425_a):
    // layers added last-to-first, biome, calculateLayers, one empty HashMap per feature, ass.toString.
    Field pf=null;StringBuilder pres=new StringBuilder("[");
    List<String> presetStrings=new ArrayList<>();
    for(String line:java.nio.file.Files.readAllLines(java.nio.file.Paths.get(a[0]))){
      if(line.isEmpty())continue;String[] f=line.split("\t",-1);
      String name=f[0];adb item;
      if(f[1].startsWith("block:")){item=adb.a((aji)staticField(f[1].substring(6)));}else item=(adb)staticField(f[1].substring(5));
      ahu biome=(ahu)staticField(f[2]);ass i=new ass();
      List<ast> layers=new ArrayList<>();
      for(String l:f[4].split(";")){String[] p=l.split(":");layers.add(p.length>2?new ast(Integer.parseInt(p[0]),(aji)staticField(p[1]),Integer.parseInt(p[2])):new ast(Integer.parseInt(p[0]),(aji)staticField(p[1])));}
      for(int k=layers.size()-1;k>=0;k--)i.c().add(layers.get(k));
      i.a(biome.ay);i.d();
      if(!f[3].isEmpty())for(String feat:f[3].split(","))i.b().put(feat,new HashMap());
      String str=i.toString();presetStrings.add(str);
      if(pres.length()>1)pres.append(',');
      pres.append("{\"name\":"+q(name)+",\"item\":"+adb.b(item)+",\"string\":"+q(str)+",\"parsed\":"+info(ass.a(str))+"}");
    }
    System.out.println("{\"kind\":\"presets\",\"list\":"+pres+"]}");
    System.out.println("{\"kind\":\"default\",\"parsed\":"+info(ass.e())+",\"fromNull\":"+info(ass.a((String)null))+"}");
    for(String s:FUZZ)System.out.println("{\"kind\":\"parse\",\"input\":"+q(s)+",\"parsed\":"+info(ass.a(s))+"}");
    StringBuilder ids=new StringBuilder("[");
    for(int id=1;id<4096;id++){aji b=aji.e(id);if(b!=ajn.a){if(ids.length()>1)ids.append(',');ids.append(id);}}
    System.out.println("{\"kind\":\"blockIds\",\"ids\":"+ids+"]}");
    // BiomeGenBase.getBiome edge ids.
    StringBuilder bi=new StringBuilder("[");
    for(int id:new int[]{-5,-1,0,1,2,6,40,126,127,128,129,160,167,168,255,256,257,1000}){
      String r;try{ahu b=ahu.d(id);r=b==null?"null":""+b.ay;}catch(Throwable t){r=q(t.getClass().getSimpleName());}
      if(bi.length()>1)bi.append(',');bi.append("["+id+","+r+"]");
    }
    System.out.println("{\"kind\":\"biomeIds\",\"values\":"+bi+"]}");
    // ChunkProviderFlat terrain.
    List<String> chunkPresets=new ArrayList<>(presetStrings);chunkPresets.add("2;7,2x3,2;1;village");chunkPresets.add("2;1x20:7,2x3:2,3:1,300;8");chunkPresets.add("2;5x1,1x35:14,0x4,159:3;2");
    for(String p:chunkPresets){chunk(p,1L,0,0);chunk(p,-91L,-3,5);}
    manager();
    // Bonus chest contents (WorldServer.bonusChestContent).
    Field uf2=mt.class.getDeclaredField("U");uf2.setAccessible(true);qx[] items=(qx[])uf2.get(null);StringBuilder bc=new StringBuilder("[");
    for(qx it:items){Class<?> c=qx.class;add st=(add)get(it,c,"b");int min=(Integer)get(it,c,"c"),max=(Integer)get(it,c,"d");int weight=(Integer)get(it,qw.class,"a");
      if(bc.length()>1)bc.append(',');bc.append("["+stack(st)+","+min+","+max+","+weight+"]");}
    System.out.println("{\"kind\":\"bonusContents\",\"items\":"+bc+"],\"count\":10}");
    long[] seeds={0,1,42,-7,8675309};int[][] spawns={{0,0},{8,-40},{-100,33},{250,250},{17,-4}};
    for(String p:chunkPresets.subList(0,presetStrings.size())){
      for(int i=0;i<seeds.length;i++)bonus(p,seeds[i],spawns[i][0],spawns[i][1]);
    }
  }
}
