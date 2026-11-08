import { bodyJSON, json, sameOrigin } from '../../platform/contracts';
import type { Context } from '../../platform/contracts';
import { reserve } from '../../platform/quota';
export async function onRequest({request,env}: Context) {
  if (request.method !== 'POST') return json({error:'Method not allowed.'},405,{Allow:'POST'});
  if (!sameOrigin(request)) return json({error:'Cross-site requests are not allowed.'},403);
  if (!env.CRAWLER_SERVICE_URL || !env.CRAWLER_SERVICE_TOKEN || !env.CRAWLER_ALLOWED_HOSTS) return json({error:'Crawler is not configured for this deployment.'},503);
  try {
    const body = await bodyJSON(request); if (typeof body.url !== 'string') return json({error:'A public HTTPS URL is required.'},400);
    const target = new URL(body.url);
    const hosts = env.CRAWLER_ALLOWED_HOSTS.split(',').map(h => h.trim().toLowerCase());
    if (target.protocol !== 'https:' || target.username || target.password || (target.port && target.port !== '443') || !hosts.includes(target.hostname)) return json({error:'This deployment only crawls explicitly approved HTTPS websites.'},400);
    const upstream = new URL(env.CRAWLER_SERVICE_URL); if (upstream.protocol !== 'https:') return json({error:'Crawler service is misconfigured.'},503);
    if (!await reserve(env,request.headers.get('CF-Connecting-IP') || 'unknown','crawl')) return json({error:'Crawl limit reached. Please try later.'},429,{'Retry-After':'60'});
    const response = await fetch(upstream,{method:'POST',redirect:'error',signal:AbortSignal.timeout(90000),headers:{'Content-Type':'application/json',Authorization:`Bearer ${env.CRAWLER_SERVICE_TOKEN}`},body:JSON.stringify({url:target.href,limit:Math.min(5,Math.max(1,Number(body.limit)||1))})});
    if (!response.ok) return json({error:response.status === 429 ? 'Crawler busy. Try again shortly.' : 'Crawler service is unavailable.'},response.status === 429 ? 429 : 502);
    const data: unknown = await response.json();
    return json(data);
  } catch { return json({error:'Crawler request failed. Check the URL or try later.'},503); }
}
