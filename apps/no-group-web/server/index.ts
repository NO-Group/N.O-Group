import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { crawl } from './crawler';
import { handleThumbnail } from '../platform/thumbnail-handler';
import { handleInsights } from '../platform/insights-handler';
import { handleSearch } from '../platform/search-handler';
import { timingSafeEqual } from 'node:crypto';
const development = process.env.NODE_ENV !== 'production';
const token = process.env.CRAWLER_SERVICE_TOKEN;
if (!development && (!token || token.length < 32)) throw Error('Production crawler requires a strong CRAWLER_SERVICE_TOKEN.');
const db = development ? (await import('./local-db')).localDB('.data/quota.sqlite') : undefined;
function authorized(value: string | undefined) {
  if (development) return true;
  const given = Buffer.from(value || ''); const expected = Buffer.from(`Bearer ${token}`);
  return given.length === expected.length && timingSafeEqual(given,expected);
}
let active = 0;
const attempts = new Map<string, number>();
async function handler(req: IncomingMessage, res: ServerResponse) {
  req.setTimeout(10000, () => req.destroy());
  res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
  const fail = (status: number, message: string) => { res.writeHead(status); res.end(JSON.stringify({ error: message })); };
  if (req.url?.startsWith('/api/thumbnail?') && development) {
    const result=await handleThumbnail(new Request(`http://${req.headers.host || 'localhost'}${req.url}`,{headers:{...(req.headers.origin?{Origin:req.headers.origin}:{}),...(req.headers['sec-fetch-site']?{'sec-fetch-site':String(req.headers['sec-fetch-site'])}:{})}}));res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));return;
  }
  if ((req.url==='/api/weather' || req.url==='/api/sports') && development) {
    if(req.method!=='POST')return fail(405,'Method not allowed.');
    let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)return fail(413,'Request too large.');}
    const origin=req.headers.origin && new URL(req.headers.origin).host===req.headers.host?req.headers.origin:`http://${req.headers.host||'localhost'}`;
    const incoming=new Request(`${origin}${req.url}`,{method:'POST',headers:{'Content-Type':req.headers['content-type']||'','CF-Connecting-IP':req.socket.remoteAddress||'local',...(req.headers.origin?{Origin:req.headers.origin}:{}),...(req.headers['sec-fetch-site']?{'sec-fetch-site':String(req.headers['sec-fetch-site'])}:{})},body});
    const result=await handleInsights({request:incoming,env:{...process.env,SEARCH_DB:db,QUOTA_HASH_KEY:process.env.QUOTA_HASH_KEY||'local-development-only-hash-key-not-for-production'}},req.url==='/api/weather'?'weather':'sports');res.writeHead(result.status,Object.fromEntries(result.headers));res.end(await result.text());return;
  }
  if (req.url === '/api/health') { res.end(JSON.stringify({status:'ok',mode:development ? 'development' : 'crawler'})); return; }
  if (req.url === '/api/search' && development) {
    if (req.method !== 'POST') return fail(405,'Method not allowed.');
    let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 4096) return fail(413,'Request too large.'); }
    if (!process.env.BRAVE_SEARCH_API_KEY) {
      let q: string; try { const input = JSON.parse(body); q = typeof input.q === 'string' ? input.q.trim().slice(0,500) : ''; } catch { return fail(400,'Invalid JSON.'); }
      res.end(JSON.stringify({demo:true,cacheAllowed:false,results:[{title:`${q} — N.O Group demo`,url:'https://no-group.org/',description:'Local demonstration only. Configure a server-side BRAVE_SEARCH_API_KEY for live results.'}]})); return;
    }
    const origin = req.headers.origin && new URL(req.headers.origin).host === req.headers.host ? req.headers.origin : `http://${req.headers.host || 'localhost'}`;
    const incoming = new Request(`${origin}/api/search`,{method:'POST',headers:{'Content-Type':req.headers['content-type'] || '', 'CF-Connecting-IP':req.socket.remoteAddress || 'local', ...(req.headers.origin ? {Origin:req.headers.origin} : {}), ...(req.headers['sec-fetch-site'] ? {'sec-fetch-site':String(req.headers['sec-fetch-site'])} : {})},body});
    const result = await handleSearch({request:incoming,env:{...process.env,SEARCH_DB:db,QUOTA_HASH_KEY:process.env.QUOTA_HASH_KEY || 'local-development-only-hash-key-not-for-production'}});
    res.writeHead(result.status,Object.fromEntries(result.headers));res.end(await result.text()); return;
  }
  if (req.url !== '/api/crawl' || req.method !== 'POST') return fail(404, 'Not found');
  if (!authorized(req.headers.authorization)) return fail(401,'Authentication required.');
  // Vite proxies same-origin JSON; cross-site browser forms cannot send this content type.
  if (req.headers['sec-fetch-site'] === 'cross-site') return fail(403, 'Cross-site requests are not allowed');
  if (!req.headers['content-type']?.startsWith('application/json')) return fail(415, 'JSON required');
  const ip = req.socket.remoteAddress || 'unknown'; const now = Date.now();
  for (const [key, time] of attempts) if (now - time > 60000) attempts.delete(key);
  if (active >= 2 || now - (attempts.get(ip) || 0) < 15000) return fail(429, 'Crawler busy. Wait 15 seconds and try again.');
  attempts.set(ip, now); active++;
  try {
    let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 4096) throw Error('Request too large'); }
    const input = JSON.parse(body); if (typeof input.url !== 'string') throw Error('Enter a public HTTPS URL.');
    if (!development) {
      const target = new URL(input.url); const allowed = (process.env.CRAWLER_ALLOWED_HOSTS || '').split(',').map(h => h.trim().toLowerCase());
      if (!allowed.includes(target.hostname)) return fail(403,'Website is not approved for crawling.');
    }
    const output = await crawl(input.url, Number(input.limit)); res.end(JSON.stringify(output));
  } catch (e) { fail(400, e instanceof Error ? e.message : 'Crawl failed'); }
  finally { active--; }
}
const server = createServer((req,res) => { void handler(req,res).catch(() => {
  console.error(JSON.stringify({event:'api_request_failed'}));
  if (!res.headersSent) { res.writeHead(500,{'Content-Type':'application/json'}); res.end(JSON.stringify({error:'Request failed.'})); } else res.destroy();
}); });
server.headersTimeout=10000;server.requestTimeout=15000;
server.listen(8788,'0.0.0.0',()=>console.log('API listening on 8788'));
for (const signal of ['SIGTERM','SIGINT'] as const) process.on(signal,()=>server.close(()=>process.exit(0)));
