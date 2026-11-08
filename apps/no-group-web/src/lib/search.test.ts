import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseResults, searchWeb, resetSearchState, setSearchLimit, clearSearchCache } from './search';
const result = { title:'Example',url:'https://example.com/',description:'Description' };
function setup(cacheAllowed = true) {
  const storage = new Map<string,string>();
  vi.stubGlobal('sessionStorage',{getItem:(key:string)=>storage.get(key) ?? null,setItem:(key:string,v:string)=>storage.set(key,v),removeItem:(key:string)=>storage.delete(key)});
  const fetch = vi.fn().mockResolvedValue({ok:true,json:async()=>({results:[result],demo:false,cacheAllowed})}); vi.stubGlobal('fetch',fetch); return fetch;
}
afterEach(()=>{resetSearchState();vi.useRealTimers();vi.unstubAllGlobals();});
describe('same-origin search client',()=>{
  it('parses only safe complete result cards',()=>{
    expect(parseResults(null)).toEqual([]);
    expect(parseResults({web:{results:[result,{...result,url:'javascript:alert(1)'},null,{title:'bad'}]}})).toEqual([result]);
  });
  it('never sends a provider token to the browser endpoint',async()=>{
    const fetch=setup(); await searchWeb('cloud & sync');
    expect(fetch.mock.calls[0]).toEqual(['/api/search',expect.objectContaining({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q:'cloud & sync',page:0,freshness:'',country:'ALL',safeSearch:'moderate'})})]);
  });
  it('never requests empty or pre-aborted input',async()=>{
    const fetch=setup();await searchWeb(' ');const c=new AbortController();c.abort();await expect(searchWeb('hi',c.signal)).rejects.toMatchObject({name:'AbortError'});expect(fetch).not.toHaveBeenCalled();
  });
  it('uses persistent permitted session cache with whitespace normalization',async()=>{
    const fetch=setup();await searchWeb('Flutter   glassmorphism'); resetSearchState(); expect((await searchWeb('Flutter glassmorphism')).cached).toBe(true);expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('does not store results unless the server permits caching',async()=>{
    const fetch=setup(false);await searchWeb('cloud');await searchWeb('cloud');expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('expires after 15 minutes and clears on request',async()=>{
    vi.useFakeTimers();const fetch=setup();await searchWeb('cloud');vi.advanceTimersByTime(900001);await searchWeb('cloud');clearSearchCache();await searchWeb('cloud');expect(fetch).toHaveBeenCalledTimes(3);
  });
  it('falls back to memory if session storage is blocked',async()=>{
    const fetch=setup();vi.stubGlobal('sessionStorage',{getItem:()=>{throw Error();},setItem:()=>{throw Error();}});await searchWeb('cloud');expect((await searchWeb('cloud')).cached).toBe(true);expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('keeps memory cache if writes fail but reads are permitted',async()=>{
    const fetch=setup();vi.stubGlobal('sessionStorage',{getItem:()=>null,setItem:()=>{throw Error();}});await searchWeb('cloud');expect((await searchWeb('cloud')).cached).toBe(true);expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('coalesces calls without cancelling another consumer',async()=>{
    const fetch=setup();let finish!:(v:unknown)=>void;fetch.mockReturnValue(new Promise(r=>{finish=r;}));const c=new AbortController();const first=searchWeb('cloud',c.signal);const second=searchWeb('cloud');c.abort();await expect(first).rejects.toMatchObject({name:'AbortError'});finish({ok:true,json:async()=>({results:[result],demo:false,cacheAllowed:true})});await second;expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('respects provider cooldown while keeping cache available',async()=>{
    vi.useFakeTimers();const fetch=setup();await searchWeb('cached');fetch.mockResolvedValue({ok:false,status:429,headers:new Headers({'Retry-After':'30'})});await expect(searchWeb('new')).rejects.toMatchObject({status:429,retryAt:Date.now()+30000});await expect(searchWeb('other')).rejects.toMatchObject({status:429});expect((await searchWeb('cached')).cached).toBe(true);expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('fails cleanly on unconfigured or malformed backends',async()=>{
    const fetch=setup();fetch.mockResolvedValueOnce({ok:false,status:503});await expect(searchWeb('one')).rejects.toMatchObject({status:503});fetch.mockResolvedValueOnce({ok:true,json:async()=>({})});await expect(searchWeb('two')).rejects.toMatchObject({status:502});
  });
  it('keeps the optional browser request cap',async()=>{
    const fetch=setup();setSearchLimit(1);await searchWeb('one');await expect(searchWeb('two')).rejects.toMatchObject({status:402});expect(fetch).toHaveBeenCalledTimes(1);
  });
});

it('partitions cached results by page and filters',async()=>{
  const fetch=setup();const options={page:0,freshness:'' as const,country:'ALL' as const,safeSearch:'moderate' as const};
  await searchWeb('cloud',undefined,options);await searchWeb('cloud',undefined,{...options,page:1});await searchWeb('cloud',undefined,{...options,country:'NG'});
  expect((await searchWeb('cloud',undefined,options)).cached).toBe(true);expect(fetch).toHaveBeenCalledTimes(3);
});
