import { db, bucket, identity, json } from '../../../lib/access';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
 const who=await identity();
 if(!who.user) return json({error:'로그인이 필요합니다.'},401);
 if(!who.allowed) return json({error:'관리자의 이용 승인이 필요합니다.'},403);
 const {id}=await params;
 const file=await db().prepare('SELECT * FROM materials WHERE id=?').bind(id).first<any>();
 if(!file) return json({error:'자료가 없습니다.'},404);
 if(!who.admin&&(who.member?.tier||1)<(file.tier||1))return json({error:'자료가 없습니다.'},404);
 const object=await bucket().get(id);
 if(!object) return json({error:'파일을 찾을 수 없습니다.'},404);
 const safe=['application/pdf','image/png','image/jpeg','image/webp','text/plain'].includes(file.mime);
 const disposition=new URL(request.url).searchParams.has('download')||!safe?'attachment':'inline';
 return new Response(object.body,{headers:{'Content-Type':file.mime,'Content-Length':String(file.size),'Content-Disposition':`${disposition}; filename="material"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'; style-src 'unsafe-inline'",'Vary':'Cookie'}});
}
