import { useEffect, useRef, useState } from 'react';
import { decodeBase64, encodeBase64, formatJSON } from '../lib/tools';
const tools = [
  { id: 'json', icon: '{ }', name: 'JSON studio', description: 'Format. Validate. Untangle.', label: 'JSON input' },
  { id: 'uuid', icon: '⌗', name: 'UUID generator', description: 'Unique by design.', label: 'Generated UUIDs' },
  { id: 'base64', icon: '⇄', name: 'Base64 codec', description: 'Encode or decode any text.', label: 'Text to convert' },
  { id: 'notes', icon: '▤', name: 'Scratchpad', description: 'A little space for big ideas.', label: 'Your private scratchpad' },
] as const;
type Tool = typeof tools[number]['id'];
export default function QuickTools() {
  const [active, setActive] = useState<Tool>('json');
  const [values, setValues] = useState<Record<Tool, string>>({ json: '{"idea":"Build something extraordinary","ready":true}', uuid: '', base64: '', notes: '' });
  const [message, setMessage] = useState(''); const [saved, setSaved] = useState(false);
  const copyVersion = useRef(0);
  useEffect(() => { try { const note = localStorage.getItem('no-group:scratchpad'); if (note) setValues(v => ({ ...v, notes: note })); } catch { /* Storage is optional. */ } }, []);
  function update(value: string) {
    setValues(v => ({ ...v, [active]: value })); setMessage(''); setSaved(false);
    if (active === 'notes') { try { localStorage.setItem('no-group:scratchpad', value); setSaved(true); } catch { setMessage('Storage is unavailable. Copy your notes before leaving.'); } }
  }
  function transform(action: 'format' | 'compact' | 'encode' | 'decode' | 'generate') {
    try {
      let output = values[active];
      if (action === 'format') output = formatJSON(output);
      if (action === 'compact') output = JSON.stringify(JSON.parse(output));
      if (action === 'encode') output = encodeBase64(output);
      if (action === 'decode') output = decodeBase64(output);
      if (action === 'generate') output = Array.from({ length: 5 }, () => crypto.randomUUID()).join('\n');
      update(output); setMessage(action === 'generate' ? 'Five fresh UUIDs, generated on your device.' : 'Done. Your output is ready.');
    } catch { setMessage(active === 'json' ? 'Invalid JSON. Check quotation marks, commas, and brackets.' : 'Could not convert. Use valid Base64 containing UTF-8 text.'); }
  }
  async function copy() {
    const version = ++copyVersion.current;
    try { await navigator.clipboard.writeText(values[active]); if (version === copyVersion.current) setMessage('Copied to clipboard.'); }
    catch { if (version === copyVersion.current) setMessage('Clipboard unavailable. Select the text and copy manually.'); }
  }
  const selected = tools.find(t => t.id === active)!;
  return <section className="quick-tools" id="tools" aria-labelledby="tools-title"><div className="section-heading"><div><p className="section-kicker">LESS FRICTION. MORE FLOW.</p><h2 id="tools-title">Your everyday toolkit<span className="cyan">.</span></h2></div><span className="local-badge"><i/> Runs on your device</span></div>
    <div className="tool-workbench"><div className="tool-navigation" role="group" aria-label="Choose a quick tool">{tools.map(tool => <button key={tool.id} className={`tool-choice ${active === tool.id ? 'selected' : ''}`} aria-pressed={active === tool.id} onClick={() => { copyVersion.current++; setActive(tool.id); setMessage(''); setSaved(false); }}><span className="tool-glyph">{tool.icon}</span><span><strong>{tool.name}</strong><small>{tool.description}</small></span><span className="tool-choice-arrow">↗</span></button>)}</div>
    <div className="tool-editor"><div className="editor-heading"><label htmlFor="tool-input">{selected.label}</label><span>{active === 'notes' ? saved ? 'Saved on this device' : 'Local autosave' : 'NO UPLOADS · NO API CALLS'}</span></div><textarea id="tool-input" value={values[active]} onChange={event => update(event.target.value)} spellCheck={false} readOnly={active === 'uuid'} placeholder={active === 'uuid' ? 'Generate five cryptographically random UUIDs…' : active === 'notes' ? 'Capture an idea, sketch a plan, or keep something handy…' : 'Paste your text here…'}/><div className="tool-actions"><div>{active === 'json' && <><button className="primary-tool" onClick={() => transform('format')}>Format JSON</button><button onClick={() => transform('compact')}>Minify</button></>}{active === 'uuid' && <button className="primary-tool" onClick={() => transform('generate')}>Generate 5 UUIDs ↻</button>}{active === 'base64' && <><button className="primary-tool" onClick={() => transform('encode')}>Encode</button><button onClick={() => transform('decode')}>Decode</button></>}{active === 'notes' && <span className="notes-hint">Stored in this browser. Avoid sensitive information.</span>}</div><div><button onClick={() => update('')}>Clear</button><button disabled={!values[active]} onClick={copy}>Copy ↗</button></div></div><p className="tool-status" role="status" aria-live="polite">{message || 'A focused workspace. Everything stays in your browser.'}</p></div></div>
  </section>;
}
