import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import type { RequestOptions } from 'node:https';
import type { TcpNetConnectOpts } from 'node:net';
import ipaddr from 'ipaddr.js';
import { load } from 'cheerio';
import robotsParser from 'robots-parser';
export function validateURL(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw Error('Only public HTTPS URLs on port 443 are supported.');
  url.hash = ''; return url;
}
export function publicAddress(ip: string) {
  try { return ipaddr.process(ip).range() === 'unicast'; } catch { return false; }
}
function resolveHost(host: string) { return lookup(host, { all: true }); }
async function read(url: URL, origin: string, redirects = 0, follow = true): Promise<{ text: string; type: string; status: number; url: URL }> {
  if (url.origin !== origin || redirects > 3) throw Error('Cross-origin or excessive redirects blocked.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = await new Promise<Awaited<ReturnType<typeof resolveHost>>>((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('DNS lookup timed out.')), 5000);
    resolveHost(host).then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
  if (!addresses.length || addresses.some(a => !publicAddress(a.address))) throw Error('Private, reserved, and local network addresses are blocked.');
  const address = addresses[0]!;
  return new Promise((resolve, reject) => {
    const options: RequestOptions & Pick<TcpNetConnectOpts,'autoSelectFamily'> = { autoSelectFamily:false, headers:{'User-Agent':'NOGroupCrawler/1.0',Accept:'text/html,text/plain'}, lookup:(_host,_options,cb)=>cb(null,address.address,address.family) };
    const req = request(url, options, res => {
      const status = res.statusCode || 500;
      if (follow && [301,302,303,307,308].includes(status) && res.headers.location) {
        res.destroy(); try { resolve(read(validateURL(new URL(res.headers.location, url).href), origin, redirects + 1)); } catch (e) { reject(e); } return;
      }
      const chunks: Buffer[] = []; let size = 0;
      res.on('data', (chunk: Buffer) => { size += chunk.length; if (size > 1024 * 1024) res.destroy(Error('Page exceeds the 1 MB download limit.')); else chunks.push(chunk); });
      res.on('error', reject); res.on('end', () => resolve({ text: Buffer.concat(chunks).toString('utf8'), type: res.headers['content-type'] || '', status, url }));
    });
    const deadline = setTimeout(() => req.destroy(Error('Download deadline exceeded.')), 10000);
    req.on('close', () => clearTimeout(deadline));
    req.setTimeout(7000, () => req.destroy(Error('Website timed out.'))); req.on('error', reject); req.end();
  });
}
export async function crawl(raw: string, count: number) {
  const start = validateURL(raw); const max = Math.min(5, Math.max(1, Math.floor(count) || 1));
  const robotURL = new URL('/robots.txt', start);
  const response = await read(robotURL, start.origin);
  if (response.status !== 404 && response.status !== 410 && response.status !== 200) throw Error('Could not verify robots.txt; crawl stopped.');
  const robots = robotsParser(robotURL.href, response.status === 200 ? response.text : '');
  if ((robots.getCrawlDelay('NOGroupCrawler') || 0) > 5) throw Error('This site requests a longer crawl delay than this bounded tool supports.');
  const queue = [start.href]; const visited = new Set<string>();
  const pages: { url: string; title: string; description: string; links: string[]; error?: string }[] = [];
  while (queue.length && pages.length < max) {
    const next = queue.shift()!; if (visited.has(next)) continue; visited.add(next);
    if (robots.isAllowed(next, 'NOGroupCrawler') === false) { pages.push({ url: next, title: '', description: '', links: [], error: 'Disallowed by robots.txt' }); continue; }
    if (pages.length) await new Promise(r => setTimeout(r, Math.max(1000, (robots.getCrawlDelay('NOGroupCrawler') || 0) * 1000)));
    try {
      // Redirects are not followed for pages: every crawled URL must pass robots checks first.
      const page = await read(new URL(next), start.origin, 0, false);
      if (robots.isAllowed(page.url.href, 'NOGroupCrawler') === false) throw Error('Redirect target blocked by robots.txt.');
      if (page.status !== 200 || !page.type.includes('text/html')) throw Error(`Not an HTML page (HTTP ${page.status}).`);
      const $ = load(page.text); const links = new Set<string>();
      $('a[href]').each((_i, el) => { if (links.size >= 100) return; try { const u = validateURL(new URL($(el).attr('href')!, page.url).href); if (u.origin === start.origin && !u.search) links.add(u.href); } catch { /* Ignore unsupported links. */ } });
      const list = [...links]; queue.push(...list.filter(link => !visited.has(link)).slice(0, 25));
      pages.push({ url: page.url.href, title: $('title').text().trim().slice(0,300), description: ($('meta[name="description"]').attr('content') || '').slice(0,1000), links: list });
    } catch (e) { pages.push({ url: next, title: '', description: '', links: [], error: e instanceof Error ? e.message : 'Could not fetch page.' }); }
  }
  return { pages, limit: max };
}
