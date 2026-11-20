'use client';
import {useLanguage} from './lib/language';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {ImagePlus,Send,X} from 'lucide-react';
import {MAX_CHAT_IMAGES,MAX_CHAT_IMAGE_SIZE} from './lib/chat-images';
type Photo={id:string;file:File;url:string};
// Re-encode photos so camera images fit the upload limit and omit EXIF metadata.
async function preparePhoto(original:File){
 if(original.size>30*1024*1024)throw Error(`${original.name}: Please choose a photo under 30 MB.`);
 if(!original.type.startsWith('image/')&&!/\.(heic|heif|jpe?g|png|webp)$/i.test(original.name))throw Error('Choose a photo.');
 const source=URL.createObjectURL(original);try{
  const image=new Image();image.src=source;await image.decode();
  if(!image.naturalWidth||!image.naturalHeight)throw Error('Could not read the photo.');
  const scale=Math.min(1,2400/Math.max(image.naturalWidth,image.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const context=canvas.getContext('2d');if(!context)throw Error('Could not prepare the photo.');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('Could not convert the photo.')),'image/jpeg',.9));
  if(blob.size>MAX_CHAT_IMAGE_SIZE)throw Error('The photo is too large. Crop it and try again.');
  return new File([blob],`${original.name.replace(/\.[^.]+$/,'')||'Photo'}.jpg`,{type:'image/jpeg'});
 }catch(cause){throw Error(cause instanceof DOMException?'Could not open this photo. Try a JPG, PNG, or screenshot.':(cause as Error).message);}finally{URL.revokeObjectURL(source);}
}
export default function ChatComposer({disabled,onSend}:{disabled:boolean;onSend:(data:FormData)=>Promise<boolean>}){
 const {t,language,setLanguage}=useLanguage();
 const [body,setBody]=useState(''),[photos,setPhotos]=useState<Photo[]>([]),[preparing,setPreparing]=useState(false),[error,setError]=useState('');
 const photoRef=useRef(photos);photoRef.current=photos;const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;for(const photo of photoRef.current)URL.revokeObjectURL(photo.url);};},[]);
 async function choose(list:FileList|null){if(!list?.length||preparing||disabled)return;setPreparing(true);setError('');const files=Array.from(list);
  if(files.length+photos.length>MAX_CHAT_IMAGES){setError(t("You can attach up to 3 photos per message."));setPreparing(false);return;}
  const next:Photo[]=[];try{const errors:string[]=[];for(const original of files){try{const file=await preparePhoto(original);if(!mounted.current)return;next.push({id:crypto.randomUUID(),file,url:URL.createObjectURL(file)});}catch(cause){errors.push((cause as Error).message);}}
   if(mounted.current){setPhotos(old=>[...old,...next]);if(errors.length)setError(errors.join(' '));}
  }finally{if(mounted.current)setPreparing(false);else for(const photo of next)URL.revokeObjectURL(photo.url);}
 }
 function remove(id:string){setPhotos(previous=>previous.filter(photo=>{if(photo.id===id){URL.revokeObjectURL(photo.url);return false;}return true;}));}
 async function send(e:FormEvent){e.preventDefault();if(disabled||preparing||(!body.trim()&&!photos.length))return;setError('');const data=new FormData();data.set('action','message');data.set('body',body);for(const photo of photos)data.append('images',photo.file);
  if(await onSend(data)){setBody('');for(const photo of photos)URL.revokeObjectURL(photo.url);setPhotos([]);}
 }
 return <form className="chat-composer-wrap" onSubmit={send}>
  {photos.length>0&&<div className="chat-photo-drafts">{photos.map((photo,index)=><div key={photo.id}><img src={photo.url} alt={`Photo to send ${index+1}`}/><button type="button" disabled={disabled} onClick={()=>remove(photo.id)} aria-label={`Photo ${index+1} remove`}><X size={13}/></button></div>)}</div>}
  {error&&<p className="chat-photo-error" role="alert">{t(error)}</p>}{preparing&&<p className="chat-photo-help" role="status">{t("Preparing photo…")}</p>}
  <div className="chat-compose"><label className={`chat-attach ${disabled||preparing?'disabled':''}`} title={t("Attach photo")}><ImagePlus size={21}/><input aria-label={t("Attach photos")} disabled={disabled||preparing||photos.length>=MAX_CHAT_IMAGES} type="file" accept="image/*,.heic,.heif" multiple onChange={e=>{choose(e.target.files);e.target.value='';}}/></label><textarea value={body} maxLength={2000} disabled={disabled} onChange={e=>setBody(e.target.value)} placeholder={t("Write a message")} aria-label={t("Message")}/><button disabled={disabled||preparing||(!body.trim()&&!photos.length)} className="button primary" aria-label={t("Send message")}><Send size={19}/></button></div>
  <p className="chat-photo-help">{t("Up to 3 photos. Preview or remove them before sending.")}</p>
 </form>;
}
