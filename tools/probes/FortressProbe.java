import java.lang.reflect.*;
import java.security.MessageDigest;
import java.util.*;

// Unchanged 1.7.10 MapGenNetherBridge (atd), MapGenNetherBridge.Start (ate), StructureNetherBridgePieces (atf) with its
// PieceWeight (att), the base piece (ats) and every fortress piece (atg..atv, start piece atw), on top of the unchanged
// MapGenBase/MapGenStructure/StructureStart/StructureComponent framework (aqx/ave/avm/avk/asv).
// Records: config (weights, spawn list, chest loot, block ids), placement (atd.a(II) scan), starts (the real
// MapGenBase driver on a Nether world double: piece lists with bounding boxes), population (the unchanged ChunkProviderHell
// aqv with its real atd over NetherProbe's chunk-backed World: per-populate write/call hashes, area hashes, chest/spawner
// tiles, structure spawn-list probes).
public class FortressProbe {
  static String q(String s){return TerrainProbe.q(s);}
  static class P extends atd { boolean test(int x,int z){return a(x,z);} }
  static P placer(long seed)throws Exception{P m=new P();m.c=NetherProbe.world(seed);return m;}
  static String saveId(avk p){
    return p instanceof atw?"NeStart":p instanceof atg?"NeBCr":p instanceof ath?"NeBEF":p instanceof ati?"NeBS":p instanceof atj?"NeCCS":p instanceof atk?"NeCTB":p instanceof atl?"NeCE":p instanceof atm?"NeSCSC":p instanceof atn?"NeSCLT":p instanceof ato?"NeSC":p instanceof atp?"NeSCRT":p instanceof atq?"NeCSR":p instanceof atr?"NeMT":p instanceof atu?"NeRC":p instanceof atv?"NeSR":null;
  }
  static String saveId0(Class<?> c){
    return c==atw.class?"NeStart":c==atg.class?"NeBCr":c==ath.class?"NeBEF":c==ati.class?"NeBS":c==atj.class?"NeCCS":c==atk.class?"NeCTB":c==atl.class?"NeCE":c==atm.class?"NeSCSC":c==atn.class?"NeSCLT":c==ato.class?"NeSC":c==atp.class?"NeSCRT":c==atq.class?"NeCSR":c==atr.class?"NeMT":c==atu.class?"NeRC":c==atv.class?"NeSR":c.getName();
  }
  static String bb(asv b){return "["+b.a+","+b.b+","+b.c+","+b.d+","+b.e+","+b.f+"]";}
  static String piece(avk p)throws Exception{
    String type=saveId(p);if(type==null)throw new AssertionError(p.getClass().getName());asv b=p.c();
    StringBuilder s=new StringBuilder("[").append(q(type)).append(',').append(p.g).append(',').append(p.h).append(',').append(b.a).append(',').append(b.b).append(',').append(b.c).append(',').append(b.d).append(',').append(b.e).append(',').append(b.f);
    if(p instanceof ath)s.append(',').append(TerrainProbe.field(ath.class,"b").get(p));
    else if(p instanceof atn)s.append(',').append(TerrainProbe.field(atn.class,"b").get(p));
    else if(p instanceof atp)s.append(',').append(TerrainProbe.field(atp.class,"b").get(p));
    else if(p instanceof atr)s.append(',').append(TerrainProbe.field(atr.class,"b").get(p));
    return s.append(']').toString();
  }
  static String pieces(avm st)throws Exception{StringBuilder s=new StringBuilder("[");for(Object o:st.b()){if(s.length()>1)s.append(',');s.append(piece((avk)o));}return s.append(']').toString();}
  static Map<?,?> map(ave m)throws Exception{return (Map<?,?>)TerrainProbe.field(ave.class,"d").get(m);}
  static Random rand(aqx m)throws Exception{return (Random)TerrainProbe.field(aqx.class,"b").get(m);}
  static String startList(ave m,int full)throws Exception{
    StringBuilder s=new StringBuilder("[");int n=0;
    for(Object o:map(m).values()){avm st=(avm)o;if(s.length()>1)s.append(',');String p=pieces(st);
      s.append("{\"chunk\":[").append(st.e()).append(',').append(st.f()).append("],\"bb\":").append(bb(st.a())).append(",\"pieceCount\":").append(st.b().size()).append(",\"piecesSha1\":").append(q(StrongholdProbe.sha(p)));
      if(n++<full)s.append(",\"pieces\":").append(p);s.append('}');}
    return s.append(']').toString();
  }
  static String entityName(Class<?> c){return c==xx.class?"Blaze":c==yh.class?"PigZombie":c==yl.class?"Skeleton":c==yf.class?"LavaSlime":c.getName();}
  static String spawnList(List<?> l)throws Exception{
    StringBuilder s=new StringBuilder("[");
    for(Object o:l){ahx e=(ahx)o;if(s.length()>1)s.append(',');s.append('[').append(q(entityName(e.b))).append(',').append(TerrainProbe.get(e,"a")).append(',').append(e.c).append(',').append(e.d).append(']');}
    return s.append(']').toString();
  }
  static void config()throws Exception{
    StringBuilder ids=new StringBuilder("{");String[] names={"bj","bk","bl","bm","aM","k","ac","ae"};
    for(String n:names){if(ids.length()>1)ids.append(',');ids.append(q(n)).append(':').append(aji.b((aji)TerrainProbe.field(ajn.class,n).get(null)));}
    StringBuilder weights=new StringBuilder("[");
    for(String f:new String[]{"a","b"}){
      if(weights.length()>1)weights.append(',');StringBuilder l=new StringBuilder("[");
      for(att w:(att[])TerrainProbe.field(atf.class,f).get(null)){
        if(l.length()>1)l.append(',');
        l.append('[').append(q(saveId0(w.a))).append(',').append(w.b).append(',').append(w.d).append(',').append(w.e).append(']');
      }
      weights.append(l).append(']');
    }
    weights.append(']');
    P m=placer(0);
    System.out.println("{\"kind\":\"config\",\"blocks\":"+ids+"},\"weights\":"+weights+",\"loot\":"+StrongholdProbe.lootTable(ats.class,"a")+",\"spawnList\":"+spawnList(m.b())+",\"structureName\":"+q(m.a())+"}");
  }
  // 1. atd.a(II) over square chunk ranges.
  static void placement(long seed,int x0,int z0,int n)throws Exception{
    P m=placer(seed);StringBuilder hits=new StringBuilder("[");
    for(int x=x0;x<x0+n;x++)for(int z=z0;z<z0+n;z++)if(m.test(x,z)){if(hits.length()>1)hits.append(',');hits.append('[').append(x).append(',').append(z).append(']');}
    System.out.println("{\"kind\":\"placement\",\"seed\":"+q(""+seed)+",\"origin\":["+x0+","+z0+"],\"size\":"+n+",\"hits\":"+hits+"]}");
  }
  static int[][] hits(long seed,int x0,int z0,int n)throws Exception{
    P m=placer(seed);List<int[]> l=new ArrayList<>();
    for(int x=x0;x<x0+n;x++)for(int z=z0;z<z0+n;z++)if(m.test(x,z))l.add(new int[]{x,z});
    return l.toArray(new int[0][]);
  }
  // 2. Real MapGenBase driver (ave.a(apu,ahb,II[aji)).
  static void starts(long seed,String label,int[][] centers,int full)throws Exception{
    NetherProbe.H w=NetherProbe.world(seed);atd m=new atd();StringBuilder after=new StringBuilder("[");
    for(int[] c:centers){m.a((apu)null,w,c[0],c[1],(aji[])null);if(after.length()>1)after.append(',');after.append(q(""+rand(m).nextLong()));}
    StringBuilder cs=new StringBuilder("[");for(int[] c:centers){if(cs.length()>1)cs.append(',');cs.append('[').append(c[0]).append(',').append(c[1]).append(']');}
    System.out.println("{\"kind\":\"starts\",\"label\":"+q(label)+",\"worldSeed\":"+q(""+seed)+",\"centers\":"+cs+"],\"randomAfter\":"+after+"],\"starts\":"+startList(m,full)+"}");
  }
  static String tiles(NetherProbe.H w,int cx,int cz,int size)throws Exception{
    StringBuilder s=new StringBuilder("[");
    for(int x=cx*16;x<(cx+size)*16;x++)for(int z=cz*16;z<(cz+size)*16;z++)for(int y=0;y<256;y++){
      aji b=w.a(x,y,z);int id=aji.b(b);if(id!=54&&id!=52)continue;
      aor t=w.o(x,y,z);if(s.length()>1)s.append(',');
      s.append('[').append(x).append(',').append(y).append(',').append(z).append(',');
      if(t==null)s.append("null");
      else if(t instanceof aow){aow c=(aow)t;s.append(q("chest")).append(",[");for(int i=0;i<27;i++){if(i>0)s.append(',');s.append(StrongholdProbe.stack(c.a(i)));}s.append(']');}
      else s.append(q("spawner")).append(',').append(q(((apj)t).a().e()));
      s.append(']');
    }
    return s.append(']').toString();
  }
  // 3. Populate real ChunkProviderHell with its real fortress generator over a window around a native fortress start.
  static void population(String label,long seed,int[] hit,int size,int popSize)throws Exception{
    int cx=hit[0]-2,cz=hit[1]-2;
    NetherProbe.H w=NetherProbe.world(seed);aqv gen=NetherProbe.provider(w,seed,false);w.halo=NetherProbe.provider(w,seed,false);
    List<String> inputs=new ArrayList<>(),steps=new ArrayList<>();
    for(int x=cx;x<cx+size;x++)for(int z=cz;z<cz+size;z++){apx c=gen.d(x,z);c.d=true;w.chunks.put(SpringProbe.G.ck(x,z),c);inputs.add("["+x+","+z+","+q(NetherProbe.chunkHash(c))+"]");}
    atd bridge=(atd)gen.c;
    String startsBefore=startList(bridge,0);
    for(int x=cx;x<cx+popSize;x++)for(int z=cz;z<cz+popSize;z++){
      w.calls=MessageDigest.getInstance("SHA-1");w.writes=MessageDigest.getInstance("SHA-1");w.callCount=0;w.writeCount=0;
      String traceDir=System.getenv("FORTRESS_TRACE");if(traceDir!=null)w.trace=new StringBuilder();
      gen.a(gen,x,z);
      if(traceDir!=null)java.nio.file.Files.write(java.nio.file.Paths.get(traceDir,label+"-"+x+"-"+z+".txt"),w.trace.toString().getBytes());
      steps.add("{\"chunk\":["+x+","+z+"],\"calls\":"+w.callCount+",\"callSha1\":"+q(TerrainProbe.hex(w.calls.digest()))+",\"writes\":"+w.writeCount+",\"writeSha1\":"+q(TerrainProbe.hex(w.writes.digest()))+"}");
    }
    List<String> area=new ArrayList<>();for(int x=cx;x<cx+size;x++)for(int z=cz;z<cz+size;z++)area.add(q(NetherProbe.chunkHash(w.e(x,z))));
    String pendingNow=w.pending.toString();long hellNext=((Random)TerrainProbe.get(gen,"i")).nextLong(),worldNext=w.s.nextLong();
    // Fortress spawn-list probes (aqv.a(sx,x,y,z)): points over the populated area, on and beside pieces.
    List<String> spawn=new ArrayList<>();int nFort=0;
    List<int[]> pts=new ArrayList<>();
    for(Object o:map(bridge).values()){avm st=(avm)o;
      for(Object po:st.b()){avk p=(avk)po;asv b=p.c();pts.add(new int[]{(b.a+b.d)/2,(b.b+b.e)/2,(b.c+b.f)/2});pts.add(new int[]{(b.a+b.d)/2,b.b-1,(b.c+b.f)/2});pts.add(new int[]{b.a,b.b+1,b.c});pts.add(new int[]{b.d+1,b.b+1,(b.c+b.f)/2});}
    }
    Random pr=new Random(seed^0x5eedL);int lo=(cx+1)*16,hi=(cx+popSize-1)*16;
    for(int i=0;i<40;i++)pts.add(new int[]{lo+pr.nextInt(hi-lo),48+pr.nextInt(40),(cz+1)*16+pr.nextInt((popSize-2)*16)});
    List<String> spawnRows=new ArrayList<>();
    for(int[] p:pts){
      if(Math.floorDiv(p[0],16)<cx||Math.floorDiv(p[0],16)>=cx+size||Math.floorDiv(p[2],16)<cz||Math.floorDiv(p[2],16)>=cz+size)continue;
      if(p[1]<1||p[1]>254)continue;
      int r;try{List<?> l=gen.a(sx.a,p[0],p[1],p[2]);r=l==bridge.b()?1:0;}catch(Throwable e){r=-1;}
      spawnRows.add("["+p[0]+","+p[1]+","+p[2]+","+r+"]");if(r==1)nFort++;
    }
    System.out.println("{\"kind\":\"population\",\"label\":"+q(label)+",\"seed\":"+q(""+seed)+",\"hit\":["+hit[0]+","+hit[1]+"],\"origin\":["+cx+","+cz+"],\"size\":"+size+",\"populated\":"+popSize+",\"inputs\":["+String.join(",",inputs)
      +"],\"startsBefore\":"+startsBefore+",\"steps\":["+String.join(",",steps)+"],\"areaSha1\":["+String.join(",",area)+"],\"tiles\":"+tiles(w,cx,cz,size)+",\"startsAfter\":"+startList(bridge,0)
      +",\"spawnProbes\":["+String.join(",",spawnRows)+"],\"pending\":["+pendingNow+"],\"hellNextLong\":"+q(""+hellNext)+",\"worldNextLong\":"+q(""+worldNext)+"}");
  }
  public static void main(String[] args)throws Exception{
    Field uf=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");uf.setAccessible(true);TerrainProbe.unsafe=(sun.misc.Unsafe)uf.get(null);aji.p();adb.l();
    config();
    long[] seeds={0,17,8675309,-123456789,Long.MIN_VALUE,Long.MAX_VALUE,1,2,3,5,7,11,-1,-42,123456789012345L,99999};
    for(long s:seeds){placement(s,-64,-64,128);placement(s,100000-32,-200000-32,64);}
    for(long s:seeds){
      int[][] h=hits(s,-64,-64,128);if(h.length<3)throw new AssertionError("few hits "+s);
      int[][] centers={h[0],{h[0][0]+5,h[0][1]-3},h[1],{h[1][0]-8,h[1][1]+8},h[2]};
      starts(s,"native",centers,(s==0||s==17||s==8675309)?2:1);
    }
    // Real Nether populations around native fortress starts.
    int k=0;
    for(long s:new long[]{0,17,8675309,-123456789,2,1}){
      int[][] h=hits(s,-64,-64,128);
      population("fortress-"+(k++)+":"+h[0][0]+","+h[0][1],s,h[0],6,5);
    }
    int[][] h=hits(8675309,-64,-64,128);population("fortress-"+(k++)+":"+h[1][0]+","+h[1][1],8675309,h[1],6,5);
    h=hits(0,-64,-64,128);population("fortress-"+(k++)+":"+h[1][0]+","+h[1][1],0,h[1],6,5);
  }
}
