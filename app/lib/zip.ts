import {Zip,ZipPassThrough} from 'fflate';
type Entry={id:string;filename:string};
function uniqueName(original:string,used:Set<string>){
 const clean=original.replace(/[\\/\u0000-\u001f<>:"|?*]/g,'_').replace(/[. ]+$/g,'').slice(0,200)||'자료';
 const dot=clean.lastIndexOf('.'),base=dot>0?clean.slice(0,dot):clean,ext=dot>0?clean.slice(dot):'';
 let name=clean,n=2;while(used.has(name.toLowerCase()))name=`${base} (${n++})${ext}`;used.add(name.toLowerCase());return name;
}
// Pull one source chunk at a time so a large selection never accumulates in memory.
export function zipStream(files:Entry[],load:(id:string)=>Promise<ReadableStream<Uint8Array>>){
 const queue:Uint8Array[]=[];const used=new Set<string>();let index=0,reader:ReadableStreamDefaultReader<Uint8Array>|null=null,entry:ZipPassThrough|null=null,finished=false,cancelled=false,failure:Error|null=null;
 const zip=new Zip((error,data,final)=>{if(error)failure=error;else{if(data.length)queue.push(data);if(final)finished=true;}});
 return new ReadableStream<Uint8Array>({
  async pull(controller){try{while(!queue.length&&!finished&&!cancelled){
   if(failure)throw failure;
   if(reader){const result=await reader.read();if(cancelled)return;if(result.done){reader.releaseLock();reader=null;entry!.push(new Uint8Array(),true);entry=null;}else entry!.push(result.value,false);}
   else if(index<files.length){const file=files[index++];const body=await load(file.id);if(cancelled){await body.cancel();return;}reader=body.getReader();entry=new ZipPassThrough(uniqueName(file.filename,used));zip.add(entry);}
   else zip.end();
  }if(failure)throw failure;if(queue.length)controller.enqueue(queue.shift()!);else if(finished)controller.close();
  }catch(cause){cancelled=true;await reader?.cancel().catch(()=>{});zip.terminate();controller.error(cause);}},
  async cancel(){cancelled=true;queue.length=0;await reader?.cancel().catch(()=>{});zip.terminate();}
 });
}
