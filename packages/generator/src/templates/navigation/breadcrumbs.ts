import type { RouteIR } from '../../ir/index.js';
/** Current crumb is plain text; the sole page heading remains outside navigation. */
export function breadcrumbHeader(route: Pick<RouteIR,'title'|'breadcrumbs'>): string {
 const heading = `<h1>{${JSON.stringify(route.title)}}</h1>`;
 if (route.breadcrumbs === undefined) return `      ${heading}`;
 const links = route.breadcrumbs.map(crumb => `        <li><a href={${JSON.stringify(crumb.path)}}>{${JSON.stringify(crumb.title)}}</a></li>`);
 return ['      <nav aria-label="Breadcrumb" className="generated-breadcrumbs">','        <ol>',...links,`        <li aria-current="page">{${JSON.stringify(route.title)}}</li>`,'        </ol>','      </nav>',`      ${heading}`].join('\n');
}
