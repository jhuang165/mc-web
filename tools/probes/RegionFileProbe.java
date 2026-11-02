import java.io.*;
import java.nio.file.*;
import java.security.*;
import java.util.*;
import java.util.zip.*;

// Unchanged RegionFile executes real disk writes/reopens/reads. Timestamp table
// is zeroed only after closing, to make recorded fixture bytes reproducible.
public class RegionFileProbe {
  static String sha(byte[] bytes) throws Exception {
    StringBuilder out=new StringBuilder();for(byte b:MessageDigest.getInstance("SHA-256").digest(bytes))out.append(String.format("%02x",b&255));return out.toString();
  }
  static String gzip(byte[] bytes) throws Exception {
    ByteArrayOutputStream out=new ByteArrayOutputStream();try(GZIPOutputStream zip=new GZIPOutputStream(out)){zip.write(bytes);}return Base64.getEncoder().encodeToString(out.toByteArray());
  }
  static byte[] data(int slot,int size) {byte[] bytes=new byte[size];new Random(1710+slot*31+size).nextBytes(bytes);return bytes;}
  static void put(aqh region,int slot,int size) throws Exception {
    try(DataOutputStream out=region.b(slot&31,slot>>5)){out.write(data(slot,size));}
  }
  static String summary(aqh region) throws Exception {
    StringJoiner entries=new StringJoiner(",","[","]");
    for(int slot=0;slot<1024;slot++)try(DataInputStream in=region.a(slot&31,slot>>5)){
      if(in==null)continue;
      ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buffer=new byte[8192];int n;
      while((n=in.read(buffer))!=-1)out.write(buffer,0,n);
      byte[] bytes=out.toByteArray();entries.add("{\"slot\":"+slot+",\"length\":"+bytes.length+",\"sha256\":\""+sha(bytes)+"\"}");
    }
    return entries.toString();
  }
  public static void main(String[] args) throws Exception {
    Path dir=Paths.get(args[0]);Files.createDirectories(dir);
    if(args.length>1){
      for(int i=0;i<4;i++){aqh region=new aqh(dir.resolve(i+".mca").toFile());System.out.println(summary(region));region.c();}return;
    }
    for(int mode=0;mode<4;mode++) {
      Path file=dir.resolve("native-"+mode+".mca");Files.deleteIfExists(file);aqh region=new aqh(file.toFile());
      if(mode==1||mode==2){int[] slots={0,31,32,511,992,1023},sizes={0,1,4091,4092,8192,70000};for(int j=0;j<slots.length;j++)put(region,slots[j],sizes[j]);}
      if(mode==2){put(region,0,40000);put(region,1023,2);put(region,31,15000);put(region,511,10);}
      if(mode==3)for(int slot=0;slot<1024;slot++)put(region,slot,slot%9);
      region.c();
      if(mode==2){ // Synthetic gzip entry: original RegionFile writes zlib but reads both.
        byte[] raw=data(77,300);ByteArrayOutputStream out=new ByteArrayOutputStream();try(GZIPOutputStream zip=new GZIPOutputStream(out)){zip.write(raw);}byte[] compressed=out.toByteArray();
        try(RandomAccessFile f=new RandomAccessFile(file.toFile(),"rw")){int offset=(int)(f.length()/4096);f.seek(f.length());f.write(new byte[4096]);f.seek(offset*4096L);f.writeInt(compressed.length+1);f.writeByte(1);f.write(compressed);f.seek(77*4);f.writeInt((offset<<8)|1);}
      }
      try(RandomAccessFile f=new RandomAccessFile(file.toFile(),"rw")){f.seek(4096);f.write(new byte[4096]);}
      region=new aqh(file.toFile());String entries=summary(region);region.c();
      System.out.println("{\"index\":"+mode+",\"regionGzip\":\""+gzip(Files.readAllBytes(file))+"\",\"entries\":"+entries+"}");
    }
    for(int size:new int[]{4090,4091,4092,1044474,1044475}){
      Path file=dir.resolve("allocation.mca");Files.deleteIfExists(file);aqh region=new aqh(file.toFile());region.a(0,0,new byte[size],size);region.c();
      try(RandomAccessFile f=new RandomAccessFile(file.toFile(),"r")){System.out.println("{\"allocation\":"+size+",\"location\":"+f.readInt()+",\"fileBytes\":"+f.length()+"}");}
    }
  }
}
