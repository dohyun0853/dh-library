'use client';
import {useLanguage} from './lib/language';
import {displayError} from './lib/ui-errors';
import {useState,useEffect} from 'react';
import {Bell,BellOff,LoaderCircle} from 'lucide-react';
type Config={configured:boolean;publicKey:string;eligible:boolean};
function decodeKey(key:string){const bytes=atob(key.replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(bytes,c=>c.charCodeAt(0));}
async function notificationRequest(data:unknown){const r=await fetch('/api/notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const value=await r.json() as {error?:string;enabled?:boolean;code?:string};if(!r.ok)throw Error(displayError(value.error,'Could not save notification settings.'));return value;}
async function registration(){await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});return Promise.race([navigator.serviceWorker.ready,new Promise<never>((_,reject)=>setTimeout(()=>reject(Error('Notification setup is taking too long. Reopen the app.')),15000))]);}
export default function ChatNotifications({userId}:{userId:string}){
 const {t,language,setLanguage}=useLanguage();
 const [config,setConfig]=useState<Config|null>(null),[supported,setSupported]=useState(false),[homeRequired,setHomeRequired]=useState(false),[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState(''),[permission,setPermission]=useState('default');
 useEffect(()=>{let active=true;const support='serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
  const appleMobile=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const home=window.matchMedia('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true;
  setSupported(support);setHomeRequired(appleMobile&&!home);if(support)setPermission(Notification.permission);
  (async()=>{try{const r=await fetch('/api/notifications',{cache:'no-store'});if(!r.ok)throw Error(t("Could not load notification settings. Check your sign-in."));const conf=await r.json() as Config;if(active)setConfig(conf);
   if(support){const reg=await navigator.serviceWorker.getRegistration('/');if(reg&&Notification.permission==='granted')reg.update().catch(()=>{});const sub=await reg?.pushManager.getSubscription();if(sub){const status=await notificationRequest({action:'status',endpoint:sub.endpoint});if(active)setEnabled(!!status.enabled&&Notification.permission==='granted');}}
  }catch(cause){if(active)setFeedback((cause as Error).message);}})();return()=>{active=false;};
 },[userId]);
 async function enable(repair=false){if(!supported||homeRequired||!config?.configured||!config.eligible)return;setBusy(true);setFeedback('');try{
  // Keep the permission request in the explicit consent button's gesture.
  const granted=Notification.permission==='granted'?'granted':await Notification.requestPermission();setPermission(granted);
  if(granted!=='granted'){setFeedback(granted==='denied'?t("Allow DH Library notifications in your device settings."):t("Allow notifications to receive new message alerts."));return;}
  const reg=await registration();await reg.update().catch(()=>{});let sub=await reg.pushManager.getSubscription();
  const key=sub?.options.applicationServerKey;
  const expected=decodeKey(config.publicKey);
  const changed=key&&(new Uint8Array(key).length!==expected.length||new Uint8Array(key).some((v,i)=>v!==expected[i]));
  if(sub&&(repair||changed)){await notificationRequest({action:'unsubscribe',endpoint:sub.endpoint});await sub.unsubscribe();sub=null;}
  if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:expected});
  await notificationRequest({action:'subscribe',consent:true,subscription:sub.toJSON()});setEnabled(true);setFeedback(repair?t("Connection repaired. Send a test notification."):t("Notifications enabled. Send a test notification to check."));
 }catch(cause){setFeedback((cause as Error).message||t("Could not connect notifications. Reopen the app."));}finally{setBusy(false);}}
 async function disable(){setBusy(true);setFeedback('');try{const reg=await navigator.serviceWorker.getRegistration('/');const sub=await reg?.pushManager.getSubscription();if(sub){await notificationRequest({action:'unsubscribe',endpoint:sub.endpoint});await sub.unsubscribe();}setEnabled(false);setFeedback(t("Notifications disabled on this device."));}catch(cause){setFeedback((cause as Error).message);}finally{setBusy(false);}}
 async function test(){setBusy(true);setFeedback('');try{const reg=await registration();await reg.update().catch(()=>{});const sub=await reg.pushManager.getSubscription();if(!sub||Notification.permission!=='granted'){setEnabled(false);throw Error(t("Use Repair connection to reconnect this device."));}
  await notificationRequest({action:'subscribe',consent:true,subscription:sub.toJSON()});await notificationRequest({action:'test',endpoint:sub.endpoint});setFeedback(t("Test request accepted. If it does not appear, check device notifications and Focus settings."));
 }catch(cause){setFeedback((cause as Error).message);}finally{setBusy(false);}}
 const available=supported&&!homeRequired&&config?.configured&&config.eligible;
 return <section className="chat-notification-settings" aria-label={t("Message notification settings")}><div className="notification-title">{enabled?<Bell size={16}/>:<BellOff size={16}/>}<strong>{t("Message notifications")}</strong><span>{enabled?t("Enabled on this device"):t("Optional")}</span></div><p>{t("Notifications are sent only with your consent and never show message contents or photos.")}</p>
  {homeRequired?<p className="notification-help">{t("On iPad or iPhone, open DH Library from the home screen to receive notifications.")}</p>:!supported?<p className="notification-help">{t("Notifications are not supported here. On iPad or iPhone, open the home screen app.")}</p>:!config?.configured?<p className="notification-help">{t("Loading notification settings.")}</p>:!config.eligible?<p className="notification-help">{t("Request access before enabling notifications.")}</p>:enabled?<div className="notification-actions"><button type="button" disabled={busy} onClick={disable}>{t("Disable on this device")}</button><button type="button" disabled={busy} onClick={test}>{t("Test notification")}</button><button type="button" disabled={busy} onClick={()=>enable(true)}>{t("Repair connection")}</button></div>:<div className="notification-actions"><button type="button" disabled={busy} className="button notification-consent" onClick={()=>enable()}>{busy?<LoaderCircle size={14}/>:<Bell size={14}/>}{t("Allow notifications")}</button>{permission==='granted'&&<button type="button" disabled={busy} onClick={()=>enable(true)}>{t("Repair connection")}</button>}</div>}
  {available&&<p className="notification-help">{t("Use Test notification to check delivery, or Repair connection if needed.")}</p>}{feedback&&<p role="status" className="notification-feedback">{t(feedback)}</p>}
 </section>;
}
