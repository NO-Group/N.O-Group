import {boundedJSON,bodyJSON,json,sameOrigin} from './contracts';
import type {Context,Env} from './contracts';
import {reserve} from './quota';
import type {WeatherData,SportsData,Match,Sport} from '../src/lib/insights';
const pending=new Map<string,Promise<Response>>();
const object=(v:unknown):Record<string,unknown>=>v && typeof v==='object' && !Array.isArray(v)?v as Record<string,unknown>:{};
const text=(v:unknown,max=150)=>typeof v==='string'?v.slice(0,max):typeof v==='number'?String(v):'';
const number=(v:unknown)=>typeof v==='number' && Number.isFinite(v)?v:undefined;
export function parseWeather(raw:unknown):WeatherData {
  const r=object(raw),main=object(r.main),wind=object(r.wind),sys=object(r.sys),condition=object(Array.isArray(r.weather)?r.weather[0]:null);
  const temperature=number(main.temp),feelsLike=number(main.feels_like),humidity=number(main.humidity),speed=number(wind.speed),observedAt=number(r.dt);
  if(!text(r.name) || temperature===undefined || feelsLike===undefined || humidity===undefined || speed===undefined || observedAt===undefined)throw Error('Invalid weather response');
  if(humidity<0 || humidity>100 || speed<0 || observedAt<=0)throw Error('Invalid weather values');
  return {city:text(r.name),country:text(sys.country,3),temperature,feelsLike,humidity,wind:speed,description:text(condition.description)||'Current weather',condition:number(condition.id)||800,observedAt:observedAt*1000};
}
export function parseSports(raw:unknown,sport:Sport):SportsData {
  const r=object(raw);if(Number(r.success)!==1 || !Array.isArray(r.result))throw Error('Invalid sports response');
  const matches:Match[]=r.result.slice(0,100).flatMap((entry:unknown)=>{
    const v=object(entry);const home=text(v.event_home_team || v.event_first_player),away=text(v.event_away_team || v.event_second_player);if(!home || !away)return [];
    const score=text(v.event_final_result,100)||(v.event_home_final_result || v.event_away_final_result?`${text(v.event_home_final_result,50)||'—'} / ${text(v.event_away_final_result,50)||'—'}`:'—');
    return [{id:text(v.event_key)||`${home}-${away}-${text(v.event_date)}-${text(v.event_time)}`,home,away,score,status:text(v.event_status || v.event_status_info,100)||'In progress',league:text(v.league_name)||sport,date:text(v.event_date,20),time:text(v.event_time,20)}];
  });
  if(r.result.length && !matches.length)throw Error('Unsupported sports response');
  return {sport,matches};
}
async function hash(value:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function load(env:Env,service:'weather'|'sports',cacheKey:string,url:URL,ip:string,providerFetch:typeof fetch):Promise<Response> {
  const db=env.SEARCH_DB!;const now=Date.now();
  const cached=await db.prepare('SELECT data_json, expires_at FROM widget_cache WHERE cache_key = ? AND expires_at > ?').bind(cacheKey,now).first<{data_json:string;expires_at:number}>();
  if(cached){try{return json({...JSON.parse(cached.data_json),cached:true});}catch{/* Re-fetch a corrupt cache record. */}}
  const cooldown=await db.prepare('SELECT until_ms FROM provider_cooldown WHERE service = ?').bind(service).first<{until_ms:number}>();
  if(cooldown && cooldown.until_ms>now)return json({error:'Provider is cooling down. Please try later.'},429,{'Retry-After':String(Math.ceil((cooldown.until_ms-now)/1000))});
  if(!await reserve(env,ip,service))return json({error:'Daily or per-minute request limit reached. Cached data remains available.'},429,{'Retry-After':'60'});
  const response=await providerFetch(url,{redirect:'error',signal:AbortSignal.timeout(10000),headers:{Accept:'application/json'}});
  if(response.status===429){const raw=response.headers.get('Retry-After');const delay=raw && /^\d+$/.test(raw)?Number(raw):raw?(Date.parse(raw)-now)/1000:60;const seconds=Number.isFinite(delay) && delay>0?Math.min(86400,Math.ceil(delay)):60;await db.prepare('INSERT INTO provider_cooldown(service,until_ms) VALUES (?,?) ON CONFLICT(service) DO UPDATE SET until_ms = MAX(until_ms,excluded.until_ms)').bind(service,now+seconds*1000).run();return json({error:'Provider request limit reached. Please try later.'},429,{'Retry-After':String(seconds)});}
  if(response.status===404 && service==='weather')return json({error:'City not found. Try a city and country code, for example Abuja,NG.'},404);
  if(!response.ok){console.error(JSON.stringify({event:'insight_provider_error',service,status:response.status}));return json({error:'Provider could not supply this data. Check the server key and subscription.'},502);}
  const payload=await boundedJSON(response);
  const data=service==='weather'?parseWeather(payload):parseSports(payload,url.pathname.split('/').filter(Boolean)[0] as Sport);
  const fetchedAt=Date.now(),expiresAt=fetchedAt+(service==='weather'?600000:60000);const result={data,fetchedAt,expiresAt};
  // Only normalized public data is stored. Provider URLs and keys are never cached or returned.
  await db.prepare('INSERT INTO widget_cache(cache_key,data_json,expires_at) VALUES (?,?,?) ON CONFLICT(cache_key) DO UPDATE SET data_json=excluded.data_json,expires_at=excluded.expires_at').bind(cacheKey,JSON.stringify(result),expiresAt).run();
  try{await db.prepare('DELETE FROM widget_cache WHERE expires_at < ?').bind(fetchedAt).run();}catch{/* Best-effort expiry maintenance. */}
  return json({...result,cached:false});
}
export async function handleInsights({request,env}:Context,service:'weather'|'sports',providerFetch:typeof fetch=fetch):Promise<Response> {
  if(request.method!=='POST')return json({error:'Method not allowed'},405,{Allow:'POST'});
  if(!sameOrigin(request))return json({error:'Cross-site requests are not allowed'},403);
  let url:URL;let identity:string;
  try{
    const body=await bodyJSON(request);
    if(service==='weather'){
      if(typeof body.city!=='string' || !body.city.trim() || body.city.length>100 || !/^[\p{L}\p{M}\p{N} ,.'’\-]+$/u.test(body.city))return json({error:'Enter a city name, optionally followed by its country code.'},400);
      const city=body.city.trim().replace(/\s+/g,' ').replace(/\s*,\s*/g,',');identity=city.toLocaleLowerCase('en');url=new URL('https://api.openweathermap.org/data/2.5/weather');url.searchParams.set('q',city);url.searchParams.set('units','metric');
      if(!env.OPENWEATHERMAP_API_KEY)return json({error:'Weather is not configured for this deployment.'},503);url.searchParams.set('appid',env.OPENWEATHERMAP_API_KEY.trim());
    }else{
      const sport=body.sport??'football';if(!['football','basketball','tennis','cricket'].includes(String(sport)) || typeof sport!=='string')return json({error:'Choose football, basketball, tennis, or cricket.'},400);
      identity=sport;url=new URL(`https://apiv2.allsportsapi.com/${sport}/`);url.searchParams.set('met','Livescore');url.searchParams.set('timezone','Africa/Lagos');
      if(!env.ALLSPORTS_API_KEY)return json({error:'Sports data is not configured for this deployment.'},503);url.searchParams.set('APIkey',env.ALLSPORTS_API_KEY.trim());
    }
  }catch{return json({error:'Invalid request. Use a JSON object.'},400);}
  if(!env.SEARCH_DB || !env.QUOTA_HASH_KEY || env.QUOTA_HASH_KEY.length<32)return json({error:'Data service quota storage is not configured.'},503);
  try{
    const cacheKey=`${service}:${await hash(identity)}`;const pendingKey=`${cacheKey}:${await hash(env.QUOTA_HASH_KEY)}`;
    const existing=pending.get(pendingKey);if(existing)return (await existing).clone();
    const task=load(env,service,cacheKey,url,request.headers.get('CF-Connecting-IP')||'unknown',providerFetch);pending.set(pendingKey,task);
    try{return (await task).clone();}finally{pending.delete(pendingKey);}
  }catch(error){console.error(JSON.stringify({event:'insight_failed',service,type:error instanceof Error?error.name:'UnknownError'}));return json({error:'Data is temporarily unavailable. Try again later; some sports may require a different subscription.'},503);}
}
