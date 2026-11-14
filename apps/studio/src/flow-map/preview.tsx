'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Project } from '@schema-baron/model';
import { FlowMap } from './index.js';
import { applicationMermaid } from './mermaid.js';
import './preview.css';
let sequence = 0;
export function ApplicationFlow({ project, onSelect, initialView = 'interactive' }: { project: Project; onSelect: (id: string) => void; initialView?: 'mermaid' | 'interactive' }) {
 const [view, setView] = useState<'mermaid' | 'interactive' | 'source'>(initialView);
 const [error, setError] = useState(''), [rendering, setRendering] = useState(false);
 const container = useRef<HTMLDivElement>(null);
 const source = useMemo(() => applicationMermaid(project), [project]);
 useEffect(() => {
  if (view !== 'mermaid') return;
  let canceled = false; setRendering(true); setError('');
  void import('mermaid').then(async ({ default: mermaid }) => {
   mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral', flowchart: { htmlLabels: false }, fontFamily: 'system-ui, sans-serif' });
   const { svg } = await mermaid.render(`application-flow-${++sequence}`, source);
   if (!canceled && container.current) container.current.innerHTML = svg;
  }).catch(() => { if (!canceled) setError('The Mermaid diagram could not be rendered. Use the interactive map or Mermaid source.'); }).finally(() => { if (!canceled) setRendering(false); });
  return () => { canceled = true; };
 }, [view, source]);
 return <section className="application-flow" aria-label="Application flow preview">
  <div className="application-flow-switch" role="group" aria-label="Flow preview view">
   <button aria-pressed={view === 'mermaid'} onClick={() => setView('mermaid')}>Mermaid diagram</button>
   <button aria-pressed={view === 'interactive'} onClick={() => setView('interactive')}>Interactive map</button>
   <button aria-pressed={view === 'source'} onClick={() => setView('source')}>Mermaid source</button>
  </div>
  {view === 'interactive' ? <FlowMap project={project} onSelect={onSelect} /> : view === 'source' ? <pre className="mermaid-source" aria-label="Mermaid source">{source}</pre> : <>
   <p className="flow-overview-note">Pages and data overview. Choose Interactive map to inspect individual forms and actions.</p>
   {rendering && <p role="status">Drawing application flow…</p>}
   {error && <p role="alert">{error}</p>}
   <div ref={container} className="application-mermaid" role="img" aria-label={`Application flow for ${project.name}`} />
  </>}
 </section>;
}
