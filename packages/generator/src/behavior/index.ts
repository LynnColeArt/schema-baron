/** Browser-safe emission metadata. Both the emitter and behavior projection use this order. */
export const handlerPath=(kind:'record'|'navigation',index:number)=>`/runtime/${kind}-${index}`;
export const authPath='/runtime/auth';
export const csrfPath='/runtime/auth/csrf';
export const pageFile=(path:string)=>`app${path==='/'?'':path}/page.tsx`;
export function emissionOrder<T extends {grids:{id:string}[];records:{id:string}[]}>(routes:T[]){
 let index=0;return routes.flatMap(route=>[...route.grids.map(form=>({route,formId:form.id,index:index++,kind:'grid' as const})),...route.records.map(form=>({route,formId:form.id,index:index++,kind:'record' as const}))]);
}
