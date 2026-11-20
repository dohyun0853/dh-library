'use client';
import {useLanguage} from './lib/language';
import {displayError} from './lib/ui-errors';
import {useState,type FormEvent} from 'react';
import {Plus,Trash2,Upload} from 'lucide-react';
import {foldersForExam,displayFolderLabel,displayKind,type ArchiveFolder} from './lib/folders';
type Item={id:string;file:File;title:string;error:string};
type Props={courses:Record<string,any>[];folders:ArchiveFolder[];initialCourse:string;initialExam:string;initialFolder:string;setBusy:(value:boolean)=>void;onSaved:(count:number,complete:boolean)=>Promise<void>};
export default function BulkUpload(p:Props){
 const {t,language,setLanguage}=useLanguage();
 const [course,setCourse]=useState(p.initialCourse),[exam,setExam]=useState(p.initialExam),[folder,setFolder]=useState(p.initialFolder);
 const [items,setItems]=useState<Item[]>([]),[running,setRunning]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState('');
 const folders=foldersForExam(p.folders,course,exam);
 function destination(nextCourse:string,nextExam:string){const options=foldersForExam(p.folders,nextCourse,nextExam);setCourse(nextCourse);setExam(nextExam);if(!options.some(f=>f.id===folder))setFolder(options[0]?.id||'');}
 function pick(files:FileList|null){if(!files)return;setError('');setItems(previous=>{const next=[...previous];for(const file of Array.from(files)){if(next.some(i=>i.file.name===file.name&&i.file.size===file.size&&i.file.lastModified===file.lastModified))continue;next.push({id:crypto.randomUUID(),file,title:(file.name.replace(/\.[^.]+$/,'')||file.name).slice(0,120),error:!file.size?t("Empty files cannot be uploaded."):file.size>25*1024*1024?t("Files must be no larger than 25 MB."):''});}return next;});}
 async function upload(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(running||!items.length)return;
  if(items.some(i=>!i.file.size||i.file.size>25*1024*1024)){setError(t("Remove files that exceed the size limit."));return;}
  const fields=new FormData(e.currentTarget),batch=[...items];let saved=0;
  setRunning(true);p.setBusy(true);setError('');
  try{for(let n=0;n<batch.length;n++){
   const item=batch[n];setProgress(`${n+1} / ${batch.length} · ${item.file.name}`);
   const data=new FormData();for(const key of ['course','exam','folder','kind','tier'])data.set(key,String(fields.get(key)||''));
   data.set('action','upload');data.set('title',item.title.trim());data.set('file',item.file);
   try{const response=await fetch('/api/portal',{method:'POST',body:data});const result=await response.json() as {error?:string};if(!response.ok)throw Error(displayError(result.error,t("Upload failed.")));saved++;setItems(list=>list.filter(i=>i.id!==item.id));}
   catch(cause){setItems(list=>list.map(i=>i.id===item.id?{...i,error:(cause as Error).message||t("Check your connection.")}:i));}
  }
  if(saved<batch.length)setError(`${saved} uploaded. Review and retry the remaining files.`);
  await p.onSaved(saved,saved===batch.length);
  }finally{setRunning(false);p.setBusy(false);setProgress('');}
 }
 return <form onSubmit={upload}>
  <fieldset disabled={running} className="upload-fields"><label>{t("Course")}<select name="course" required value={course} onChange={e=>destination(e.target.value,exam)}>{p.courses.map(c=><option key={c.id} value={c.id}>{language==='ko'?`${c.grade}학년 / ${c.semester}학기`:`Year ${c.grade} / Semester ${c.semester}`} · {c.name}</option>)}</select></label>
  <div className="form-row"><label>{t("Exam")}<select name="exam" value={exam} onChange={e=>destination(course,e.target.value)}><option value="mid">{t("Midterm")}</option><option value="final">{t("Final")}</option><option value="common">{t("Shared")}</option></select></label><label>{t("Material type")}<select name="kind">{['요약본','족보','필기','기타'].map(k=><option value={k} key={k}>{t(displayKind(k))}</option>)}</select></label></div>
  <label>{t("Destination folder")}<select name="folder" required value={folder} onChange={e=>setFolder(e.target.value)}>{folders.map(f=><option key={f.id} value={f.id}>{displayFolderLabel(folders,f.id,language)}</option>)}</select></label>
  <label>{t("Access")}<select name="tier" defaultValue="1"><option value="1">{t("All approved members")}</option><option value="2">{t("Special access only")}</option></select></label>
  <label className="file-picker"><Upload size={24}/><strong>{t("Choose one or more files")}</strong><span>{t("Up to 25 MB per file. All files use the same destination.")}</span><input aria-label={t("Choose files to upload")} type="file" multiple onChange={e=>{pick(e.target.files);e.target.value='';}}/></label>
  {items.length>0&&<div className="upload-queue"><p>{t("Selected files")} <b>{items.length}</b>{t("· You can edit each title")}</p>{items.map((item,index)=><div className="upload-item" key={item.id}><label>{t("Title")} {index+1}<input required maxLength={120} value={item.title} onChange={e=>setItems(list=>list.map(i=>i.id===item.id?{...i,title:e.target.value}:i))}/><small>{item.file.name} · {(item.file.size/1024/1024).toFixed(2)} MB</small>{item.error&&<span className="upload-item-error" role="alert">{item.error}</span>}</label><button type="button" className="icon-button" aria-label={`${item.file.name} Remove`} onClick={()=>setItems(list=>list.filter(i=>i.id!==item.id))}><Trash2 size={16}/></button></div>)}</div>}
  </fieldset>
  {error&&<p className="batch-error" role="alert">{t(error)}</p>}{running&&<p className="batch-progress" role="status">{t("Uploading")} {progress}</p>}
  <button disabled={running||!items.length} className="button primary full">{running?t("Uploading…"):items.length?language==='ko'?`${items.length}개 파일 업로드`:`Upload ${items.length} files`:t("Choose files")}<Plus size={17}/></button>
 </form>;
}
