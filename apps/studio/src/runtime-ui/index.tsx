'use client';

import { useEffect, useRef, useState } from 'react';
import { parametersForContext } from './context.js';
import { createId } from '@schema-baron/model';
import type { Job, OperationResult, Project } from '@schema-baron/model';
import type { StudioClient } from '../project-ui/api.js';
type State = OperationResult<'runtime.status'>;
type Context = OperationResult<'runtime.context'>;
export function RuntimeControls({
  project,
  pageId,
  client,
  hasDrafts,
  live,
  onStatusRecovered
}: {
  project: Project;
  pageId: string;
  client: StudioClient;
  hasDrafts: boolean;
  live: boolean;
  onStatusRecovered?: (recovered: boolean) => void;
}) {
  const [state, setState] = useState<State>(),
    [statusError, setStatusError] = useState(''),
    [job, setJob] = useState<Job>(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [port, setPort] = useState('3100'),
    [parameters, setParameters] = useState('{}'),
    [destination, setDestination] = useState('output:portable-app'),
    [includeData, setIncludeData] = useState(false),
    [url, setUrl] = useState('');
  const [context, setContext] = useState<Context>(),
    [values, setValues] = useState<Record<string, string>>({}),
    [modes, setModes] = useState<Record<string, string>>({}),
    [advanced, setAdvanced] = useState(false);
  const contextIdentity = useRef('');
  const command = <T,>(operation: string, input: unknown) => client.read<T>(`projects/${encodeURIComponent(project.id)}/commands`, {
    requestId: createId(),
    operation,
    expectedRevision: project.revision,
    input
  });
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const next = await command<State>('runtime.status', {});
        if (!active) return;
        setState(next);
        setStatusError('');
        onStatusRecovered?.(true);
        if (next.jobId) {
          const nextJob = await command<Job>('job.inspect', {
            jobId: next.jobId
          });
          if (active) setJob(nextJob);
        }
      } catch (e) {
        if (active) {
          setState(undefined);
          onStatusRecovered?.(false);
          setStatusError(e instanceof Error ? e.message : 'Generate output before starting it.');
        }
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [project.id, project.revision, client]);
  useEffect(() => {
    let active = true;
    if (!state) return;
    const identity = `${project.id}:${pageId}:${state.generatedRevision}`;
    void command<Context>('runtime.context', {
      generatedRevision: state.generatedRevision,
      pageId
    }).then(next => {
      if (!active) return;
      setContext(next);
      if (contextIdentity.current !== identity) {
        contextIdentity.current = identity;
        setValues({});
        setModes({});
        setParameters('{}');
        setUrl('');
      }
    }).catch(e => {
      if (active) {
        setContext(undefined);
        setError(e instanceof Error ? e.message : 'Generated page context is unavailable.');
      }
    });
    return () => {
      active = false;
    };
  }, [project.id, project.revision, pageId, state?.generatedRevision, client]);
  useEffect(() => {
    setUrl('');
  }, [state?.generatedRevision, state?.port]);
  async function action(operation: string, input: unknown) {
    setBusy(true);
    setError('');
    try {
      setState(await command<State>(operation, input));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Runtime action failed.');
    } finally {
      setBusy(false);
    }
  }
  async function open(launch: boolean) {
    if (!state || !context) return;
    const visitor = launch ? window.open('about:blank', '_blank') : null;
    if (visitor) visitor.opener = null;
    setBusy(true);
    setError('');
    try {
      const input: unknown = advanced ? JSON.parse(parameters) : parametersForContext(context, values, modes);
      const result = await command<OperationResult<'runtime.route'>>('runtime.route', {
        generatedRevision: state.generatedRevision,
        pageId,
        parameters: input
      });
      setUrl(result.url);
      if (visitor) visitor.location.replace(result.url);
    } catch (e) {
      visitor?.close();
      setError(e instanceof Error ? e.message : 'Use the declared typed key/filter parameters.');
    } finally {
      setBusy(false);
    }
  }
  const active = state && ['building', 'starting', 'running'].includes(state.status);
  const outcome = job?.outcome?.ok ? job.outcome.result as {
    logs?: string;
    exitCode?: number | null;
    signal?: string | null;
  } : undefined;
  const fieldControl = (field: Context['fields'][number]) => {
    const disabled = !!field.recordId && field.kind !== 'record-mode' && values[field.recordId + ':mode'] === 'new' || !!field.modeParameter && (modes[field.parameter] ?? (field.defaultAvailable ? 'default' : 'value')) !== 'value';
    const update = (value: string) => {
      setValues(current => ({
        ...current,
        [field.parameter]: value
      }));
      setUrl('');
    };
    const label = field.label;
    const choices = field.choices ?? (field.type?.kind === 'boolean' ? [{
      value: field.kind === 'query' ? 'false' : '0',
      label: 'No'
    }, {
      value: field.kind === 'query' ? 'true' : '1',
      label: 'Yes'
    }] : undefined);
    return <label key={field.parameter} style={{
      display: 'grid',
      gap: 3
    }}>{label}{field.required ? ' (required)' : ''}{field.modeParameter && <select aria-label={label + ' input mode'} value={modes[field.parameter] ?? (field.defaultAvailable ? 'default' : 'value')} onChange={e => {
        setModes(current => ({
          ...current,
          [field.parameter]: e.target.value
        }));
        setUrl('');
      }}>{field.defaultAvailable && <option value="default">Use declared default</option>}<option value="value">Enter value</option>{field.nullable && <option value="null">Null</option>}</select>}{choices ? <select aria-label={label} disabled={disabled} value={values[field.parameter] ?? (field.kind === 'record-mode' ? 'existing' : '')} onChange={e => update(e.target.value)}>{field.kind !== 'record-mode' && <option value="">{field.required ? 'Choose a value' : 'Use application default'}</option>}{choices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select> : <input aria-label={label} disabled={disabled} value={values[field.parameter] ?? ''} type={field.type?.kind === 'date' ? 'date' : 'text'} inputMode={field.type?.kind === 'integer' || field.kind === 'page' ? 'numeric' : field.type?.kind === 'decimal' || field.type?.kind === 'real' ? 'decimal' : undefined} placeholder={field.type?.kind ?? field.kind} onChange={e => update(e.target.value)} />}</label>;
  };
  return <section aria-label="Managed generated runtime" style={{
    padding: 10,
    borderTop: '1px solid #cbd5e1',
    background: '#f5f7fa',
    fontSize: 12,
    ...(live ? {
      flex: 1,
      minHeight: 0,
      overflow: 'auto' as const
    } : {
      maxHeight: '40%',
      minHeight: 0,
      overflow: 'auto' as const
    })
  }}>
  <strong>Generated runtime · {state?.status ?? 'Generate output first'}</strong><p>Saved model {project.revision}{hasDrafts ? ' · unsaved draft retained' : ''} · generated tree {state?.generatedRevision ?? 'none'} (model {state?.modelRevision ?? 'none'}) · running tree {state?.runningRevision ?? 'none'}</p>
  {live && <div aria-label="Selected generated page"><h3 style={{
        margin: '8px 0'
      }}>Live Page · {context?.title ?? 'selected page'}</h3><p>Generated snapshot {context?.modelRevision ?? 'unavailable'} · {context?.route ?? 'Generate this page first'}. Opens a separate visitor session.</p><button disabled={busy || state?.status !== 'running' || !context} onClick={() => void open(true)}>Open selected generated page</button>{url && state?.status === 'running' && <a style={{
        marginLeft: 8
      }} href={url} target="_blank" rel="noreferrer">Open selected generated page</a>}<div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
        gap: 10,
        margin: '12px 0'
      }}>{context?.fields.map(fieldControl)}</div><details><summary>Advanced parameter JSON / agent context</summary><label><input type="checkbox" checked={advanced} onChange={e => {
            setAdvanced(e.target.checked);
            setUrl('');
          }} />Use advanced JSON instead of labeled inputs</label><label>Declared key/filter context (JSON)<textarea aria-label="Live Page parameters" value={parameters} onChange={e => {
            setParameters(e.target.value);
            setUrl('');
          }} /></label><button disabled={busy || state?.status !== 'running' || !context} onClick={() => void open(false)}>Resolve selected Live Page</button></details></div>}
  {state && <><div style={{
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        flexWrap: 'wrap',
        marginTop: 10
      }}><label>Runtime port <input aria-label="Runtime port" value={port} onChange={e => setPort(e.target.value)} size={6} /></label><button disabled={busy || !!active} onClick={() => void action('runtime.start', {
          generatedRevision: state.generatedRevision,
          intent: 'build'
        })}>Build generated output</button><button disabled={busy || !!active || !/^\d+$/.test(port)} onClick={() => void action('runtime.start', {
          generatedRevision: state.generatedRevision,
          intent: 'run',
          port: Number(port)
        })}>Start / retry</button><button disabled={busy || !active} onClick={() => void action('runtime.stop', {
          generatedRevision: state.generatedRevision
        })}>Stop runtime</button>{job && ['running', 'pending'].includes(job.status) && <button disabled={busy} onClick={async () => {
          setBusy(true);
          try {
            setJob(await command<Job>('job.cancel', {
              jobId: job.id
            }));
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Cancel failed.');
          } finally {
            setBusy(false);
          }
        }}>Cancel job</button>}</div><details style={{
        marginTop: 8
      }}><summary>Command and approved working directory · review build/run intent</summary><p>Requested intent: {state.intent ?? 'none'} · actual port: {state.port ?? 'none'}</p><p>Approved working directory: <code>{state.cwd}</code></p><p>Executable: <code>{state.executable}</code></p><p>Build arguments: <code>./node_modules/next/dist/bin/next build --webpack</code></p><p>Run arguments: <code>./node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port {port}</code></p><p>Actual entry arguments: <code>{state.arguments.join(' ')}</code></p><p>Install dependencies explicitly with npm ci --ignore-scripts before building. Project open never runs commands.</p></details></>}
  {(state?.message || error || statusError) && <p role="alert">{state?.message} {error} {statusError}</p>}
  {job && <details><summary>Job {job.id}: {job.status} · exit {String(outcome?.exitCode ?? 'pending')}{outcome?.signal ? ' · ' + outcome.signal : ''}</summary><pre style={{
        maxHeight: 180,
        overflow: 'auto',
        whiteSpace: 'pre-wrap'
      }}>{outcome?.logs ?? 'No output.'}</pre></details>}
  <details><summary>Portable definition and output export</summary><label>Approved unused destination <input aria-label="Export destination" value={destination} onChange={e => setDestination(e.target.value)} /></label><label><input type="checkbox" checked={includeData} onChange={e => setIncludeData(e.target.checked)} />I reviewed including a private snapshot of business data. Identity stores and credentials are excluded; mapped identity snapshots are refused.</label><button disabled={busy || !state} onClick={async () => {
        setBusy(true);
        setError('');
        try {
          await command('project.export', {
            destination,
            includeData
          });
          setError('Portable export created. Read PORTABLE.md for independent install/build/test/run and private deployment configuration.');
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Export failed.');
        } finally {
          setBusy(false);
        }
      }}>Export portable application</button></details>
 </section>;
}
