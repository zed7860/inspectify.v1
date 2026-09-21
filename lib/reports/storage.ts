import { adminClient } from "@/lib/supabase/admin";
export function reportPhotoReader() {
  const storage=adminClient().storage.from("inspection-evidence");
  const cache=new Map<string,Promise<Buffer>>();
  return (key:string) => {
    if(!cache.has(key)) cache.set(key,(async()=>{
      const {data,error}=await storage.createSignedUrl(key,300);
      if(error||!data?.signedUrl)throw new Error("Unable to access evidence photo.");
      const response=await fetch(data.signedUrl,{signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw new Error("Unable to download evidence photo.");
      return Buffer.from(await response.arrayBuffer());
    })());
    return cache.get(key)!;
  };
}
