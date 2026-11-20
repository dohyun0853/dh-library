self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let payload={};try{payload=event.data?event.data.json():{};}catch{}
 event.waitUntil(self.registration.showNotification(payload.title||'DH Library',{
  body:payload.body||'A new message is waiting in DH Library.',
  icon:'/icon-192.png?v=2',badge:'/icon-192.png?v=2',tag:payload.tag||'chat-message',
  data:{url:typeof payload.url==='string'&&payload.url.startsWith('/?chat=1')?payload.url:'/?chat=1'}
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const target=new URL(event.notification.data?.url||'/?chat=1',self.location.origin);
 if(target.origin!==self.location.origin)return;
 event.waitUntil((async()=>{const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of windows){if(new URL(client.url).origin===self.location.origin){await client.navigate(target.href);await client.focus();return;}}
  await self.clients.openWindow(target.href);
 })());
});
