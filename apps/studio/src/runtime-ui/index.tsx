'use client';

import { useEffect, useState } from 'react';
import { createId } from '@schema-baron/model';
import type { Job, OperationResult, Project } from '@schema-baron/model';
import type { StudioClient } from '../project-ui/api.js';
type State = OperationResult<'runtime.status'>;
export function RuntimeControls({
  project,
  pageId,
  client,
  hasDrafts,
  live
}: {
  project: Project;
  pageId: string;
  client: StudioClient;
  hasDrafts: boolean;
  live: boolean;
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
        if (next.jobId) {
          const job = await command<Job>('job.inspect', {
            jobId: next.jobId
          });
          if (active) setJob(job);
        }
      } catch (e) {
        if (active) {
          setState(undefined);
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
    setUrl('');
  }, [state?.generatedRevision, state?.port]);
  async function action(operation: string, input: unknown) {
    setBusy(true);
    setError('');
    try {
      const result = await command<State>(operation, input);
      setState(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Runtime action failed.');
    } finally {
      setBusy(false);
    }
  }
  async function open() {
    if (!state) return;
    setBusy(true);
    setError('');
    try {
      const input: unknown = JSON.parse(parameters);
      const result = await command<OperationResult<'runtime.route'>>('runtime.route', {
        generatedRevision: state.generatedRevision,
        pageId,
        parameters: input
      });
      setUrl(result.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Use declared typed key/filter parameters.');
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
  return <section aria-label="Managed generated runtime" style={{
    padding: 10,
    borderTop: '1px solid #cbd5e1',
    background: '#f5f7fa',
    fontSize: 12
  }}>
  <strong>Generated runtime · {state?.status ?? 'Generate output first'}</strong><p>Saved model {project.revision}{hasDrafts ? ' · unsaved draft retained' : ''} · generated tree {state?.generatedRevision ?? 'none'} (model {state?.modelRevision ?? 'none'}) · running tree {state?.runningRevision ?? 'none'}</p>
  {state && <><p>Requested intent: {state.intent??'none'} · actual port: {state.port??'none'}</p><p>Approved working directory: <code>{state.cwd}</code></p><p>Executable: <code>{state.executable}</code> · explicit build arguments: <code>./node_modules/next/dist/bin/next build --webpack</code> · run arguments: <code>./node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port {port}</code></p><p>Install dependencies explicitly with npm ci --ignore-scripts before building. Project open never runs commands.</p><label>Runtime port <input aria-label="Runtime port" value={port} onChange={e => setPort(e.target.value)} size={6} /></label><button disabled={busy || !!active} onClick={() => void action('runtime.start', {
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
      }}>Cancel job</button>}</>}
  {(state?.message || error || statusError) && <p role="alert">{state?.message} {error} {statusError}</p>}
  {job && <details><summary>Job {job.id}: {job.status} · exit {String(outcome?.exitCode ?? 'pending')}{outcome?.signal ? ' · ' + outcome.signal : ''}</summary><p>Executable arguments: <code>{state?.arguments.join(' ')}</code></p><pre style={{
        maxHeight: 180,
        overflow: 'auto',
        whiteSpace: 'pre-wrap'
      }}>{outcome?.logs ?? 'No output.'}</pre></details>}
  {live && <><p>Live Page opens the selected generated route in its own visitor session. Current drafts remain isolated in Preview.</p><label>Declared typed key/filter context (JSON)<textarea aria-label="Live Page parameters" value={parameters} onChange={e => setParameters(e.target.value)} /></label><button disabled={busy || state?.status !== 'running'} onClick={() => void open()}>Resolve selected Live Page</button>{url && state?.status === 'running' && <a href={url} target="_blank" rel="noreferrer">Open selected generated page</a>}</>}
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
