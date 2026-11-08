import {beforeEach,expect,it,vi} from 'vitest';
import {handleInsights,parseWeather,parseSports} from './insights-handler';
import {localDB} from '../server/local-db';
import type {Env} from './contracts';
const weather={name:'Abuja',sys:{country:'NG'},main:{temp:29.4,feels_like:31.2,humidity:62},wind:{speed:2.5},weather:[{id:801,description:'few clouds'}],dt:1794051600};
const football={success:1,result:[{event_key:1,event_home_team:'Home FC',event_away_team:'Away FC',event_final_result:'2 - 1',event_status:'65',league_name:'Test League',event_date:'2026-11-07',event_time:'18:30'}]};
let env:Env;
beforeEach(()=>{env={OPENWEATHERMAP_API_KEY:'synthetic-weather-private',ALLSPORTS_API_KEY:'synthetic-sports-private',QUOTA_HASH_KEY:crypto.randomUUID(),SEARCH_DB:localDB()};});
const request=(service:string,body:unknown,headers:Record<string,string>={})=>new Request(`https://no-group.org/api/${service}`,{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':'203.0.113.4',...headers},body:JSON.stringify(body)});
it('normalizes weather with metric values and observation time',()=>{expect(parseWeather(weather)).toMatchObject({city:'Abuja',temperature:29.4,wind:2.5,observedAt:1794051600000});expect(()=>parseWeather({})).toThrow();});
it('normalizes football, tennis, and cricket score formats',()=>{
 expect(parseSports(football,'football').matches[0]).toMatchObject({home:'Home FC',away:'Away FC',score:'2 - 1'});
 expect(parseSports({success:1,result:[{event_first_player:'Player A',event_second_player:'Player B',event_final_result:'1 - 0'}]},'tennis').matches[0]!.home).toBe('Player A');
 expect(parseSports({success:1,result:[{event_home_team:'A',event_away_team:'B',event_home_final_result:'120/3',event_away_final_result:'90/4'}]},'cricket').matches[0]!.score).toBe('120/3 / 90/4');
 expect(parseSports({success:1,result:[]},'football').matches).toEqual([]);expect(()=>parseSports({success:0,error:'unavailable'},'football')).toThrow();
});
it('keeps weather keys only in upstream requests and caches across clients',async()=>{
 const fetch=vi.fn().mockResolvedValue(Response.json(weather));const first=await handleInsights({request:request('weather',{city:'Abuja,NG'}),env},'weather',fetch);expect(first.status).toBe(200);const body=await first.text();expect(body).not.toContain('synthetic-weather-private');expect(body).not.toContain('appid');expect(JSON.parse(body).cached).toBe(false);
 const second=await handleInsights({request:request('weather',{city:'abuja,ng'},{'CF-Connecting-IP':'other'}),env},'weather',fetch);expect((await second.json() as {cached:boolean}).cached).toBe(true);expect(fetch).toHaveBeenCalledTimes(1);
 const url=fetch.mock.calls[0]![0] as URL;expect(url.hostname).toBe('api.openweathermap.org');expect(url.searchParams.get('appid')).toBe(env.OPENWEATHERMAP_API_KEY);expect(url.searchParams.get('units')).toBe('metric');expect(fetch.mock.calls[0]![1].redirect).toBe('error');
});
it('uses the AllSports endpoint/key and Africa/Lagos timezone',async()=>{
 const fetch=vi.fn().mockResolvedValue(Response.json(football));const response=await handleInsights({request:request('sports',{sport:'football'}),env},'sports',fetch);expect(response.status).toBe(200);const text=await response.text();expect(text).not.toContain('synthetic-sports-private');expect(text).not.toContain('APIkey');
 const url=fetch.mock.calls[0]![0] as URL;expect(url.href).toContain('https://apiv2.allsportsapi.com/football/');expect(url.searchParams.get('met')).toBe('Livescore');expect(url.searchParams.get('timezone')).toBe('Africa/Lagos');expect(url.searchParams.get('APIkey')).toBe(env.ALLSPORTS_API_KEY);
});
it('coalesces simultaneous same-city requests',async()=>{
 let finish!:(value:Response)=>void;const fetch=vi.fn().mockImplementation(()=>new Promise<Response>(resolve=>{finish=resolve;}));
 const first=handleInsights({request:request('weather',{city:'Abuja'}),env},'weather',fetch);const second=handleInsights({request:request('weather',{city:'Abuja'}),env},'weather',fetch);
 await vi.waitFor(()=>expect(fetch).toHaveBeenCalledTimes(1));finish(Response.json(weather));expect((await first).status).toBe(200);expect((await second).status).toBe(200);
});
it('does not cache provider errors or expose raw provider details',async()=>{
 const fetch=vi.fn().mockResolvedValue(new Response('secret upstream body',{status:401}));const response=await handleInsights({request:request('weather',{city:'Abuja'}),env},'weather',fetch);expect(response.status).toBe(502);expect(await response.text()).not.toContain('secret upstream body');
 fetch.mockResolvedValue(Response.json(weather));expect((await handleInsights({request:request('weather',{city:'Abuja'}),env},'weather',fetch)).status).toBe(200);expect(fetch).toHaveBeenCalledTimes(2);
});
it('respects persistent provider cooldown',async()=>{
 const fetch=vi.fn().mockResolvedValue(new Response('{}',{status:429,headers:{'Retry-After':'30'}}));expect((await handleInsights({request:request('weather',{city:'Abuja'}),env},'weather',fetch)).status).toBe(429);expect((await handleInsights({request:request('weather',{city:'Lagos'}),env},'weather',fetch)).status).toBe(429);expect(fetch).toHaveBeenCalledTimes(1);
});
it('validates origin, city, sport, key, and database before provider access',async()=>{
 const fetch=vi.fn();expect((await handleInsights({request:request('weather',{city:'Abuja'},{Origin:'https://evil.example'}),env},'weather',fetch)).status).toBe(403);
 for(const city of ['',null,'a'.repeat(101),'Abuja&appid=bad'])expect((await handleInsights({request:request('weather',{city}),env},'weather',fetch)).status).toBe(400);
 expect((await handleInsights({request:request('sports',{sport:'../../private'}),env},'sports',fetch)).status).toBe(400);
 expect((await handleInsights({request:request('weather',{city:'Abuja'}),env:{}},'weather',fetch)).status).toBe(503);
 expect((await handleInsights({request:request('weather',{city:'Abuja'}),env:{OPENWEATHERMAP_API_KEY:'configured'}},'weather',fetch)).status).toBe(503);expect(fetch).not.toHaveBeenCalled();
});
it('enforces durable weather budgets without disabling cached results',async()=>{
 env.WEATHER_DAILY_LIMIT='1';const fetch=vi.fn().mockResolvedValue(Response.json(weather));await handleInsights({request:request('weather',{city:'Abuja'}),env},'weather',fetch);
 expect((await handleInsights({request:request('weather',{city:'Lagos'}),env},'weather',fetch)).status).toBe(429);expect((await handleInsights({request:request('weather',{city:'Abuja'}),env},'weather',fetch)).status).toBe(200);expect(fetch).toHaveBeenCalledTimes(1);
});
