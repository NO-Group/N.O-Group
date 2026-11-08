import type { Env } from './contracts';
export function bounded(value: string | undefined, fallback: number, max: number) {
  const n = Number(value); return Number.isSafeInteger(n) && n > 0 && n <= max ? n : fallback;
}
export async function reserve(env: Env, ip: string, service: 'search' | 'crawl' | 'weather' | 'sports', now = Date.now()): Promise<boolean> {
  if (!env.SEARCH_DB || !env.QUOTA_HASH_KEY || env.QUOTA_HASH_KEY.length < 32) throw Error('Quota storage is not configured.');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.QUOTA_HASH_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${new Date(now).toISOString().slice(0,10)}:${ip}`));
  const client = [...new Uint8Array(signature)].map(b => b.toString(16).padStart(2,'0')).join('');
  const day = Math.floor(now / 86400000) * 86400000;
  const globalLimit = service === 'crawl' ? 100 : service==='weather'?bounded(env.WEATHER_DAILY_LIMIT,500,100000):service==='sports'?bounded(env.SPORTS_DAILY_LIMIT,500,100000):bounded(env.SEARCH_DAILY_LIMIT,500,100000);
  const ipLimit = service === 'crawl' ? 10 : bounded(env.SEARCH_IP_DAILY_LIMIT, 50, 10000);
  const minuteLimit = service === 'crawl' ? 1 : bounded(env.SEARCH_IP_MINUTE_LIMIT, 6, 60);
  // One atomic SQLite write: concurrent edge isolates cannot all pass a separate read/check.
  const result = await env.SEARCH_DB.prepare(`INSERT INTO request_reservations(id, service, client, created_at)
    SELECT ?, ?, ?, ?
    WHERE (SELECT COUNT(*) FROM request_reservations WHERE service = ? AND created_at >= ?) < ?
      AND (SELECT COUNT(*) FROM request_reservations WHERE service = ? AND client = ? AND created_at >= ?) < ?
      AND (SELECT COUNT(*) FROM request_reservations WHERE service = ? AND client = ? AND created_at >= ?) < ?`)
    .bind(crypto.randomUUID(),service,client,now,service,day,globalLimit,service,client,day,ipLimit,service,client,now-60000,minuteLimit).run();
  // Opportunistic bounded-retention maintenance. Failure must not refund a reserved provider call.
  try { await env.SEARCH_DB.prepare('DELETE FROM request_reservations WHERE created_at < ?').bind(day-86400000).run(); } catch { /* Alert through platform metrics if persistent. */ }
  return result.meta.changes === 1;
}
