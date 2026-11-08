import { defaultSearchOptions, readSearchOptions } from './search-options';
import type { SearchOptions } from './search-options';
import { parseResults } from './search-results';
export { parseResults } from './search-results';
export interface SearchResult { title: string; url: string; description: string; siteName?:string; age?:string; image?:string; snippets?:string[]; sitelinks?:{title:string;url:string}[] }
export interface SearchResponse { results: SearchResult[]; demo: boolean; cached?: boolean; cacheAllowed?: boolean; page?:number; hasMore?:boolean; correctedQuery?:string }
const CACHE_KEY = 'no-group:search-cache:v2';
const TTL = 15 * 60 * 1000;
type CacheEntry = { query: string; time: number; data: SearchResponse };
let memory: CacheEntry[] = [];
let blockedUntil = 0;
let cacheGeneration = 0;
const pending = new Map<string, Promise<SearchResponse>>();
const USAGE_KEY = 'no-group:api-usage:v1';
const LIMIT_KEY = 'no-group:api-limit:v1';
let usage = { day: '', calls: 0, saved: 0 };
let dailyLimit = 50;
export function getSearchUsage() {
  const day = new Date().toISOString().slice(0, 10);
  try {
    const raw = JSON.parse(localStorage.getItem(USAGE_KEY) || 'null');
    if (raw?.day === day && Number.isSafeInteger(raw.calls) && raw.calls >= 0 && Number.isSafeInteger(raw.saved) && raw.saved >= 0) usage = raw;
    const limit = Number(localStorage.getItem(LIMIT_KEY));
    if (Number.isSafeInteger(limit) && limit >= 1 && limit <= 10000) dailyLimit = limit;
  } catch { /* Memory fallback. */ }
  if (usage.day !== day) usage = { day, calls: 0, saved: 0 };
  return { ...usage, limit: dailyLimit };
}
export function setSearchLimit(limit: number) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10000) return;
  dailyLimit = limit;
  try { localStorage.setItem(LIMIT_KEY, String(limit)); } catch { /* Memory fallback. */ }
}
function record(field: 'calls' | 'saved') {
  getSearchUsage(); usage[field]++;
  try { localStorage.setItem(USAGE_KEY, JSON.stringify(usage)); } catch { /* Memory fallback. */ }
}
function forCaller(task: Promise<SearchResponse>, signal?: AbortSignal): Promise<SearchResponse> {
  if (!signal) return task;
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  return new Promise((resolve, reject) => {
    const abort = () => { cleanup(); reject(new DOMException('Aborted', 'AbortError')); };
    const cleanup = () => signal.removeEventListener('abort', abort);
    signal.addEventListener('abort', abort, { once: true });
    task.then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
  });
}
export class SearchError extends Error {
  constructor(message: string, public status: number, public retryAt = 0) { super(message); }
}
export function resetSearchState() { memory = []; blockedUntil = 0; pending.clear(); usage = { day: '', calls: 0, saved: 0 }; dailyLimit = 50; }
function entries(): CacheEntry[] {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(CACHE_KEY) || '[]');
    if (Array.isArray(raw)) memory = [...memory,...raw.filter((v): v is CacheEntry =>
      v && typeof v.query === 'string' && typeof v.time === 'number' && v.time <= Date.now() && Date.now() - v.time < TTL &&
      v.data?.demo === false && v.data?.cacheAllowed === true && Array.isArray(v.data.results) &&
      parseResults({ web: { results: v.data.results } }).length === v.data.results.length)];
  } catch { /* Private browsing and storage limits must not break search. */ }
  const unique = new Map<string,CacheEntry>();
  for (const entry of memory.sort((a,b)=>a.time-b.time)) if (Date.now()-entry.time<TTL) unique.set(entry.query,entry);
  memory = [...unique.values()].slice(-20);
  return memory;
}
function store(query: string, data: SearchResponse) {
  memory = [...entries().filter(v => v.query !== query), { query, time: Date.now(), data }].slice(-20);
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(memory)); } catch { /* In-memory cache remains available. */ }
}
export async function searchWeb(query: string, signal?: AbortSignal, inputOptions: SearchOptions = defaultSearchOptions): Promise<SearchResponse> {
  const options=readSearchOptions({...inputOptions});
  const q = query.trim().replace(/\s+/g, ' ');
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  if (!q) return { results: [], demo: false };
  const cacheKey=JSON.stringify([q,options]);
  const hit = entries().find(v => v.query === cacheKey);
  if (hit) { record('saved'); return { ...hit.data, cached: true }; }
  const existing = pending.get(cacheKey);
  if (existing) { record('saved'); return forCaller(existing, signal); }
  if (Date.now() < blockedUntil) throw new SearchError('Search is busy. Please try again shortly.', 429, blockedUntil);
  const budget = getSearchUsage();
  if (budget.calls >= budget.limit) throw new SearchError('Your daily browser request cap has been reached. Cached searches and quick tools still work.', 402);
  const generation = cacheGeneration;
  const task = (async (): Promise<SearchResponse> => {
  record('calls');
  const response = await fetch('/api/search', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({q,...options}), signal:AbortSignal.timeout(15000) });
  if (!response.ok) {
    if (response.status === 429) {
      const retry = response.headers?.get('Retry-After');
      const delay = retry ? (/^\d+$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry) - Date.now()) : 60000;
      blockedUntil = Date.now() + (Number.isFinite(delay) && delay > 0 ? delay : 60000);
      throw new SearchError('Search is busy. Please try again shortly.', 429, blockedUntil);
    }
    throw new SearchError(response.status===503?'Search is temporarily unavailable. Please try again shortly.':response.status===502?'The search provider could not complete this request. Please try again.':'Search is unavailable. Please try again.', response.status);
  }
  const payload = await response.json() as {results?: unknown;demo?:boolean;cacheAllowed?:boolean;page?:number;hasMore?:boolean;correctedQuery?:unknown};
  if (!Array.isArray(payload.results)) throw new SearchError('Invalid search response.',502);
  const data: SearchResponse = { results:parseResults({web:{results:payload.results}}), demo:payload.demo === true, cacheAllowed:payload.cacheAllowed === true,page:options.page,hasMore:payload.hasMore === true && options.page<9,...(typeof payload.correctedQuery==='string'?{correctedQuery:payload.correctedQuery.slice(0,500)}:{}) };
  if (data.cacheAllowed && !data.demo && generation === cacheGeneration) store(cacheKey, data);
  return data;
  })();
  pending.set(cacheKey, task);
  void task.then(() => pending.delete(cacheKey), () => pending.delete(cacheKey));
  return forCaller(task, signal);
}

export function clearSearchCache() { cacheGeneration++; memory = []; try { sessionStorage.removeItem(CACHE_KEY); sessionStorage.removeItem('no-group:search-cache:v1'); } catch { /* Optional storage. */ } }
