import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleSearch } from './search-handler';
import { reserve } from './quota';
import { localDB } from '../server/local-db';
import type { Env } from './contracts';
let env: Env;
beforeEach(()=>{env={BRAVE_SEARCH_API_KEY:'synthetic-test-secret-not-real',QUOTA_HASH_KEY:'test-quota-key-at-least-thirty-two-characters',SEARCH_DB:localDB()};});
function request(q:unknown='cloud',extra:Record<string,string>={}) {return new Request('https://no-group.org/api/search',{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':'203.0.113.7',...extra},body:JSON.stringify({q})});}
describe('production search boundary',()=>{
  it('fails closed without a key or durable quota configuration',async()=>{
    const upstream=vi.fn();const response=await handleSearch({request:request(),env:{}},upstream);expect(response.status).toBe(503);expect(upstream).not.toHaveBeenCalled();
  });
  it('rejects cross-origin requests and invalid query input before provider calls',async()=>{
    const upstream=vi.fn();expect((await handleSearch({request:request('cloud',{Origin:'https://evil.example'}),env},upstream)).status).toBe(403);
    for(const q of ['',null,'a'.repeat(501)])expect((await handleSearch({request:request(q),env},upstream)).status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });
  it('injects the private token only upstream and filters unsafe results',async()=>{
    const upstream=vi.fn().mockResolvedValue(Response.json({web:{results:[{title:'Safe',url:'https://example.com',description:'Text'},{title:'Bad',url:'javascript:alert(1)',description:'x'}]}}));
    const response=await handleSearch({request:request(),env},upstream);const output=await response.text();expect(response.status).toBe(200);expect(output).not.toContain('synthetic-test-secret');expect(JSON.parse(output).results).toHaveLength(1);expect(JSON.parse(output).cacheAllowed).toBe(false);
    expect(upstream.mock.calls[0]![1].headers['X-Subscription-Token']).toBe(env.BRAVE_SEARCH_API_KEY);
  });
  it('enforces an atomic global daily cap across different clients',async()=>{
    env.SEARCH_DAILY_LIMIT='2';const outcomes=await Promise.all(Array.from({length:12},(_,i)=>reserve(env,`ip-${i}`,'search')));expect(outcomes.filter(Boolean)).toHaveLength(2);
  });
  it('enforces per-client minute limits and hashes client identifiers',async()=>{
    env.SEARCH_IP_MINUTE_LIMIT='1';expect(await reserve(env,'client-private-ip','search')).toBe(true);expect(await reserve(env,'client-private-ip','search')).toBe(false);
    const stored=await env.SEARCH_DB!.prepare('SELECT client FROM request_reservations LIMIT 1').first<{client:string}>();expect(stored!.client).toMatch(/^[a-f0-9]{64}$/);expect(stored!.client).not.toContain('client-private-ip');
  });
  it('persists provider cooldown and does not spend another provider request',async()=>{
    const upstream=vi.fn().mockResolvedValue(new Response('{}',{status:429,headers:{'Retry-After':'120'}}));
    const first=await handleSearch({request:request(),env},upstream);expect(first.status).toBe(429);expect(first.headers.get('Retry-After')).toBe('120');
    expect((await handleSearch({request:request('other'),env},upstream)).status).toBe(429);expect(upstream).toHaveBeenCalledTimes(1);
  });
  it('sanitizes upstream failures and malformed payloads',async()=>{
    for(const result of [new Response('private-provider-error',{status:401}),Response.json({unexpected:true})]){
      const response=await handleSearch({request:request(),env},vi.fn().mockResolvedValue(result));expect(response.status).toBe(502);expect(await response.text()).not.toContain('private-provider-error');
    }
  });
  it('blocks oversized body streams',async()=>{
    const response=await handleSearch({request:request('x'.repeat(5000)),env},vi.fn());expect(response.status).toBe(400);
  });
});
it('forwards validated pagination and filters and returns correction metadata',async()=>{
 const upstream=vi.fn().mockResolvedValue(Response.json({web:{results:[]},query:{altered:'cloud sync',more_results_available:true}}));
 const incoming=new Request('https://no-group.org/api/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q:'clod sync',page:2,country:'NG',freshness:'pw',safeSearch:'strict'})});
 const response=await handleSearch({request:incoming,env},upstream);expect(response.status).toBe(200);const payload=await response.json() as Record<string,unknown>;expect(payload.page).toBe(2);expect(payload.hasMore).toBe(true);expect(payload.correctedQuery).toBe('cloud sync');
 const url=upstream.mock.calls[0]![0] as URL;expect(url.searchParams.get('offset')).toBe('2');expect(url.searchParams.get('country')).toBe('NG');expect(url.searchParams.get('freshness')).toBe('pw');expect(url.searchParams.get('safesearch')).toBe('strict');expect(url.searchParams.get('text_decorations')).toBe('false');
});
it('handles a legitimate empty provider result without a web section',async()=>{
 const response=await handleSearch({request:request(),env},vi.fn().mockResolvedValue(Response.json({query:{original:'empty',more_results_available:false}})));expect(response.status).toBe(200);expect(await response.json()).toMatchObject({results:[],hasMore:false});
});
it('rejects invalid paging options without spending a provider request',async()=>{
 const upstream=vi.fn();const incoming=new Request('https://no-group.org/api/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q:'cloud',page:100})});expect((await handleSearch({request:incoming,env},upstream)).status).toBe(400);expect(upstream).not.toHaveBeenCalled();
});
