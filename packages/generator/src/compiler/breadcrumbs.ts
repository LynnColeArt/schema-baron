import { effectiveAccess, type Project } from '@schema-baron/model';
/** Public, parameter-free parents only. Never expose protected labels or infer keys. */
export function compileBreadcrumbs(project: Project, pageId: string): {path:string;title:string}[] {
 const pages = new Map(project.pages.map(page => [page.id as string, page]));
 const ancestors: {path:string;title:string}[] = [];
 const seen = new Set<string>([pageId]);
 let parent = pages.get(pageId)?.breadcrumbParentId;
 while (parent !== undefined) {
  if (seen.has(parent)) throw Error('Cyclic breadcrumb hierarchy.');
  seen.add(parent);
  const page = pages.get(parent);
  if (!page) throw Error('Unknown breadcrumb parent.');
  const forms = project.forms.filter(form => form.pageId === page.id);
  const requiresContext = forms.some(form => form.kind === 'Record' || form.keyMapping.length > 0 || (form.queryParameters ?? []).some(parameter => parameter.runtime));
  if (effectiveAccess(project,page.id).access === 'public' && !requiresContext) ancestors.unshift({path:page.route,title:page.title});
  parent = page.breadcrumbParentId;
 }
 return ancestors;
}
