import {bucket,db,identity,json} from '../../../lib/access';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const who=await identity();if(!who.user)return json({error:'로그인이 필요합니다.'},401);
 const {id}=await params;
 const image=await db().prepare('SELECT a.*,m.thread FROM message_attachments a JOIN messages m ON m.id=a.message WHERE a.id=?').bind(id).first<any>();
 if(!image||(!who.admin&&(!who.member||image.thread!==who.user.userId)))return json({error:'사진을 찾을 수 없습니다.'},404);
 const object=await bucket().get(`chat/${id}`);if(!object)return json({error:'사진을 찾을 수 없습니다.'},404);
 return new Response(object.body,{headers:{'Content-Type':image.mime,'Content-Length':String(image.size),'Content-Disposition':`inline; filename="chat-image"; filename*=UTF-8''${encodeURIComponent(image.filename)}`,'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"}});
}
