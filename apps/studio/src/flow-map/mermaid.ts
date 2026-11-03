import { projectBehavior } from '@schema-baron/core/flow';
import type { Project } from '@schema-baron/model';
// User captions cannot become node IDs, directives, markup or click handlers.
const label = (value: string) => [...value.replace(/[\r\n\t]/g, ' ')].map(c => /[\p{L}\p{N} .,/:_→←·-]/u.test(c) ? c : `#${c.codePointAt(0)};`).join('');
/** A page/data overview of the same behavior used by the detailed interactive map. */
export function applicationMermaid(project: Project) {
 const graph = projectBehavior(project);
 const pages = new Map(project.pages.map((page, i) => [page.id, `page${i}`]));
 const sources = [...project.schema.tables.map(t => ({ id: t.id, name: `Table · ${t.physicalName}` })), ...project.queries.map(q => ({ id: q.id, name: `Query · ${q.name}` }))];
 const sourceIds = new Map(sources.map((source, i) => [source.id, `data${i}`]));
 const lines = ['flowchart LR'];
 if (sources.length) lines.push(`  database["${label(project.connections[0]?.name ?? 'SQLite database')}"]`);
 for (const source of sources) lines.push(`  ${sourceIds.get(source.id)}["${label(source.name)}"]`);
 for (const table of project.schema.tables) {
  lines.push(`  database --> ${sourceIds.get(table.id)}`);
  for (const fk of table.foreignKeys) if (sourceIds.has(fk.referencedTableId)) lines.push(`  ${sourceIds.get(table.id)} -->|"references"| ${sourceIds.get(fk.referencedTableId)}`);
 }
 for (const query of project.queries) for (const source of query.sources) if (sourceIds.has(source.source.id)) lines.push(`  ${sourceIds.get(source.source.id)} --> ${sourceIds.get(query.id)}`);
 for (const page of project.pages) {
  const access = graph.nodes.find(n => n.id === page.id)?.access;
  const kinds = [...new Set(project.forms.filter(f => f.pageId === page.id).map(f => f.kind === 'Grid' ? 'List' : f.kind))].join(' / ');
  lines.push(`  ${pages.get(page.id)}["${label(`${page.title} · ${page.route}${kinds ? ' · ' + kinds : ''} · ${access === 'authenticated' ? 'sign in required' : 'public'}`)}"]`);
 }
 const dataEdges = new Set<string>();
 for (const form of project.forms) if (form.sourceRef && sourceIds.has(form.sourceRef.id) && pages.has(form.pageId)) dataEdges.add(`  ${sourceIds.get(form.sourceRef.id)} -->|"data"| ${pages.get(form.pageId)}`);
 lines.push(...dataEdges);
 const movement = new Map<string, Set<string>>();
 function edge(from: string, to: string, caption: string) {
  if (!pages.has(from as Project['id']) || !pages.has(to as Project['id'])) return;
  const key = `${pages.get(from as Project['id'])} --> ${pages.get(to as Project['id'])}`;
  const captions = movement.get(key) ?? new Set<string>(); captions.add(caption); movement.set(key, captions);
 }
 for (const behavior of graph.edges) {
  if (!['destination', 'success', 'cancel'].includes(behavior.kind)) continue;
  const action = project.actions.find(a => a.id === behavior.sourceObjectId);
  const form = project.forms.find(f => f.id === action?.formId);
  if (!action || !form) continue;
  const caption = graph.nodes.find(n => n.id === action.id)?.label ?? action.operation;
  edge(form.pageId, behavior.toId, ({ login: 'Sign in', logout: 'Sign out', navigate: 'Open page', cancel: 'Cancel' } as Record<string, string>)[caption] ?? caption);
 }
 const login = project.forms.find(f => f.kind === 'Login');
 if (login) for (const page of project.pages.filter(p => p.id !== login.pageId)) {
  if (!graph.nodes.some(n => n.pageId === page.id && n.access === 'authenticated')) continue;
  edge(page.id, login.pageId, 'Sign in required'); edge(login.pageId, page.id, 'Return after sign in');
 }
 for (const [key, captions] of movement) {
  const [from, to] = key.split(' --> ');
  lines.push(`  ${from} -->|"${label([...captions].join(' / '))}"| ${to}`);
 }
 return lines.join('\n');
}
