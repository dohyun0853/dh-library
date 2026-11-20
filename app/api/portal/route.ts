import {waitUntil} from 'cloudflare:workers';
import {notifyChat} from '../../lib/push';
import {chatImageMime,MAX_CHAT_IMAGES,MAX_CHAT_IMAGE_SIZE} from '../../lib/chat-images';
import { DEFAULT_FOLDERS,foldersForCourse,folderPath,folderAllowed,materialForDisplay,type ArchiveFolder } from '../../lib/folders';
import { db, bucket, identity, json, validOrigin } from '../../lib/access';
export const dynamic = 'force-dynamic';
const now = () => new Date().toISOString();
const str = (v:unknown, max=120) => typeof v === 'string' ? v.trim().slice(0,max) : '';
async function folderExists(course:string,id:string):Promise<boolean>{
 if(DEFAULT_FOLDERS.some(f=>f.id===id))return true;
 return !!await db().prepare('SELECT id FROM folders WHERE id=? AND course=?').bind(id,course).first();
}
export async function GET() {
 try {
 const who = await identity();
 const cs = await db().prepare('SELECT c.*, (SELECT COUNT(*) FROM materials m WHERE m.course=c.id) AS count FROM courses c ORDER BY grade,semester,name').all();
 const rawFiles = who.admin ? (await db().prepare('SELECT * FROM materials ORDER BY created DESC').all()).results : who.allowed ? (await db().prepare('SELECT * FROM materials WHERE tier<=? ORDER BY created DESC').bind(who.member?.tier||1).all()).results : [];
 const rawFolders = who.allowed ? (await db().prepare('SELECT * FROM folders ORDER BY created,id').all()).results as ArchiveFolder[] : [];
 const visibleFiles=rawFiles.map((f:any)=>materialForDisplay(f,rawFolders));
 const files=who.admin?visibleFiles:visibleFiles.map((f:any)=>{const {tier,...visible}=f;return visible;});
 // Empty or restricted-only custom folders must not reveal hidden materials.
 const folders=who.admin?rawFolders:rawFolders.filter(folder=>visibleFiles.some((file:any)=>file.course===folder.course&&folderPath(foldersForCourse(rawFolders,file.course),file.folder).some(parent=>parent.id===folder.id)));
 const member=who.member&&(who.admin?who.member:{id:who.member.id,email:who.member.email,name:who.member.name,student:who.member.student,status:who.member.status,created:who.member.created});
 const people = who.admin ? (await db().prepare('SELECT * FROM members ORDER BY created DESC').all()).results : [];
 const msgs = who.admin ? (await db().prepare('SELECT * FROM messages ORDER BY created').all()).results : who.member ? (await db().prepare('SELECT * FROM messages WHERE thread=? ORDER BY created').bind(who.user!.userId).all()).results : [];
 const attachments=who.admin?(await db().prepare('SELECT id,message,filename,mime,size FROM message_attachments ORDER BY created,id').all()).results:who.member?(await db().prepare('SELECT a.id,a.message,a.filename,a.mime,a.size FROM message_attachments a JOIN messages m ON m.id=a.message WHERE m.thread=? ORDER BY a.created,a.id').bind(who.user!.userId).all()).results:[];
 const messages=msgs.map((message:any)=>({...message,attachments:attachments.filter((a:any)=>a.message===message.id)}));
 return json({user:who.user && {name:who.user.displayName,email:who.user.email,id:who.user.userId},admin:who.admin,member,allowed:who.allowed,courses:cs.results.map((c:any)=>({...c,note:who.allowed?c.note:'',count:files.filter((f:any)=>f.course===c.id).length})),folders,files,people,messages,total:files.length});
 } catch(e) { console.error('portal GET',e); return json({error:'자료실을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'},500); }
}
export async function POST(request:Request) {
 if(!validOrigin(request)) return json({error:'허용되지 않은 요청입니다.'},403);
 try {
 const who = await identity();
 if(!who.user) return json({error:'로그인이 필요합니다.'},401);
 const multipart = request.headers.get('content-type')?.includes('multipart/form-data');
 if(Number(request.headers.get('content-length')||0)>26*1024*1024) return json({error:'파일은 25MB까지 업로드할 수 있습니다.'},413);
 const form = multipart ? await request.formData() : null;
 const body = form ? Object.fromEntries(form.entries()) : await request.json() as any;
 const action = body.action;
 if(action === 'join') {
  if(who.admin) return json({ok:true});
  const name=str(body.name,40), student=str(body.student,60);
  if(!name || !student) return json({error:'이름과 학과·학번을 입력해주세요.'},400);
  await db().prepare('INSERT INTO members(id,email,name,student,status,created) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, student=excluded.student, email=excluded.email').bind(who.user.userId,who.user.email,name,student,'pending',now()).run();
 } else if(action === 'message') {
  if(!who.member && !who.admin) return json({error:'먼저 이용 신청을 해주세요.'},403);
  const thread=who.admin ? str(body.thread,200) : who.user.userId;
  const text=str(body.body,2000);
  const images=form?.getAll('images')||[];
  if(images.length>MAX_CHAT_IMAGES)return json({error:'사진은 최대 3장까지 첨부할 수 있습니다.'},400);
  if(!text&&!images.length) return json({error:'메시지나 사진을 입력해주세요.'},400);
  if(!await db().prepare('SELECT id FROM members WHERE id=?').bind(thread).first()) return json({error:'대화 상대가 없습니다.'},404);
  const recent=await db().prepare('SELECT COUNT(*) AS n FROM messages WHERE thread=? AND sender=? AND created>?').bind(thread,who.admin?'admin':who.user.userId,new Date(Date.now()-60000).toISOString()).first<any>();
  if(recent.n>=20) return json({error:'잠시 후 다시 보내주세요.'},429);
  const prepared=[];
  for(const image of images){
   if(!(image instanceof File)||!image.size||image.size>MAX_CHAT_IMAGE_SIZE)return json({error:'사진은 한 장당 5MB 이하로 첨부해주세요.'},400);
   const mime=chatImageMime(new Uint8Array(await image.slice(0,16).arrayBuffer()));if(!mime)return json({error:'JPG·PNG·WebP 사진만 첨부할 수 있습니다.'},400);
   prepared.push({id:crypto.randomUUID(),file:image,mime});
  }
  const messageId=crypto.randomUUID(),created=now(),uploaded:string[]=[];
  try{
   for(const image of prepared){await bucket().put(`chat/${image.id}`,image.file.stream(),{httpMetadata:{contentType:image.mime}});uploaded.push(`chat/${image.id}`);}
   await db().batch([db().prepare('INSERT INTO messages(id,thread,sender,body,created) VALUES(?,?,?,?,?)').bind(messageId,thread,who.admin?'admin':who.user.userId,text,created),...prepared.map(image=>db().prepare('INSERT INTO message_attachments(id,message,filename,mime,size,created) VALUES(?,?,?,?,?,?)').bind(image.id,messageId,image.file.name.slice(0,200),image.mime,image.file.size,created))]);
  }catch(cause){if(uploaded.length)await bucket().delete(uploaded).catch(()=>{});throw cause;}
  waitUntil(notifyChat(who.user,who.admin,thread).catch(()=>{console.warn('chat notification did not complete');}));
 } else {
  if(!who.admin) return json({error:'관리자만 사용할 수 있습니다.'},403);
  if(action === 'approve') {
   if(!['approved','pending','revoked'].includes(body.status)) return json({error:'잘못된 승인 상태입니다.'},400);
   await db().prepare('UPDATE members SET status=? WHERE id=?').bind(body.status,str(body.id,200)).run();
  } else if(action === 'set-member-tier') {
   const tier=Number(body.tier);if(![1,2].includes(tier))return json({error:'회원 등급을 확인해주세요.'},400);
   const result=await db().prepare('UPDATE members SET tier=? WHERE id=?').bind(tier,str(body.id,200)).run();if(!result.meta.changes)return json({error:'회원을 찾을 수 없습니다.'},404);
  } else if(action === 'set-file-tier') {
   const tier=Number(body.tier);if(![1,2].includes(tier))return json({error:'공개 등급을 확인해주세요.'},400);
   const result=await db().prepare('UPDATE materials SET tier=? WHERE id=?').bind(tier,str(body.id,100)).run();if(!result.meta.changes)return json({error:'자료를 찾을 수 없습니다.'},404);
  } else if(action === 'course') {
   const grade=Number(body.grade), semester=Number(body.semester), name=str(body.name,80);
   if(![1,2,3,4,5,6].includes(grade)||![1,2].includes(semester)||!name) return json({error:'학년·학기·과목명을 확인해주세요.'},400);
   const exists=await db().prepare('SELECT id FROM courses WHERE grade=? AND semester=? AND name=?').bind(grade,semester,name).first();
   if(exists) return json({error:'이미 등록된 과목입니다.'},409);
   await db().prepare('INSERT INTO courses(id,name,grade,semester,created) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),name,grade,semester,now()).run();
  } else if(action === 'note') {
   const result=await db().prepare('UPDATE courses SET note=? WHERE id=?').bind(str(body.note,5000),str(body.id,100)).run();
   if(!result.meta.changes) return json({error:'과목을 찾을 수 없습니다.'},404);
  } else if(action === 'create-folder') {
   const course=str(body.course,100),parent=str(body.parent,100),name=str(body.name,60);
   if(!name||/[\\/]/.test(name)||name==='.'||name==='..')return json({error:'폴더 이름을 확인해주세요. /와 \\는 사용할 수 없습니다.'},400);
   if(!await db().prepare('SELECT id FROM courses WHERE id=?').bind(course).first())return json({error:'과목을 찾을 수 없습니다.'},404);
   if(parent&&!await folderExists(course,parent))return json({error:'상위 폴더를 찾을 수 없습니다.'},400);
   let cursor=parent;let depth=0;
   while(cursor){depth++;const p=await db().prepare('SELECT parent FROM folders WHERE id=? AND course=?').bind(cursor,course).first<any>();cursor=p?.parent||'';if(depth>=8)return json({error:'하위 폴더는 8단계까지 만들 수 있습니다.'},400);}
   if(!parent&&DEFAULT_FOLDERS.some(f=>f.name===name))return json({error:'같은 이름의 폴더가 있습니다.'},409);
   if(await db().prepare('SELECT id FROM folders WHERE course=? AND parent=? AND name=?').bind(course,parent,name).first())return json({error:'같은 이름의 폴더가 있습니다.'},409);
   await db().prepare('INSERT INTO folders(id,course,name,parent,created) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),course,name,parent,now()).run();
  } else if(action === 'rename-folder') {
   const id=str(body.id,100),name=str(body.name,60);
   const f=await db().prepare('SELECT * FROM folders WHERE id=?').bind(id).first<any>();
   if(!f)return json({error:'직접 만든 폴더만 이름을 바꿀 수 있습니다.'},404);
   if(!name||/[\\/]/.test(name)||name==='.'||name==='..')return json({error:'폴더 이름을 확인해주세요.'},400);
   if(!f.parent&&DEFAULT_FOLDERS.some(f=>f.name===name))return json({error:'같은 이름의 폴더가 있습니다.'},409);
   if(await db().prepare('SELECT id FROM folders WHERE course=? AND parent=? AND name=? AND id<>?').bind(f.course,f.parent,name,id).first())return json({error:'같은 이름의 폴더가 있습니다.'},409);
   await db().prepare('UPDATE folders SET name=? WHERE id=?').bind(name,id).run();
  } else if(action === 'delete-folder') {
   const id=str(body.id,100);
   const f=await db().prepare('SELECT id,course FROM folders WHERE id=?').bind(id).first<any>();
   if(!f)return json({error:'직접 만든 폴더만 삭제할 수 있습니다.'},404);
   if(await db().prepare('SELECT id FROM materials WHERE folder=? AND course=? LIMIT 1').bind(id,f.course).first()||await db().prepare('SELECT id FROM folders WHERE parent=? AND course=? LIMIT 1').bind(id,f.course).first())return json({error:'파일과 하위 폴더를 모두 옮기거나 삭제한 뒤 다시 시도해주세요.'},409);
   await db().prepare('DELETE FROM folders WHERE id=?').bind(id).run();
  } else if(action === 'move-file') {
   const id=str(body.id,100),folder=str(body.folder,100);
   const file=await db().prepare('SELECT course,folder,exam FROM materials WHERE id=?').bind(id).first<any>();
   if(!file)return json({error:'자료를 찾을 수 없습니다.'},404);
   if(!await folderExists(file.course,folder))return json({error:'같은 과목의 폴더를 선택해주세요.'},400);
   const list=(await db().prepare('SELECT * FROM folders WHERE course=?').bind(file.course).all()).results as ArchiveFolder[];
   const exam=str(body.exam,20)||materialForDisplay(file,list).exam;
   if(!folderAllowed(foldersForCourse(list,file.course),folder,exam))return json({error:'시험별 자료는 기출·과제·필기·요약 폴더에, 공통 자료는 책자료·기타 폴더에 저장해주세요.'},400);
   await db().prepare('UPDATE materials SET folder=?,exam=? WHERE id=?').bind(folder,exam,id).run();
  } else if(action === 'upload') {
   const file=form?.get('file');
   if(!(file instanceof File)||!file.size||file.size>25*1024*1024) return json({error:'0MB 초과, 25MB 이하의 파일을 선택해주세요.'},400);
   const course=str(body.course,100), title=str(body.title), exam=str(body.exam), kind=str(body.kind);
   if(!title||!['mid','final','common'].includes(exam)||!['족보','필기','요약본','기타'].includes(kind)) return json({error:'자료 정보를 확인해주세요.'},400);
   if(!await db().prepare('SELECT id FROM courses WHERE id=?').bind(course).first()) return json({error:'과목을 먼저 추가해주세요.'},400);
   const folder=str(body.folder,100)||'other';
   if(!await folderExists(course,folder))return json({error:'이 과목의 저장 폴더를 선택해주세요.'},400);
   const tier=Number(body.tier||1);if(![1,2].includes(tier))return json({error:'공개 등급을 확인해주세요.'},400);
   const list=(await db().prepare('SELECT * FROM folders WHERE course=?').bind(course).all()).results as ArchiveFolder[];
   if(!folderAllowed(foldersForCourse(list,course),folder,exam))return json({error:'선택한 시험 구분에 맞는 저장 폴더를 선택해주세요.'},400);
   const id=crypto.randomUUID();
   await bucket().put(id,file.stream(),{httpMetadata:{contentType:file.type||'application/octet-stream'}});
   try { await db().prepare('INSERT INTO materials(id,course,title,exam,kind,filename,mime,size,created,folder,tier) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id,course,title,exam,kind,file.name.slice(0,200),file.type||'application/octet-stream',file.size,now(),folder,tier).run(); }
   catch(e) { await bucket().delete(id); throw e; }
  } else if(action === 'delete-file') {
   const id=str(body.id,100);
   await db().prepare('DELETE FROM materials WHERE id=?').bind(id).run();
   await bucket().delete(id);
  } else if(action === 'delete-course') {
   const id=str(body.id,100);
   const count=await db().prepare('SELECT COUNT(*) AS n FROM materials WHERE course=?').bind(id).first<any>();
   if(count.n) return json({error:'자료를 모두 삭제한 뒤 과목을 삭제할 수 있습니다.'},409);
   await db().batch([db().prepare('DELETE FROM folders WHERE course=?').bind(id),db().prepare('DELETE FROM courses WHERE id=?').bind(id)]);
  } else return json({error:'지원하지 않는 요청입니다.'},400);
 }
 return json({ok:true});
 } catch(e) {console.error('portal POST',e);return json({error:'저장하지 못했습니다. 잠시 후 다시 시도해주세요.'},500);}
}
