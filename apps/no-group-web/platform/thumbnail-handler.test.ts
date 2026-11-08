import {expect,it,vi} from 'vitest';
import {handleThumbnail} from './thumbnail-handler';
const req=(url:string)=>new Request(`https://no-group.org/api/thumbnail?url=${encodeURIComponent(url)}`);
it('blocks arbitrary network URLs before fetching',async()=>{
 const fetch=vi.fn();for(const url of ['https://127.0.0.1/x','https://example.com/x','http://imgs.search.brave.com/x'])expect((await handleThumbnail(req(url),fetch)).status).toBe(400);expect(fetch).not.toHaveBeenCalled();
});
it('does not forward secrets, cookies, or follow redirects',async()=>{
 const fetch=vi.fn().mockResolvedValue(new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'image/png'}}));const response=await handleThumbnail(req('https://imgs.search.brave.com/signed/x.png'),fetch);expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toBe('no-store');expect(fetch.mock.calls[0]![1]).toMatchObject({redirect:'error',headers:{Accept:expect.any(String)}});expect(JSON.stringify(fetch.mock.calls)).not.toContain('Subscription');expect(JSON.stringify(fetch.mock.calls)).not.toContain('Cookie');
});
it('rejects SVG/HTML content and oversized images',async()=>{
 expect((await handleThumbnail(req('https://imgs.search.brave.com/x'),vi.fn().mockResolvedValue(new Response('<svg/>',{headers:{'Content-Type':'image/svg+xml'}})))).status).toBe(502);
 expect((await handleThumbnail(req('https://imgs.search.brave.com/x'),vi.fn().mockResolvedValue(new Response(new Uint8Array(2*1024*1024+1),{headers:{'Content-Type':'image/png'}})))).status).toBe(413);
});
