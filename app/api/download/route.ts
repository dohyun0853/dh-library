import {bucket,db,identity,json,validOrigin} from '../../lib/access';
import {zipStream} from '../../lib/zip';
export const dynamic='force-dynamic';
async function selected(ids:unknown){
 const who=await identity();
 if(!who.user)return json({error:'로그인이 필요합니다.'},401);
 if(!who.allowed)return json({error:'관리자의 이용 승인이 필요합니다.'},403);
 if(!Array.isArray(ids)||!ids.length||ids.length>100||ids.some(id=>typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(id)))return json({error:'자료를 1~100개 선택해주세요.'},400);
 const unique=[...new Set(ids as string[])];
 const result=await db().prepare(`SELECT id,filename,tier FROM materials WHERE id IN (${unique.map(()=>'?').join(',')})`).bind(...unique).all<{id:string;filename:string;tier:number}>();
 if(result.results.length!==unique.length||result.results.some(file=>!who.admin&&(who.member?.tier||1)<file.tier))return json({error:'자료가 없습니다.'},404);
 return unique.map(id=>result.results.find(file=>file.id===id)!);
}
export async function POST(request:Request){
 if(!validOrigin(request))return json({error:'허용되지 않은 요청입니다.'},403);
 try{const body=await request.json() as {ids?:unknown};const files=await selected(body.ids);if(files instanceof Response)return files;
 return json({url:`/api/download?ids=${encodeURIComponent(files.map(f=>f.id).join(','))}`});
 }catch{return json({error:'다운로드할 자료를 확인해주세요.'},400);}
}
export async function GET(request:Request){
 const files=await selected(new URL(request.url).searchParams.get('ids')?.split(','));if(files instanceof Response)return files;
 const stream=zipStream(files,async id=>{const object=await bucket().get(id);if(!object)throw Error('파일을 찾을 수 없습니다.');return object.body;});
 return new Response(stream,{headers:{'Content-Type':'application/zip','Content-Disposition':`attachment; filename="dohyun-materials.zip"; filename*=UTF-8''${encodeURIComponent('도현이의자료실_선택자료.zip')}`,'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
}
