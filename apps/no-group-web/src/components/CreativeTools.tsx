import { barcodeDimensions } from '../lib/barcode-svg';
import { useEffect, useRef, useState } from 'react';
type Page = { url: string; title: string; description: string; links: string[]; error?: string };
function download(content: string, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function SVGPreview({ svg }: { svg: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => { if (!svg) { setUrl(''); return; } const next = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })); setUrl(next); return () => URL.revokeObjectURL(next); }, [svg]);
  return new Blob([svg]).size > 8*1024*1024 ? <p className="tool-intro">Preview omitted for large files. Your SVG is still available to download.</p> : url ? <img className="generated-preview" src={url} alt="Generated SVG preview"/> : null;
}
export default function CreativeTools() {
  const [tab, setTab] = useState('barcode'); const [text, setText] = useState('https://no-group.org'); const [format, setFormat] = useState('qrcode');
  const [barcode, setBarcode] = useState(''); const [imageSVG, setImageSVG] = useState(''); const [imageInfo, setImageInfo] = useState('');
  const [target, setTarget] = useState(''); const [limit, setLimit] = useState(3); const [pages, setPages] = useState<Page[]>([]);
  const [busy, setBusy] = useState(false); const [status, setStatus] = useState('');
  const worker = useRef<Worker>(); const request = useRef<AbortController>(); const version = useRef(0);
  useEffect(() => () => { version.current++; worker.current?.terminate(); request.current?.abort(); }, []);
  function select(next: string) { version.current++; worker.current?.terminate(); request.current?.abort(); setBusy(false); setStatus(''); setTab(next); }
  async function generate() {
    const id = ++version.current; setBusy(true); setStatus(''); setBarcode('');
    try {
      if (!text.trim()) throw Error('Enter a link or text first.');
      if (text.length > (format === 'code128' ? 120 : 1500)) throw Error('Text is too long for this format. Use up to 120 characters for Code 128 or 1500 for QR.');
      if (format === 'code128' && /[^\x20-\x7e]/.test(text)) throw Error('Code 128 supports printable ASCII here. Use QR for Unicode text.');
      const bwip = await import('bwip-js/browser');
      const svg = bwip.toSVG({ bcid: format, text, scale: 3, height: 15, includetext: format === 'code128', padding: 12, backgroundcolor: 'FFFFFF', barcolor: '000000' });
      if (id === version.current) { setBarcode(barcodeDimensions(svg)); setStatus('Ready. Black-on-white output includes a scanning quiet zone.'); }
    } catch (e) { if (id === version.current) setStatus(e instanceof Error ? e.message : 'Could not generate barcode.'); }
    finally { if (id === version.current) setBusy(false); }
  }
  async function convert(file?: File) {
    if (!file) return; const id = ++version.current; worker.current?.terminate(); setBusy(true); setStatus(''); setImageSVG(''); setImageInfo('');
    try {
      if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024) throw Error('Use PNG, JPEG, or WebP up to 15 MB.');
      const bitmap = await createImageBitmap(file);
      if (id !== version.current) { bitmap.close(); return; }
      const { width, height } = bitmap;
      if (width * height > 2_000_000) { bitmap.close(); throw Error('Maximum 2 million pixels. Resize your image first; this mode never silently downscales.'); }
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true }); if (!ctx) { bitmap.close(); throw Error('Canvas is unavailable.'); }
      ctx.drawImage(bitmap, 0, 0); bitmap.close();
      const pixels = ctx.getImageData(0,0,width,height);
      const task = new Worker(new URL('../lib/svg.worker.ts', import.meta.url), { type: 'module' }); worker.current = task;
      const deadline = window.setTimeout(() => { task.terminate(); if (id === version.current) { setBusy(false); setStatus('Conversion exceeded 30 seconds. Try a smaller image.'); } },30000);
      task.onmessage = event => { window.clearTimeout(deadline); if (id !== version.current) return; setBusy(false); task.terminate(); if (event.data.error) setStatus(event.data.error); else { setImageSVG(event.data.svg); setImageInfo(`${width} × ${height} · ${(new Blob([event.data.svg]).size / 1024 / 1024).toFixed(2)} MB SVG`); setStatus('Converted locally. No palette reduction or embedded raster.'); } };
      task.onerror = () => { window.clearTimeout(deadline); if (id === version.current) { setBusy(false); setStatus('Conversion failed. Try a smaller image.'); } task.terminate(); };
      task.postMessage({ data: pixels.data, width, height }, [pixels.data.buffer]);
    } catch (e) { if (id === version.current) { setBusy(false); setStatus(e instanceof Error ? e.message : 'Image could not be decoded.'); } }
  }
  async function crawl() {
    const id = ++version.current; setBusy(true); setStatus(''); setPages([]); const controller = new AbortController(); request.current = controller;
    try { const response = await fetch('/api/crawl', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: target, limit }) }); const data = await response.json() as {error?: string; pages: Page[]}; if (!response.ok) throw Error(data.error || 'Crawler unavailable.'); if (id === version.current) { setPages(data.pages); setStatus(`Finished: ${data.pages.length} pages inspected.`); } }
    catch (e) { if (id === version.current) setStatus(e instanceof Error ? e.message : 'Crawler unavailable.'); }
    finally { if (id === version.current) setBusy(false); }
  }
  return <section className="creative-tools" aria-labelledby="creative-title"><div className="section-heading"><div><p className="section-kicker">CREATE. CONVERT. DISCOVER.</p><h2 id="creative-title">Go beyond the everyday<span className="cyan">.</span></h2></div><span className="section-aside">Three more ways to build.</span></div><div className="creative-panel"><div className="creative-tabs" role="group" aria-label="Creative tool selection">{[['barcode','▥','Link / text → barcode'],['crawler','⌁','Web crawler'],['svg','◈','Image → SVG']].map(([id, icon, label]) => <button key={id} aria-pressed={tab === id} onClick={() => select(id!)}><span>{icon}</span>{label}</button>)}</div><div className="creative-body" aria-busy={busy}>
    {tab === 'barcode' && <><p className="tool-intro">A link, a message, a scannable moment. Generate QR codes for Unicode text or Code 128 for printable ASCII—all on your device.</p><label htmlFor="barcode-text">Link or text</label><textarea id="barcode-text" value={text} maxLength={1500} onChange={e => { setText(e.target.value); setBarcode(''); }}/><div className="creative-actions"><label>Format<select aria-label="Barcode format" value={format} onChange={e => { setFormat(e.target.value); setBarcode(''); }}><option value="qrcode">QR code · links & text</option><option value="code128">Code 128 · linear barcode</option></select></label><button disabled={busy} onClick={generate}>Generate ↗</button>{barcode && <button onClick={() => download(barcode,'image/svg+xml','no-group-barcode.svg')}>Download SVG ↓</button>}</div><SVGPreview svg={barcode}/></>}
    {tab === 'svg' && <><p className="tool-intro">Exact-pixel vector mode. Preserves decoded sRGB pixel colors and alpha without palette reduction. Not smooth contour tracing: photos can create very large files. Color profiles and browser decoding can affect source fidelity.</p><label className="image-drop">Choose a PNG, JPEG, or WebP<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { void convert(e.target.files?.[0]); e.target.value = ''; }}/><small>15 MB input · 2 million pixels · stays on your device</small></label>{imageSVG && <><div className="creative-actions"><span>{imageInfo}</span><button onClick={() => download(imageSVG,'image/svg+xml','no-group-pixel-vector.svg')}>Download vector SVG ↓</button></div><SVGPreview svg={imageSVG}/></>}</>}
    {tab === 'crawler' && <><p className="tool-intro">Inspect up to five public HTTPS pages on one website. Extract titles, descriptions, and internal links. Respects robots.txt; no JavaScript execution, logins, or crawling private networks. Only crawl sites you’re authorized to inspect.</p><label htmlFor="crawl-target">Starting URL</label><input id="crawl-target" type="url" placeholder="https://example.com" value={target} onChange={e => setTarget(e.target.value)}/><div className="creative-actions"><label>Page limit<select value={limit} onChange={e => setLimit(Number(e.target.value))}>{[1,2,3,4,5].map(n => <option key={n}>{n}</option>)}</select></label><button disabled={busy || !target.trim()} onClick={crawl}>Start crawl ↗</button>{busy && <button onClick={() => { version.current++; request.current?.abort(); setBusy(false); setStatus('Stopped viewing this crawl. Dispatched server work remains bounded.'); }}>Stop</button>}{pages.length > 0 && <button onClick={() => download(JSON.stringify(pages,null,2),'application/json','crawl-results.json')}>Export JSON ↓</button>}</div><div className="crawl-pages">{pages.map((page, i) => <article key={i}><a href={page.url} target="_blank" rel="noopener noreferrer">{page.title || page.url} ↗</a><p>{page.error || page.description || 'No meta description.'}</p><details><summary>{page.links.length} internal links</summary>{page.links.map(link => <a key={link} href={link} target="_blank" rel="noopener noreferrer">{link}</a>)}</details></article>)}</div></>}
    <p className="tool-status" role="status" aria-live="polite">{busy ? 'Working…' : status || (tab === 'crawler' ? 'Uses the N.O Group crawler backend, not the Brave API.' : 'No uploads. No paid API calls.')}</p></div></div></section>;
}
