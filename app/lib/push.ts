import {env} from 'cloudflare:workers';
import {buildPushPayload} from '@block65/webcrypto-web-push';
import {db} from './access';
export function pushConfig(){return {publicKey:(env.VAPID_PUBLIC_KEY||'').trim(),privateKey:(env.VAPID_PRIVATE_KEY||'').trim()};}
export function validPushEndpoint(endpoint:string){try{const u=new URL(endpoint);if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||u.hash)return false;const h=u.hostname.toLowerCase();return h==='fcm.googleapis.com'||h==='android.googleapis.com'||h==='updates.push.services.mozilla.com'||h.endsWith('.push.services.mozilla.com')||h.endsWith('.push.apple.com')||h.endsWith('.notify.windows.com');}catch{return false;}}
export function sanitizeSubscription(value:any){
 if(!value||typeof value.endpoint!=='string'||value.endpoint.length>2048||!validPushEndpoint(value.endpoint))return null;
 const p=value.keys?.p256dh,a=value.keys?.auth;
 if(typeof p!=='string'||typeof a!=='string'||!/^[A-Za-z0-9_-]{87}={0,2}$/.test(p)||!/^[A-Za-z0-9_-]{22}={0,2}$/.test(a))return null;
 return {endpoint:value.endpoint,keys:{p256dh:p,auth:a}};
}
export async function subscriptionId(endpoint:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(endpoint));return Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');}
export type PushRow={id:string;user:string;subscription:string;};
export async function sendPush(rows:PushRow[],payload:{title:string;body:string;url:string;tag:string}){
 const {publicKey,privateKey}=pushConfig();
 const adminEmail = env.ADMIN_EMAIL?.trim();
 if(!publicKey||!privateKey||!adminEmail)return {attempted:0,prepared:0,delivered:0,failure:'configuration'};
 let delivered=0,prepared=0;const failures:string[]=[];
 await Promise.all(rows.slice(0,16).map(async row=>{let stage='prepare';try{
  const sub=JSON.parse(row.subscription);if(!validPushEndpoint(sub.endpoint))return;
  const details=await buildPushPayload({data:payload,options:{ttl:60*60*12,urgency:'high'}},{...sub,expirationTime:null},{subject:`mailto:${adminEmail}`,publicKey,privateKey});
  prepared++;
  stage='transport';const result=await fetch(sub.endpoint,{...details,redirect:'manual',signal:AbortSignal.timeout(10000)});
  if(result.ok)delivered++;
  else {const failure=result.status===404||result.status===410?'expired':result.status===401||result.status===403?'authentication':'service';failures.push(failure);if(failure==='expired')await db().prepare('DELETE FROM push_subscriptions WHERE id=? AND user=?').bind(row.id,row.user).run();console.warn('push delivery rejected',JSON.stringify({status:result.status,failure}));}
 }catch(cause){failures.push(stage);console.warn('push delivery failed',JSON.stringify({stage,name:cause instanceof Error?cause.name:'Error'}));}}));
 return {attempted:rows.length,prepared,delivered,failure:failures[0]||null};
}
export async function notifyChat(sender:{userId:string},senderAdmin:boolean,thread:string){
 const result=senderAdmin?await db().prepare('SELECT id,user,subscription FROM push_subscriptions WHERE user=? AND user<>? LIMIT 16').bind(thread,sender.userId).all<PushRow>():await db().prepare("SELECT id,user,subscription FROM push_subscriptions WHERE role='admin' AND lower(email)=lower(?) AND user<>? LIMIT 16").bind(env.ADMIN_EMAIL||'',sender.userId).all<PushRow>();
 return sendPush(result.results,{title:senderAdmin?'New reply from Dohyun':'New message received',body:'Open DH Library to view your message.',url:`/?chat=1&thread=${encodeURIComponent(thread)}`,tag:`chat-${thread}`});
}
