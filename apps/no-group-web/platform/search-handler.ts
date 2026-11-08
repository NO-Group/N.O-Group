import { boundedJSON, bodyJSON, json, sameOrigin } from './contracts';
import type { Context } from './contracts';
import { reserve } from './quota';
import { readSearchOptions } from '../src/lib/search-options';
import type { SearchOptions } from '../src/lib/search-options';
import { parseResults } from '../src/lib/search-results';
export async function handleSearch({ request, env }: Context, providerFetch: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' },405,{ Allow:'POST' });
  if (!sameOrigin(request)) return json({ error: 'Cross-site requests are not allowed.' },403);
  let q: string; let options:SearchOptions;
  try { const body = await bodyJSON(request); options=readSearchOptions(body); if (typeof body.q !== 'string') throw Error('Enter a search query.'); q = body.q.trim().replace(/\s+/g,' '); if (!q || q.length > 500) throw Error('Query must contain 1–500 characters.'); }
  catch (error) { return json({ error: error instanceof Error ? error.message : 'Invalid request.' },400); }
  if (!env.BRAVE_SEARCH_API_KEY?.trim() || !env.SEARCH_DB || !env.QUOTA_HASH_KEY) return json({ error:'Search is not configured. Please try again later.' },503);
  try {
    const cooldown = await env.SEARCH_DB.prepare('SELECT until_ms FROM provider_cooldown WHERE service = ?').bind('search').first<{ until_ms: number }>();
    if (cooldown && cooldown.until_ms > Date.now()) return json({ error:'Search provider is cooling down.' },429,{ 'Retry-After': String(Math.ceil((cooldown.until_ms-Date.now())/1000)) });
    if (!await reserve(env, request.headers.get('CF-Connecting-IP') || 'unknown', 'search')) return json({ error:'Search request budget reached. Please try later.' },429,{ 'Retry-After':'60' });
    const url = new URL('https://api.search.brave.com/res/v1/web/search'); url.searchParams.set('q',q); url.searchParams.set('count','10'); url.searchParams.set('offset',String(options.page));url.searchParams.set('safesearch',options.safeSearch);url.searchParams.set('text_decorations','false');url.searchParams.set('extra_snippets','true'); if(options.country!=='ALL')url.searchParams.set('country',options.country);if(options.freshness)url.searchParams.set('freshness',options.freshness);
    const response = await providerFetch(url, { headers:{ Accept:'application/json', 'X-Subscription-Token':env.BRAVE_SEARCH_API_KEY.trim() }, signal:AbortSignal.timeout(10000), redirect:'error' });
    if (response.status === 429) {
      const raw = response.headers.get('Retry-After'); const delay = raw && /^\d+$/.test(raw) ? Number(raw) : raw ? (Date.parse(raw)-Date.now())/1000 : 60;
      const seconds = Number.isFinite(delay) && delay > 0 ? Math.min(86400,Math.ceil(delay)) : 60;
      await env.SEARCH_DB.prepare('INSERT INTO provider_cooldown(service,until_ms) VALUES (?,?) ON CONFLICT(service) DO UPDATE SET until_ms = MAX(until_ms,excluded.until_ms)').bind('search',Date.now()+seconds*1000).run();
      return json({ error:'Search provider rate limit reached.' },429,{ 'Retry-After':String(seconds) });
    }
    if (!response.ok) {console.error(JSON.stringify({event:'search_provider_error',status:response.status}));return json({ error:'Search provider is unavailable.' },502);}
    const payload: unknown = await boundedJSON(response);
    if (!payload || typeof payload !== 'object') return json({error:'Search provider returned an invalid response.'},502);
    const raw=payload as {web?:{results?:unknown};query?:{original?:unknown;altered?:unknown;more_results_available?:unknown}};
    if (raw.web?.results !== undefined && !Array.isArray(raw.web.results))return json({error:'Search provider returned an invalid response.'},502);
    if (!raw.web && !raw.query)return json({error:'Search provider returned an invalid response.'},502);
    const results=parseResults(payload);
    const correctedQuery=typeof raw.query?.altered==='string'?raw.query.altered.slice(0,500):undefined;
    return json({results,demo:false,cacheAllowed:env.SEARCH_RESULT_CACHE==='true',page:options.page,hasMore:options.page<9 && (typeof raw.query?.more_results_available==='boolean'?raw.query.more_results_available:results.length===10),...(correctedQuery && correctedQuery!==q?{correctedQuery}:{})});
  } catch (error) {
    console.error(JSON.stringify({ event:'search_failed', type:error instanceof Error ? error.name : 'UnknownError' }));
    return json({ error:'Search is temporarily unavailable.' },503);
  }
}
