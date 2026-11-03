import java.lang.reflect.*;
import java.security.MessageDigest;
import java.util.*;

// Unchanged 1.7.10 MapGenStronghold (aug), MapGenStronghold.Start (auh), StructureStrongholdPieces (aui) with its
// PieceWeight/Stones/Door helpers (aur/auj/auk/auw/avd) and every stronghold piece (aum aun auo aup auq aus aut auu auv
// auy auz ava avb on the avc base), on top of the unchanged MapGenBase/MapGenStructure/StructureStart/StructureComponent
// framework (aqx/ave/avm/avk/asv). The World is an explicit block-access double: synthetic fixtures or native
// terrain/surface/cave/ravine chunks. MapGenStructureData persistence is stubbed (loadItemData null, setItemData ignored).
public class StrongholdProbe {
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
  // Synthetic fixtures, mirrored in src/structure-framework-fixture.js.
  static int fixture(String f,int x,int y,int z){
    if(f.equals("air"))return 0;
    if(y>63)return 0;
    if(f.equals("stone"))return 1;
    if(f.equals("water"))return Math.floorMod(x*7+z*13,97)==0&&y>=20&&y<=60?9:1;
    int k=hash3(x>>1,y>>1,z>>1)&15;
    return k<=2?0:k==3?20:k==4?13:k==5?18:1; // pockets: air, glass, gravel, leaves, stone
  }
  static class Chest extends aow {
    List<String> calls=new ArrayList<>();
    public void a(int slot,add s){calls.add("["+slot+","+stack(s)+"]");super.a(slot,s);}
    public void e(){}
  }
  static class W extends TerrainProbe.W {
    String fixture;Map<String,aji[]> chunks;Map<String,aji> edits=new HashMap<>();Map<String,aor> tiles=new LinkedHashMap<>();
    MessageDigest calls,writes,cur;int callCount,writeCount;StringBuilder fullWrites;
    void call(int... a){callCount++;put(calls,a);}
    public aji a(int bx,int by,int bz){call(0,bx,by,bz);if(by<0||by>=256||bx< -30000000||bx>=30000000||bz< -30000000||bz>=30000000)return aji.e(0);
      aji edit=edits.get(key(bx,by,bz));if(edit!=null)return edit;
      if(fixture.equals("natural")){aji[] c=chunks.get((bx>>4)+","+(bz>>4));if(c==null)throw new AssertionError("Missing chunk "+(bx>>4)+","+(bz>>4));aji b=c[((bx&15)*16+(bz&15))*256+by];return b==null?aji.e(0):b;}
      return aji.e(fixture(fixture,bx,by,bz));
    }
    public boolean c(int x,int y,int z){call(1,x,y,z);return a(x,y,z).o()==awt.a;}
    public boolean d(int x,int y,int z,aji b,int meta,int flags){call(2,x,y,z,aji.b(b),meta,flags);if(y<0||y>=256||x< -30000000||x>=30000000||z< -30000000||z>=30000000)return false;
      String k=key(x,y,z);edits.put(k,b);writeCount++;put(writes,x,y,z,aji.b(b),meta,flags);if(cur!=null)put(cur,x,y,z,aji.b(b),meta,flags);
      if(fullWrites!=null){if(fullWrites.length()>1)fullWrites.append(',');fullWrites.append('[').append(x).append(',').append(y).append(',').append(z).append(',').append(aji.b(b)).append(',').append(meta).append(',').append(flags).append(']');}
      tiles.remove(k);if(b==ajn.ae)tiles.put(k,new Chest());if(b==ajn.ac)tiles.put(k,new apj());return true;
    }
    public ahu a(int x,int z){return manager.a(x,z);}
    public aor o(int x,int y,int z){call(4,x,y,z);return tiles.get(key(x,y,z));}
    public boolean d(sa e){throw new AssertionError("entity spawn "+e.getClass().getName());}
    public ayl a(Class c,String n){return null;}
    public void a(String n,ayl d){}
    String tileList(){StringBuilder s=new StringBuilder("[");
      for(Map.Entry<String,aor> en:tiles.entrySet()){if(s.length()>1)s.append(',');s.append('[').append(jstr(en.getKey())).append(',');
        if(en.getValue() instanceof Chest){Chest c=(Chest)en.getValue();s.append(jstr("chest")).append(",[");for(int i=0;i<27;i++){if(i>0)s.append(',');s.append(stack(c.a(i)));}s.append("],[").append(String.join(",",c.calls)).append(']');}
        else s.append(jstr("spawner")).append(',').append(jstr(((apj)en.getValue()).a().e()));s.append(']');}
      return s.append(']').toString();}
  }
  static Map<Long,aib> managers=new HashMap<>();
  static W world(long seed,String fixture)throws Exception{
    W w=(W)TerrainProbe.unsafe.allocateInstance(W.class);w.seed=seed;w.fixture=fixture;w.edits=new HashMap<>();w.tiles=new LinkedHashMap<>();
    aib m=managers.get(seed);if(m==null){m=new aib(seed,ahm.b);managers.put(seed,m);}w.manager=m;
    w.info=(ays)TerrainProbe.unsafe.allocateInstance(ays.class);
    for(Field f:ays.class.getDeclaredFields())if(f.getType()==ahm.class){f.setAccessible(true);f.set(w.info,ahm.b);}
    w.calls=MessageDigest.getInstance("SHA-1");w.writes=MessageDigest.getInstance("SHA-1");
    TerrainProbe.field(ahb.class,"t").set(w,TerrainProbe.unsafe.allocateInstance(aqq.class));
    for(Field f:ahb.class.getDeclaredFields())if(f.getType()==List.class&&!Modifier.isStatic(f.getModifiers())){f.setAccessible(true);f.set(w,new ArrayList<>());}
    return w;
  }
  static String bb(asv b){return "["+b.a+","+b.b+","+b.c+","+b.d+","+b.e+","+b.f+"]";}
  static String saveId(avk p){
    return p instanceof auz?"SHStart":p instanceof aum?"SHCC":p instanceof aun?"SHFC":p instanceof auo?"SH5C":p instanceof aup?"SHLT":p instanceof auq?"SHLi":p instanceof aus?"SHPR":p instanceof aut?"SHPH":p instanceof auu?"SHRT":p instanceof auv?"SHRC":p instanceof auy?"SHSD":p instanceof ava?"SHS":p instanceof avb?"SHSSD":null;
  }
  // Same text as JSON.stringify of the JS piece description.
  static String piece(avk p)throws Exception{
    StringBuilder s=new StringBuilder("[");asv b=p.c();String type=saveId(p);
    if(type==null)throw new AssertionError(p.getClass().getName());
    s.append(jstr(type)).append(',').append(p.g).append(',').append(p.h).append(',').append(b.a).append(',').append(b.b).append(',').append(b.c).append(',').append(b.d).append(',').append(b.e).append(',').append(b.f);
    s.append(',').append(((avd)TerrainProbe.field(avc.class,"d").get(p)).ordinal());
    if(p instanceof auz)s.append(',').append(TerrainProbe.field(auy.class,"a").get(p)).append(',').append(((auz)p).b!=null);
    else if(p instanceof auy)s.append(',').append(TerrainProbe.field(auy.class,"a").get(p));
    else if(p instanceof aum)s.append(',').append(TerrainProbe.field(aum.class,"b").get(p));
    else if(p instanceof aun)s.append(',').append(TerrainProbe.field(aun.class,"a").get(p));
    else if(p instanceof auo)s.append(',').append(TerrainProbe.field(auo.class,"a").get(p)).append(',').append(TerrainProbe.field(auo.class,"b").get(p)).append(',').append(TerrainProbe.field(auo.class,"c").get(p)).append(',').append(TerrainProbe.field(auo.class,"e").get(p));
    else if(p instanceof auq)s.append(',').append(TerrainProbe.field(auq.class,"b").get(p));
    else if(p instanceof aus)s.append(',').append(TerrainProbe.field(aus.class,"a").get(p));
    else if(p instanceof auv)s.append(',').append(TerrainProbe.field(auv.class,"a").get(p));
    else if(p instanceof ava)s.append(',').append(TerrainProbe.field(ava.class,"a").get(p)).append(',').append(TerrainProbe.field(ava.class,"b").get(p));
    return s.append(']').toString();
  }
  static String pieces(avm st)throws Exception{StringBuilder s=new StringBuilder("[");for(Object o:st.b()){if(s.length()>1)s.append(',');s.append(piece((avk)o));}return s.append(']').toString();}
  static String sha(String s)throws Exception{return TerrainProbe.hex(MessageDigest.getInstance("SHA-1").digest(s.getBytes("UTF-8")));}
  static Map<?,?> map(ave m)throws Exception{return (Map<?,?>)TerrainProbe.field(ave.class,"d").get(m);}
  static Random rand(aqx m)throws Exception{return (Random)TerrainProbe.field(aqx.class,"b").get(m);}
  static String startList(ave m,int full)throws Exception{
    StringBuilder s=new StringBuilder("[");int n=0;
    for(Object o:map(m).values()){avm st=(avm)o;if(s.length()>1)s.append(',');String p=pieces(st);
      s.append("{\"chunk\":[").append(st.e()).append(',').append(st.f()).append("],\"bb\":").append(bb(st.a())).append(",\"pieceCount\":").append(st.b().size()).append(",\"piecesSha1\":").append(jstr(sha(p)));
      if(n++<full)s.append(",\"pieces\":").append(p);s.append('}');}
    return s.append(']').toString();
  }
  static long populationSeed(long seed,int cx,int cz){Random r=new Random(seed);long a=r.nextLong()/2L*2L+1L,b=r.nextLong()/2L*2L+1L;return (long)cx*a+(long)cz*b^seed;}

  // The unchanged aug with an independent re-run of the regenerate-until-portal-room loop (same seeding as
  // MapGenBase.recursiveGenerate) to count attempts and the Random state after the start.
  static class S extends aug {
    boolean verify;List<String> log=new ArrayList<>();
    S(){super();}
    boolean test(int x,int z){return a(x,z);}
    protected avm b(int x,int z){
      avm real=super.b(x,z);
      if(verify)try{
        long seed=c.H();Random r=new Random();r.setSeed(seed);long a=r.nextLong(),b2=r.nextLong();r.setSeed((long)x*a^(long)z*b2^seed);r.nextInt();
        int attempts=0;avm s;
        do{s=new auh(c,r,x,z);attempts++;}while(s.b().isEmpty()||((auz)s.b().get(0)).b==null);
        if(!pieces(real).equals(pieces(s))||!bb(real.a()).equals(bb(s.a())))throw new AssertionError("independent start loop differs at "+x+","+z);
        log.add("["+x+","+z+","+attempts+","+jstr(""+r.nextLong())+"]");
      }catch(Exception e){throw new RuntimeException(e);}
      return real;
    }
  }
  static int[][] positions(long seed)throws Exception{
    W w=world(seed,"stone");S m=new S();m.c=w;m.test(0,0);agu[] g=(agu[])TerrainProbe.get(m,"g");
    StringBuilder pos=new StringBuilder("[");int[][] out=new int[g.length][];
    for(int i=0;i<g.length;i++){if(i>0)pos.append(',');pos.append('[').append(g[i].a).append(',').append(g[i].b).append(']');out[i]=new int[]{g[i].a,g[i].b};}
    StringBuilder coords=new StringBuilder("[");for(Object o:m.o_()){agt t=(agt)o;if(coords.length()>1)coords.append(',');coords.append('[').append(t.a).append(',').append(t.b).append(',').append(t.c).append(']');}
    System.out.println("{\"kind\":\"positions\",\"worldSeed\":"+jstr(""+seed)+",\"positions\":"+pos+"],\"coordList\":"+coords+"]}");
    return out;
  }
  // 1. Start lists over the native MapGenBase.func_151539_a driver, including the regenerate loop.
  static void starts(long seed,String label,int[][] centers,int full)throws Exception{
    W w=world(seed,"stone");S m=new S();m.verify=true;StringBuilder after=new StringBuilder("[");
    for(int[] c:centers){m.a((apu)null,w,c[0],c[1],(aji[])null);if(after.length()>1)after.append(',');after.append(jstr(""+rand(m).nextLong()));}
    StringBuilder keys=new StringBuilder("[");for(Object o:map(m).values()){avm st=(avm)o;if(keys.length()>1)keys.append(',');keys.append('[').append(st.e()).append(',').append(st.f()).append(']');}
    StringBuilder cs=new StringBuilder("[");for(int[] c:centers){if(cs.length()>1)cs.append(',');cs.append('[').append(c[0]).append(',').append(c[1]).append(']');}
    System.out.println("{\"kind\":\"starts\",\"label\":"+jstr(label)+",\"worldSeed\":"+jstr(""+seed)+",\"centers\":"+cs+"],\"randomAfter\":"+after+"],\"keys\":"+keys+"],\"attempts\":["+String.join(",",m.log)+"],\"starts\":"+startList(m,full)+"}");
  }
  // 2. Population: provideChunk's generate then populate's generateStructuresInChunk, chunk by chunk. Pass A calls the
  // unchanged MapGenStructure.generateStructuresInChunk; pass B repeats it with the same loop unrolled per piece call.
  static void populate(long seed,String fixture,String label,int[][] chunkList,Map<String,aji[]> chunks,String inputs,Set<String> fullSet,int fullLimit)throws Exception{
    W wa=world(seed,fixture),wb=world(seed,fixture);wa.chunks=chunks;wb.chunks=chunks;S ma=new S(),mb=new S();StringBuilder rows=new StringBuilder("[");int full=0;int pieceCalls=0;
    for(int[] c:chunkList){
      ma.a((apu)null,wa,c[0],c[1],(aji[])null);mb.a((apu)null,wb,c[0],c[1],(aji[])null);
      for(W w:new W[]{wa,wb}){w.calls=MessageDigest.getInstance("SHA-1");w.writes=MessageDigest.getInstance("SHA-1");w.callCount=0;w.writeCount=0;w.fullWrites=null;}
      boolean wantFull=fullSet.contains(c[0]+","+c[1])||full<fullLimit;wa.fullWrites=wantFull?new StringBuilder("["):null;
      Random ra=new Random(populationSeed(seed,c[0],c[1])),rb=new Random(populationSeed(seed,c[0],c[1]));
      boolean ok=ma.a(wa,ra,c[0],c[1]);
      int x=(c[0]<<4)+8,z=(c[1]<<4)+8;asv bb=new asv(x,z,x+15,z+15);boolean any=false;StringBuilder calls=new StringBuilder("[");int si=0;
      for(Object o:map(mb).values()){avm st=(avm)o;
        if(st.d()&&st.a().a(x,z,x+15,z+15)){
          int pi=0;Iterator<?> it=st.b().iterator();
          while(it.hasNext()){avk p=(avk)it.next();
            if(p.c().a(bb)){wb.cur=MessageDigest.getInstance("SHA-1");int w0=wb.writeCount;boolean keep=p.a(wb,rb,bb);pieceCalls++;
              if(calls.length()>1)calls.append(',');calls.append('[').append(si).append(',').append(pi).append(',').append(keep?1:0).append(',').append(wb.writeCount-w0).append(',').append(jstr(TerrainProbe.hex(wb.cur.digest()).substring(0,12))).append(']');
              wb.cur=null;if(!keep){it.remove();continue;}}
            pi++;}
          any=true;}
        si++;}
      String writesA=TerrainProbe.hex(wa.writes.digest()),writesB=TerrainProbe.hex(wb.writes.digest()),callsA=TerrainProbe.hex(wa.calls.digest()),callsB=TerrainProbe.hex(wb.calls.digest());
      long nl=ra.nextLong();
      if(ok!=any||!writesA.equals(writesB)||!callsA.equals(callsB)||wa.writeCount!=wb.writeCount||wa.callCount!=wb.callCount||nl!=rb.nextLong())throw new AssertionError("unrolled pass differs from native generateStructuresInChunk at chunk "+c[0]+","+c[1]);
      if(rows.length()>1)rows.append(',');
      rows.append("{\"chunk\":[").append(c[0]).append(',').append(c[1]).append("],\"result\":").append(ok).append(",\"writeCount\":").append(wa.writeCount).append(",\"writesSha1\":").append(jstr(writesA))
        .append(",\"callCount\":").append(wa.callCount).append(",\"callsSha1\":").append(jstr(callsA)).append(",\"nextLong\":").append(jstr(""+nl)).append(",\"calls\":").append(calls).append(']');
      if(wa.fullWrites!=null&&wa.writeCount>0){full++;rows.append(",\"writes\":").append(wa.fullWrites).append(']');}
      rows.append('}');
    }
    if(!wa.tileList().equals(wb.tileList())||!startList(ma,0).equals(startList(mb,0)))throw new AssertionError("unrolled pass tiles/starts differ");
    System.out.println("{\"kind\":\"populate\",\"label\":"+jstr(label)+",\"worldSeed\":"+jstr(""+seed)+",\"fixture\":"+jstr(fixture)+(inputs==null?"":",\"inputs\":"+inputs)+",\"pieceCalls\":"+pieceCalls+",\"chunks\":"+rows+"],\"tiles\":"+wa.tileList()+",\"startsAfter\":"+startList(ma,0)+"}");
  }
  static int[][] coverage(asv b){List<int[]> l=new ArrayList<>();
    for(int cx=Math.floorDiv(b.a-23+15,16);cx<=Math.floorDiv(b.d-8,16);cx++)for(int cz=Math.floorDiv(b.c-23+15,16);cz<=Math.floorDiv(b.f-8,16);cz++)l.add(new int[]{cx,cz});
    return l.toArray(new int[0][]);}
  // Population chunks holding the centre of the first piece of each interesting kind.
  static Set<String> interesting(avm st){
    Set<String> out=new LinkedHashSet<>(),seen=new HashSet<>();
    for(Object o:st.b()){avk p=(avk)o;String id=saveId(p);if(id.equals("SHPR")||id.equals("SHLi")||id.equals("SHCC")||id.equals("SHRC")||id.equals("SH5C")||id.equals("SHPH")||id.equals("SHSSD")){
      if(!seen.add(id))continue;asv b=p.c();out.add(Math.floorDiv((b.a+b.d)/2-8,16)+","+Math.floorDiv((b.c+b.f)/2-8,16));}}
    return out;}
  static avm firstStart(long seed,int[] p)throws Exception{W w=world(seed,"stone");S m=new S();m.a((apu)null,w,p[0],p[1],(aji[])null);
    for(Object o:map(m).values()){avm st=(avm)o;if(st.e()==p[0]&&st.f()==p[1])return st;}throw new AssertionError("no start at "+p[0]+","+p[1]);}
  static Map<String,aji[]> naturalChunks(long seed,int cx0,int cz0,int n,StringBuilder inputs)throws Exception{
    W base=world(seed,"stone");
    Map<String,aji[]> chunks=new HashMap<>();inputs.append('[');TerrainProbe.resetMesa();aqz terrain=new aqz(base,seed,false);aqw caves=new aqw();aqs ravines=new aqs();
    for(int x=cx0;x<cx0+n;x++)for(int z=cz0;z<cz0+n;z++){
      aji[] blocks=new aji[65536];byte[] meta=new byte[65536];((Random)TerrainProbe.get(terrain,"i")).setSeed((long)x*341873128712L+(long)z*132897987541L);
      axl.a();terrain.a(x,z,blocks);axl.a();terrain.a(x,z,blocks,meta,base.manager.b(null,x*16,z*16,16,16));caves.a(null,base,x,z,blocks);ravines.a(null,base,x,z,blocks);chunks.put(x+","+z,blocks);
      if(inputs.length()>1)inputs.append(',');inputs.append('[').append(x).append(',').append(z).append(',').append(jstr(TerrainProbe.hash(blocks))).append(']');
    }
    inputs.append(']');return chunks;
  }
  // 3. Stronghold.placeDoor and the block selector exercised directly.
  static class D extends avc {
    D(int mode,asv b){super(0);g=mode;f=b;}
    protected void a(dh d){} protected void b(dh d){}
    public boolean a(ahb w,Random r,asv b){return true;}
    void door(W w,asv clip,avd door,int x,int y,int z){a(w,new Random(0),clip,door,x,y,z);}
  }
  static void doors()throws Exception{
    StringBuilder rows=new StringBuilder("[");
    for(int mode=0;mode<=3;mode++)for(avd door:avd.values()){
      W w=world(0,"stone");w.fullWrites=new StringBuilder("[");asv b=asv.a(37,30,-21,-1,-1,0,9,7,11,mode);D d=new D(mode,b);
      d.door(w,new asv(b.a-2,b.c-2,b.d+2,b.f+2),door,1,1,0);d.door(w,new asv(b.a-2,b.c-2,b.d+2,b.f+2),door,4,3,0);
      if(rows.length()>1)rows.append(',');rows.append('[').append(mode).append(',').append(door.ordinal()).append(',').append(bb(b)).append(',').append(w.fullWrites).append("]]");
    }
    System.out.println("{\"kind\":\"doors\",\"names\":["+String.join(",",Arrays.stream(avd.values()).map(v->jstr(v.name())).toArray(String[]::new))+"],\"values\":"+rows+"]}");
  }
  static void stones(long seed,int n)throws Exception{
    auw sel=(auw)TerrainProbe.field(aui.class,"e").get(null);Random r=new Random(seed);MessageDigest d=MessageDigest.getInstance("SHA-1");StringBuilder first=new StringBuilder("[");Map<String,Integer> hist=new TreeMap<>();
    for(int i=0;i<n;i++){boolean edge=i%3!=0;sel.a(r,i&15,i&7,i&31,edge);int id=aji.b(sel.a),meta=sel.b;put(d,id,meta);hist.merge((edge?"e":"i")+id+":"+meta,1,Integer::sum);
      if(i<40){if(first.length()>1)first.append(',');first.append('[').append(id).append(',').append(meta).append(']');}}
    StringBuilder h=new StringBuilder("{");for(Map.Entry<String,Integer> e:hist.entrySet()){if(h.length()>1)h.append(',');h.append(jstr(e.getKey())).append(':').append(e.getValue());}
    System.out.println("{\"kind\":\"stones\",\"seed\":"+jstr(""+seed)+",\"draws\":"+n+",\"first\":"+first+"],\"histogram\":"+h+"},\"sha1\":"+jstr(TerrainProbe.hex(d.digest()))+",\"nextLong\":"+jstr(""+r.nextLong())+"}");
  }
  static String lootTable(Class<?> c,String field)throws Exception{
    StringBuilder loot=new StringBuilder("[");
    for(qx row:(qx[])TerrainProbe.field(c,field).get(null)){if(loot.length()>1)loot.append(',');add st=(add)TerrainProbe.get(row,"b");loot.append('[').append(stack(st)).append(',').append(TerrainProbe.get(row,"c")).append(',').append(TerrainProbe.get(row,"d")).append(',').append(TerrainProbe.get(row,"a")).append(',').append(st.e()).append(']');}
    return loot.append(']').toString();
  }
  static void config()throws Exception{
    StringBuilder ids=new StringBuilder("{");String[] names={"a","e","f","i","k","G","T","U","X","aa","ac","ae","ao","ap","ar","av","aB","aJ","aU","aV","aY","bg","br"};
    for(String n:names){if(ids.length()>1)ids.append(',');ids.append(jstr(n)).append(':').append(aji.b((aji)TerrainProbe.field(ajn.class,n).get(null)));}
    StringBuilder weights=new StringBuilder("[");aur[] ws=(aur[])TerrainProbe.field(aui.class,"b").get(null);
    for(aur w:ws){
      if(weights.length()>1)weights.append(',');
      StringBuilder fresh=new StringBuilder("["),sat=new StringBuilder("[");
      for(int n=0;n<=8;n++){if(n>0)fresh.append(',');fresh.append(w.a(n));}
      w.c=w.d;for(int n=0;n<=8;n++){if(n>0)sat.append(',');sat.append(w.a(n));}sat.append(',').append(w.a());w.c=0;
      // fresh: a(n) for n=0..8; saturated (instancesSpawned == limit): a(n) for n=0..8 then a().
      weights.append('[').append(jstr(saveId0(w.a))).append(',').append(w.b).append(',').append(w.d).append(',').append(fresh).append("],").append(sat).append("]]");
    }
    weights.append(']');
    aug m=new aug();
    System.out.println("{\"kind\":\"config\",\"blocks\":"+ids+"},\"weights\":"+weights+",\"loot\":{\"chestCorridor\":"+lootTable(aum.class,"a")+",\"library\":"+lootTable(auq.class,"a")+",\"roomCrossing\":"+lootTable(auv.class,"b")+"},\"strongholdSettings\":{\"distance\":"+TerrainProbe.get(m,"h")+",\"spread\":"+TerrainProbe.get(m,"i")+",\"count\":"+((Object[])TerrainProbe.get(m,"g")).length+"}}");
  }
  static String saveId0(Class<?> c){
    return c==ava.class?"SHS":c==aut.class?"SHPH":c==aup.class?"SHLT":c==auu.class?"SHRT":c==auv.class?"SHRC":c==avb.class?"SHSSD":c==auy.class?"SHSD":c==auo.class?"SH5C":c==aum.class?"SHCC":c==auq.class?"SHLi":c==aus.class?"SHPR":c.getName();
  }
  public static void main(String[] args)throws Exception{
    Field uf=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");uf.setAccessible(true);TerrainProbe.unsafe=(sun.misc.Unsafe)uf.get(null);aji.p();adb.l();
    config();doors();
    for(long s:new long[]{1,0xCAFEL})stones(s,3000);
    long[] seeds={0,17,8675309,-123456789,Long.MIN_VALUE,Long.MAX_VALUE,1,2,3,5,7,11,-1,-42,123456789012345L,99999};
    Map<Long,int[][]> pos=new LinkedHashMap<>();
    for(long s:seeds)pos.put(s,positions(s));
    for(long s:seeds){
      int[][] p=pos.get(s);
      int[][] centers={p[0],{p[0][0]+5,p[0][1]-3},p[1],{p[1][0]-8,p[1][1]+8},p[2]};
      starts(s,"native",centers,(s==0||s==17||s==8675309||s==-123456789)?3:(s==Long.MIN_VALUE||s==Long.MAX_VALUE)?1:0);
    }
    // Synthetic populations over the first native stronghold of three seeds.
    for(long seed:new long[]{8675309,0,-123456789}){
      avm st=firstStart(seed,pos.get(seed)[0]);int[][] list=coverage(st.a());Set<String> fullSet=interesting(st);
      for(String f:new String[]{"stone","pockets","water","air"}){
        if(seed==-123456789&&(f.equals("water")||f.equals("air")))continue;
        populate(seed,f,f+":start:"+st.e()+","+st.f(),list,null,null,f.equals("pockets")||(f.equals("stone")&&seed==8675309)?fullSet:new HashSet<>(),0);
      }
    }
    // Natural: 3x3 populated chunks around each start over 16 native terrain chunks.
    for(long seed:new long[]{8675309,-123456789,0}){
      int[] p=pos.get(seed)[0];int cx=p[0],cz=p[1];StringBuilder inputs=new StringBuilder();
      Map<String,aji[]> chunks=naturalChunks(seed,cx-1,cz-1,4,inputs);int[][] list=new int[9][];for(int i=0;i<9;i++)list[i]=new int[]{cx-1+i/3,cz-1+i%3};
      populate(seed,"natural","natural:"+cx+","+cz,list,chunks,inputs.toString(),new HashSet<>(),seed==8675309?2:1);
    }
  }
}
