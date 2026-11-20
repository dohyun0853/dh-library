'use client';
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import translations from './translations.json';
type Language='en'|'ko';
const Context=createContext<{language:Language;setLanguage:(language:Language)=>void;t:(text:string)=>string}>({language:'en',setLanguage:()=>{},t:text=>text});
export function LanguageProvider({children}:{children:ReactNode}){
 const [language,setLanguageState]=useState<Language>('en');
 useEffect(()=>{try{if(localStorage.getItem('dh-library-language')==='ko')setLanguageState('ko');}catch{}},[]);
 useEffect(()=>{document.documentElement.lang=language;},[language]);
 function setLanguage(value:Language){setLanguageState(value);try{localStorage.setItem('dh-library-language',value);}catch{}}
 function t(text:string){return language==='ko'?(translations as Record<string,string>)[text]||text:text;}
 return <Context.Provider value={{language,setLanguage,t}}>{children}</Context.Provider>;
}
export const useLanguage=()=>useContext(Context);
