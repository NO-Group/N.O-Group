import { decodeHTML } from 'entities';
import type { SearchResult } from './search';
export function plainText(value: string) { return decodeHTML(value.replace(/<[^>]*>/g,'')).trim(); }
export function safeLink(value: unknown): string | undefined {
  if(typeof value!=='string')return;
  try {const url=new URL(value);if(['https:','http:'].includes(url.protocol) && !url.username && !url.password)return url.href;}catch{ /* Invalid provider link. */ }
}
export function thumbnailLink(value: unknown): string | undefined {
  const link=safeLink(value);if(link && new URL(link).protocol==='https:' && new URL(link).hostname==='imgs.search.brave.com' && !new URL(link).port)return link;
}
export function parseResults(payload: unknown): SearchResult[] {
  const items=(payload as {web?:{results?:unknown}}|null)?.web?.results;if(!Array.isArray(items))return [];
  return items.flatMap((item:unknown):SearchResult[]=>{
    if(!item || typeof item!=='object')return [];
    const r=item as Record<string,unknown>;const url=safeLink(r.url);if(typeof r.title!=='string' || !url)return [];
    const result:SearchResult={title:plainText(r.title).slice(0,500)||new URL(url).hostname,url,description:typeof r.description==='string'?plainText(r.description).slice(0,3000):''};
    const profile=r.profile as {name?:unknown}|undefined; if(typeof profile?.name==='string')result.siteName=plainText(profile.name).slice(0,100);
    if(typeof r.siteName==='string')result.siteName=plainText(r.siteName).slice(0,100);
    if(typeof r.age==='string')result.age=plainText(r.age).slice(0,60);
    const thumbnail=r.thumbnail as {src?:unknown}|undefined; const image=thumbnailLink(thumbnail?.src || r.image);if(image)result.image=image;
    const snippets=r.extra_snippets || r.snippets;if(Array.isArray(snippets))result.snippets=snippets.filter((v):v is string=>typeof v==='string').slice(0,3).map(v=>plainText(v).slice(0,1000)).filter(v=>v!==result.description);
    const cluster=r.cluster || r.sitelinks;if(Array.isArray(cluster))result.sitelinks=cluster.flatMap(v=>{if(!v || typeof v!=='object')return [];const link=safeLink(v.url);return typeof v.title==='string' && link && new URL(link).hostname===new URL(url).hostname?[{title:plainText(v.title).slice(0,150),url:link}]:[];}).slice(0,4);
    return [result];
  });
}
