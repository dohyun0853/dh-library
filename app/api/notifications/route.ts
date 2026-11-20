import {db,identity,json,validOrigin} from '../../lib/access';
import {pushConfig,sanitizeSubscription,subscriptionId,sendPush} from '../../lib/push';
export const dynamic='force-dynamic';
export async function GET(){const who=await identity();if(!who.user)return json({error:'로그인이 필요합니다.'},401);const {publicKey,privateKey}=pushConfig();return json({configured:!!publicKey&&!!privateKey,publicKey,eligible:who.admin||!!who.member});}
export async function POST(request:Request){
 if(!validOrigin(request))return json({error:'허용되지 않은 요청입니다.'},403);
 try{
 const who=await identity();if(!who.user)return json({error:'로그인이 필요합니다.'},401);
 if(!who.admin&&!who.member)return json({error:'이용 신청 후 알림을 켤 수 있습니다.'},403);
 if(Number(request.headers.get('content-length')||0)>8192)return json({error:'요청이 너무 큽니다.'},413);
 const body=await request.json() as any;
 if(body.action==='subscribe'){
  if(body.consent!==true)return json({error:'알림 수신 동의가 필요합니다.'},400);
  const {publicKey,privateKey}=pushConfig();if(!publicKey||!privateKey)return json({error:'알림 설정을 준비하고 있습니다. 잠시 후 다시 시도해주세요.'},503);
  const sub=sanitizeSubscription(body.subscription);if(!sub)return json({error:'이 브라우저의 알림 정보를 확인할 수 없습니다.'},400);
  const id=await subscriptionId(sub.endpoint),now=new Date().toISOString();
  const count=await db().prepare('SELECT COUNT(*) AS n FROM push_subscriptions WHERE user=? AND id<>?').bind(who.user.userId,id).first<any>();if(count.n>=8)return json({error:'한 계정에 최대 8개 기기까지 알림을 연결할 수 있습니다.'},409);
  await db().prepare('INSERT INTO push_subscriptions(id,user,email,role,subscription,created,updated) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET user=excluded.user,email=excluded.email,role=excluded.role,subscription=excluded.subscription,updated=excluded.updated').bind(id,who.user.userId,who.user.email,who.admin?'admin':'member',JSON.stringify(sub),now,now).run();return json({ok:true,enabled:true});
 }
 if(typeof body.endpoint!=='string'||body.endpoint.length>2048)return json({error:'알림 기기를 확인해주세요.'},400);
 const id=await subscriptionId(body.endpoint);
 if(body.action==='status'){const row=await db().prepare('SELECT id FROM push_subscriptions WHERE id=? AND user=?').bind(id,who.user.userId).first();return json({enabled:!!row});}
 if(body.action==='unsubscribe'){await db().prepare('DELETE FROM push_subscriptions WHERE id=? AND user=?').bind(id,who.user.userId).run();return json({ok:true,enabled:false});}
 if(body.action==='test'){
  const row=await db().prepare('SELECT id,user,subscription FROM push_subscriptions WHERE id=? AND user=?').bind(id,who.user.userId).first<any>();if(!row)return json({error:'이 기기에서 먼저 알림을 켜주세요.'},403);
  const result=await sendPush([row],{title:'Notifications are connected',body:'New messages will appear on this device.',url:'/?chat=1',tag:'notification-test'});
  const errors:Record<string,string>={configuration:'서버 알림 설정이 준비되지 않았습니다. 잠시 후 다시 시도해주세요. (P01)',prepare:'알림 암호화를 준비하지 못했습니다. 관리자에게 알림 코드 P02를 알려주세요.',transport:'알림 서비스에 연결하지 못했습니다. 잠시 후 다시 테스트해주세요. (P03)',authentication:'알림 서비스 인증에 실패했습니다. 관리자에게 알림 코드 P04를 알려주세요.',expired:'이 기기의 알림 연결이 만료되었습니다. 알림 연결 복구를 눌러주세요.',service:'알림 서비스가 요청을 처리하지 못했습니다. 잠시 후 다시 테스트해주세요. (P05)'};
  return result.delivered?json({ok:true}):json({error:errors[result.failure||'service']||errors.service,prepared:result.prepared>0,code:result.failure},502);
 }
 return json({error:'지원하지 않는 요청입니다.'},400);
 }catch{console.error('notification request failed');return json({error:'알림 설정을 저장하지 못했습니다. 다시 시도해주세요.'},500);}
}
