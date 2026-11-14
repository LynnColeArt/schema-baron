import type {Project,Query} from './schemas.js';
/** Saved query dependencies share stable typed input IDs; visit each source once. */
export function queryInputs(project:Project,queryId:string):Query['parameters']{
 const result:Query['parameters']=[],seen=new Set<string>();
 function visit(id:string){if(seen.has(id))return;seen.add(id);const query=project.queries.find(q=>q.id===id);if(!query)return;result.push(...query.parameters);for(const source of query.sources)if(source.source.kind==='query')visit(source.source.id);}
 visit(queryId);return result;
}
