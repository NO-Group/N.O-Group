import {safeLink} from './search-results';
export interface SavedLink {url:string;label:string;note:string;savedAt:number}
export const READING_LIST_KEY='no-group:reading-list:v1';
export function validateSavedLinks(value:unknown):SavedLink[]{
 if(!Array.isArray(value))return [];
 const seen=new Set<string>();return value.flatMap(v=>{
  if(!v || typeof v!=='object')return [];
  const url=safeLink(v.url);if(!url || url.length>8192 || seen.has(url) || typeof v.savedAt!=='number' || !Number.isFinite(v.savedAt) || v.savedAt<0 || v.savedAt>Date.now()+86400000)return [];seen.add(url);
  return [{url,label:typeof v.label==='string'?v.label.slice(0,120):new URL(url).hostname,note:typeof v.note==='string'?v.note.slice(0,500):'',savedAt:v.savedAt}];
 }).slice(0,100);
}
export function readSavedLinks():SavedLink[]{try{return validateSavedLinks(JSON.parse(localStorage.getItem(READING_LIST_KEY)||'[]'));}catch{return [];}}
export function writeSavedLinks(links:SavedLink[]):boolean{try{localStorage.setItem(READING_LIST_KEY,JSON.stringify(links));return true;}catch{return false;}}
export function saveLink(links:SavedLink[],url:string,now=Date.now()):SavedLink[]{
 const safe=safeLink(url);if(!safe || safe.length>8192 || links.some(v=>v.url===safe))return links;
 return [{url:safe,label:new URL(safe).hostname,note:'',savedAt:now},...links].slice(0,100);
}
export function exportReadingList(links:SavedLink[]){return JSON.stringify({format:'no-group-reading-list',version:1,exportedAt:new Date().toISOString(),links},null,2);}

/** Import only our portable reference format; never restore provider response data. */
export function importReadingList(text:string,current:SavedLink[]):{links:SavedLink[];added:number;skipped:number}{
 let value:unknown;try{value=JSON.parse(text);}catch{throw Error('Choose a valid reading-list JSON export.');}
 if(!value || typeof value!=='object' || !('format' in value) || value.format!=='no-group-reading-list' || !('version' in value) || value.version!==1 || !('links' in value) || !Array.isArray(value.links) || value.links.length>100)throw Error('This is not a supported N.O Group reading-list export (version 1, up to 100 links).');
 const valid=validateSavedLinks(value.links),seen=new Set(current.map(link=>link.url));const fresh=valid.filter(link=>!seen.has(link.url));const added=Math.min(fresh.length,Math.max(0,100-current.length));
 return {links:[...current,...fresh.slice(0,added)],added,skipped:value.links.length-added};
}
