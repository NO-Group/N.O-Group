import { company } from './lib/company';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { searchWeb, SearchError, getSearchUsage, setSearchLimit, clearSearchCache } from './lib/search';
import type { SearchResponse } from './lib/search';
import LiveInsights from './components/LiveInsights';
import CreativeTools from './components/CreativeTools';
import QuickTools from './components/QuickTools';
import SearchResults from './components/SearchResults';
import { defaultSearchOptions, optionsFromURL, writeSearchURL } from './lib/search-options';
import type { SearchOptions } from './lib/search-options';
const services = [
  { id: 'vortex', icon: '◇', title: 'Vortex BaaS', text: 'Your next big idea. Our backend.', detail: 'A unified backend foundation for modern applications, with object storage, media workflows, and access controls.', tag: 'BUILD WITHOUT LIMITS' },
  { id: 'multi-cloud', icon: '⌘', title: 'Multi-Cloud Engine', text: 'Every cloud. One powerful engine.', detail: 'A consistent storage interface across Cloudflare R2, AWS S3, Google Cloud, Azure, DigitalOcean, and local development.', tag: 'ONE CONNECTED PLATFORM' },
  { id: 'real-time', icon: 'ϟ', title: 'Real-time Sync', text: 'Stay connected. In every moment.', detail: 'Explore event-driven workflows and signed webhooks that keep your applications connected to changes in your infrastructure.', tag: 'ALWAYS IN THE LOOP' },
];
const updates = [
  { category: 'ENGINEERING', title: 'One engine. A world of possibilities.', text: 'An introduction to our multi-cloud approach.', body: 'Vortex brings multiple storage providers behind a shared interface. Build your application around a consistent contract, then choose the provider that fits your workload. Cloud flexibility starts with a deliberate foundation.' },
  { category: 'DEVELOPER NOTES', title: 'Less infrastructure. More imagination.', text: 'Meet the foundation for your next build.', body: 'Infrastructure should support your ideas, not get in their way. Our backend approach brings object storage, media transformations, and event delivery into a focused developer experience.' },
];
function SearchIcon() { return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>; }
export default function App() {
  const [readingOnly,setReadingOnly]=useState(false);
  const [focusMode,setFocusMode]=useState(true);
  const navigationKey=useRef('');
  const [searchOptions,setSearchOptions]=useState<SearchOptions>({...defaultSearchOptions});
  const [budget, setBudget] = useState(getSearchUsage);
  const [autoSearch, setAutoSearch] = useState(false);
  const [rateLimit, setRateLimit] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const [query, setQuery] = useState(''); const [submitted, setSubmitted] = useState('');
  const [data, setData] = useState<SearchResponse | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const [article, setArticle] = useState<number | null>(null); const [expanded, setExpanded] = useState<string | null>(null);
  const controller = useRef<AbortController>(); const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); input.current?.focus(); input.current?.scrollIntoView({ block: 'center' });
      }
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);
  useEffect(() => {
    if (!rateLimit) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [rateLimit]);
  async function runSearch(value: string, navigation: 'push' | 'replace' | 'none' = 'push', options:SearchOptions=searchOptions) {
    value = value.trim(); if (!value) return;
    controller.current?.abort(); const request = new AbortController(); controller.current = request;
    navigationKey.current=JSON.stringify([value.trim(),options]);
    setSearchOptions(options);
    setReadingOnly(false); setSubmitted(value); setQuery(value); setLoading(true); setError(''); setData(null); setRateLimit(0);
    if (navigation !== 'none') {
      const url = new URL(window.location.href); writeSearchURL(url,value,options);
      if (url.href !== window.location.href) window.history[navigation === 'push' ? 'pushState' : 'replaceState'](null, '', url);
    }
    try { const result = await searchWeb(value, request.signal, options); if (!request.signal.aborted) setData(result); }
    catch (cause) {
      if (!request.signal.aborted) {
        if (cause instanceof SearchError && cause.status === 429) { setRateLimit(cause.retryAt); setClock(Date.now()); }
        else setError(cause instanceof SearchError ? cause.message : 'We couldn’t reach search. Check your connection and try again.');
      }
    }
    finally { setBudget(getSearchUsage()); if (!request.signal.aborted) setLoading(false); }
  }
  function submit(event: FormEvent) { event.preventDefault(); if (!query.trim()) input.current?.focus(); else void runSearch(query,'push',{...searchOptions,page:0}); }
  function home(updateHistory = true) {
    navigationKey.current='';
    setReadingOnly(false);
    setSearchOptions({...defaultSearchOptions});
    controller.current?.abort(); setSubmitted(''); setQuery(''); setData(null); setError(''); setLoading(false); setRateLimit(0);
    if (updateHistory) { const url = new URL(window.location.href); for(const param of ['q','page','freshness','country','safeSearch'])url.searchParams.delete(param); window.history.pushState(null, '', url); }
  }
  useEffect(() => {
    function restore() { const url=new URL(window.location.href);const q=url.searchParams.get('q');if(q?.trim()){const options=optionsFromURL(url);if(navigationKey.current!==JSON.stringify([q.trim(),options]) || controller.current?.signal.aborted)void runSearch(q,'none',options);}else home(false); }
    restore(); window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  useEffect(() => {
    if (!autoSearch || query.trim().length < 2 || query.trim() === submitted) return;
    const timer = window.setTimeout(() => { void runSearch(query, submitted ? 'replace' : 'push',{...searchOptions,page:0}); }, 400);
    return () => window.clearTimeout(timer);
  }, [query, autoSearch, submitted]);
  useEffect(()=>{document.title=submitted?`${submitted} — N.O Group Search`:'N.O Group — A new perspective';},[submitted]);
  const retrySeconds = Math.max(0, Math.ceil((rateLimit - clock) / 1000));
  const searchActive=!!submitted || readingOnly;
  function navigateWorkspace(id:string){setFocusMode(false);requestAnimationFrame(()=>{document.getElementById(id)?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});}
  return <div className={searchActive?'app-shell search-active':'app-shell'}><header className="topbar"><a className="wordmark" href="#" onClick={() => home()}>N.O <span>GROUP</span><i /></a><nav aria-label="Main navigation"><a href="#ecosystem" onClick={()=>setFocusMode(false)}>Our ecosystem</a><a href="#tools" onClick={()=>setFocusMode(false)}>Quick tools</a><a href="#updates" onClick={()=>setFocusMode(false)}>The latest <span aria-hidden="true">↗</span></a><a className="contact-link" href="#contact" onClick={()=>setFocusMode(false)}>Let’s talk <span aria-hidden="true">↗</span></a></nav></header>
  <main><section className={`hero ${searchActive ? 'hero-compact' : ''}`} aria-labelledby="hero-title"><div className="identity"><img src="/nogroup-logo.png" alt="N.O Group official logo"/></div><div className="eyebrow"><span/> INDEPENDENT THINKING. INFINITE POSSIBILITIES.</div><h1 id="hero-title">A new perspective<span className="gradient-text"> starts here.</span></h1><p className="hero-description">Search the web. Explore our world. Build what’s next.</p>
  <form onSubmit={submit} role="search" className="search-form"><div className="search-shell"><span className="search-symbol"><SearchIcon/></span><label className="sr-only" htmlFor="search">Search the web</label><input type="search" id="search" ref={input} value={query} onChange={e => { controller.current?.abort(); setLoading(false); setQuery(e.target.value); }} placeholder="What are you curious about?" autoComplete="off" maxLength={500}/>{query && <button className="clear" type="button" aria-label="Clear search" onClick={() => { setQuery(''); input.current?.focus(); }}>×</button>}{searchActive && <button type="button" className="search-command-trigger" aria-label="Open command menu" title="Actions · Ctrl / ⌘ J" onClick={()=>window.dispatchEvent(new Event('no-group:open-commands'))}>⌘</button>}<button type="submit" className="search-button">Search <span aria-hidden="true">↗</span></button></div></form><div className="search-caption"><span className="tiny-spark">✧</span> Your curiosity. A world of answers.<span className="caption-divider">/</span> By N.O Group <kbd className="search-shortcut">Ctrl / ⌘ K</kbd></div><label className="auto-search-toggle"><input type="checkbox" checked={autoSearch} onChange={e => setAutoSearch(e.target.checked)}/> Search as you type <span>400 ms pause · 2+ characters</span></label></section>
  {!searchActive && <button className="reading-home-link" onClick={()=>setReadingOnly(true)}>◇ Open your reading list <span>Saved on this device ↗</span></button>}
  {searchActive && <SearchResults initialView={readingOnly?'saved':'web'} query={submitted} data={data} loading={loading} error={error} options={searchOptions} rateLimit={rateLimit} retrySeconds={retrySeconds} onSearch={(value,options)=>void runSearch(value,'push',options)} onHome={()=>home()} onFocus={()=>input.current?.focus()} focusMode={focusMode} onFocusMode={setFocusMode} onNavigate={navigateWorkspace}/>}
  <div className="workspace-extras" hidden={searchActive && focusMode}>
  <aside className="api-budget" aria-label="API cost controls"><div><span className="budget-icon" aria-hidden="true">◇</span><span><strong>Search API saver</strong><small>{budget.calls} search requests today · {budget.saved} calls avoided by cache or deduplication</small></span></div><label>Daily browser cap<select value={budget.limit} onChange={e => { setSearchLimit(Number(e.target.value)); setBudget(getSearchUsage()); }}>{Array.from(new Set([10, 25, 50, 100, 250, budget.limit])).sort((a,b) => a-b).map(limit => <option key={limit} value={limit}>{limit} requests</option>)}</select></label><p>Resets at midnight UTC. Local guardrail in addition to server quotas. Cache works when permitted by the search plan. <button className="text-button" onClick={() => { clearSearchCache(); navigationKey.current=''; setData(null); setSubmitted(''); setQuery(''); setError(''); setRateLimit(0); controller.current?.abort(); setLoading(false); const url = new URL(window.location.href); for(const param of ['q','page','freshness','country','safeSearch'])url.searchParams.delete(param); window.history.replaceState(null,'',url); }}>Clear cached searches</button></p></aside>
  <LiveInsights />
  <QuickTools />
  <CreativeTools />
  <section className="ecosystem" id="ecosystem"><div className="section-heading"><div><p className="section-kicker">THE N.O GROUP ECOSYSTEM</p><h2>Built for what’s next<span className="cyan">.</span></h2></div><span className="section-aside">Ideas into infrastructure.</span></div><div className="services">{services.map((s, i) => <article className={`service-card service-${i}`} id={s.id} key={s.id}><div className="card-top"><span className="service-icon">{s.icon}</span><span className="card-number">0{i + 1} /</span></div><span className="card-tag">{s.tag}</span><h3>{s.title}</h3><p>{s.text}</p><button className="service-action" aria-expanded={expanded === s.id} onClick={() => setExpanded(expanded === s.id ? null : s.id)}>Explore {s.title === 'Vortex BaaS' ? 'Vortex' : s.title === 'Multi-Cloud Engine' ? 'the engine' : 'real-time'}<span>{expanded === s.id ? '−' : '↗'}</span></button>{expanded === s.id && <p className="service-detail">{s.detail}</p>}</article>)}</div></section>
  <section className="updates" id="updates"><div className="section-heading"><div><p className="section-kicker">FROM INSIDE N.O GROUP</p><h2>Notes from the frontier<span className="cyan">.</span></h2></div><span className="section-aside">Company & engineering updates</span></div><div className="update-list">{updates.map((item, i) => <button className="update-row" key={item.title} onClick={() => setArticle(article === i ? null : i)} aria-expanded={article === i}><span className={`article-art art-${i}`} aria-hidden="true"><i/><i/><i/></span><span className="update-copy"><span className="update-category">{item.category}<span> / N.O JOURNAL</span></span><strong>{item.title}</strong><span className="update-description">{item.text}</span>{article === i && <span className="article-body">{item.body}</span>}</span><span className="update-arrow">{article === i ? '−' : '↗'}</span></button>)}</div></section>
  <section className="contact-section" id="contact" aria-labelledby="contact-title"><div className="section-heading"><div><p className="section-kicker">LET’S BUILD SOMETHING THAT MATTERS</p><h2 id="contact-title">Start a conversation<span className="cyan">.</span></h2></div><span className="section-aside">A question. An idea. A new possibility.</span></div><div className="contact-grid"><article className="contact-card"><span className="contact-icon" aria-hidden="true">↗</span><h3>A direct connection.</h3><p>Talk to N.O Group about your next project, our services, or a potential collaboration.</p><a className="whatsapp-link" href={company.whatsapp} target="_blank" rel="noopener noreferrer">Chat on WhatsApp <span aria-hidden="true">↗</span></a></article><div className="contact-methods"><a href={company.telephone}><span className="contact-method-icon" aria-hidden="true">⌁</span><span><small>CALL US</small><strong>{company.phone}</strong></span><span className="contact-arrow" aria-hidden="true">↗</span></a>{company.emails.map((email,i)=><a href={`mailto:${email}`} key={email}><span className="contact-method-icon" aria-hidden="true">@</span><span><small>{i===0 ? 'EMAIL US' : 'ALTERNATIVE EMAIL'}</small><strong>{email}</strong></span><span className="contact-arrow" aria-hidden="true">↗</span></a>)}</div></div></section>
  <details className="privacy-details"><summary>Privacy, storage & tool limits</summary><p>Search terms appear in your address bar and browser history and are sent to our server, then Brave, to retrieve results. Server quota records contain daily hashed IP identifiers, not query text. Cloudflare and hosting providers may maintain their own operational logs. When our search plan permits it, results stay in this tab’s session cache for up to 15 minutes; use “Clear cached searches” above to remove them.</p><p>Notes, reading-list URLs and personal labels/notes, and browser request counters are saved unencrypted on this device. Reading-list entries contain only links you choose and your own text, not provider snippets or page content. Remove saved links individually or clear browser site data to delete the reading list; export it before clearing site data if you want to keep a copy. Clear your notes or browser site data to remove them. Weather city names are sent to our server and OpenWeather; sports requests are sent to AllSportsAPI. These widgets load only when requested and use short-lived shared server caches. Images, barcodes, and text conversions run locally without uploads; crawl targets are sent to our crawler service and the selected website. Only inspect sites you are authorized to crawl. QR scanning and original-image color-profile fidelity cannot be guaranteed for every device or file.</p></details>
  </div>
  <div className="bottom-note"><span className="tiny-spark">✧</span><p>Not just searching for the future. <strong>Building it.</strong></p></div></main>
  <footer><a className="footer-brand" href="#" onClick={() => home()}>N.O GROUP<span>Independent by design.</span></a><span>© {new Date().getFullYear()} N.O Group</span><a href="#contact" onClick={()=>setFocusMode(false)}>Get in touch ↗</a><span className="footer-location"><i/> From Nigeria. For the world.</span></footer></div>;
}
