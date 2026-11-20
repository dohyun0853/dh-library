export type ArchiveFolder = {id:string;name:string;parent:string;course?:string;builtin?:boolean};
export const DEFAULT_FOLDERS:ArchiveFolder[] = [
 {id:'past',name:'기출',parent:'',builtin:true},
 {id:'assignments',name:'과제',parent:'',builtin:true},
 {id:'books',name:'책자료',parent:'',builtin:true},
 {id:'notes',name:'필기·요약',parent:'',builtin:true},
 {id:'other',name:'기타',parent:'',builtin:true},
];
export function foldersForCourse(custom:ArchiveFolder[],course:string):ArchiveFolder[]{return [...DEFAULT_FOLDERS,...custom.filter(f=>f.course===course)];}
export function folderPath(folders:ArchiveFolder[],id:string):ArchiveFolder[]{
 const path:ArchiveFolder[]=[];const seen=new Set<string>();let current=id;
 while(current&&!seen.has(current)&&path.length<12){seen.add(current);const f=folders.find(f=>f.id===current);if(!f)break;path.unshift(f);current=f.parent;}
 return path;
}
export function folderLabel(folders:ArchiveFolder[],id:string){return folderPath(folders,id).map(f=>f.name).join(' / ');}

const COMMON_ROOTS=new Set(['books','other']);
const EXAM_ROOTS=new Set(['past','assignments','notes']);
export function folderGroup(folders:ArchiveFolder[],id:string):'common'|'exam'|'custom'{
 const root=folderPath(folders,id)[0]?.id;
 return root&&COMMON_ROOTS.has(root)?'common':root&&EXAM_ROOTS.has(root)?'exam':'custom';
}
export function foldersForExam(custom:ArchiveFolder[],course:string,exam:string):ArchiveFolder[]{
 const all=foldersForCourse(custom,course);
 return all.filter(f=>{const group=folderGroup(all,f.id);return exam==='common'?group!=='exam':exam==='mid'||exam==='final'?group!=='common':true;});
}
export function folderAllowed(folders:ArchiveFolder[],id:string,exam:string){
 if(!folders.some(f=>f.id===id))return false;
 const group=folderGroup(folders,id);
 return exam==='common'?group!=='exam':(exam==='mid'||exam==='final')&&group!=='common';
}
export function materialForDisplay<T extends {course:string;folder:string;exam:string}>(file:T,custom:ArchiveFolder[]):T{
 const all=foldersForCourse(custom,file.course);const group=folderGroup(all,file.folder);
 if(group==='common')return {...file,exam:'common'};
 // Previously common exam materials remain reachable in Common > Other.
 if(file.exam==='common'&&group==='exam')return {...file,folder:'other'};
 return file;
}

export function folderDisplay(f:ArchiveFolder){return f.builtin?({past:'Past exams',assignments:'Assignments',books:'Books',notes:'Notes & summaries',other:'Other'} as Record<string,string>)[f.id]||f.name:f.name;}
export function displayFolderLabel(folders:ArchiveFolder[],id:string,language:'ko'|'en'='en'){return folderPath(folders,id).map(f=>language==='ko'?f.name:folderDisplay(f)).join(' / ');}
export function displayKind(kind:string){return ({'요약본':'Summaries','족보':'Past exams','필기':'Notes','기타':'Other'} as Record<string,string>)[kind]||kind;}
