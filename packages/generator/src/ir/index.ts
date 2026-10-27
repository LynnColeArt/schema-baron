import type { Control, DocumentNode, Form, ScalarType } from '@schema-baron/model';
export interface FieldIR { id:string; name:string; type:ScalarType; nullable:boolean }
export interface ControlIR { id:string; kind:Control['kind']; fieldId?:string; label:string; format:NonNullable<Control['appearance']['format']> }
export interface SourceIR { id:string; kind:'table'; name:string; fields:FieldIR[]; keys:string[] }
export interface GridIR { id:string; label:string; source:SourceIR; controls:ControlIR[]; keyMapping:Form['keyMapping']; search:Form['search']; sorting:Form['sorting']; pageSize:number }
export interface RouteIR { id:string; path:string; title:string; document:DocumentNode[]; grids:GridIR[]; policy:{access:'public'; sourceId:string} }
export interface GenerationIR { projectId:string; revision:number; name:string; routes:RouteIR[]; sources:SourceIR[]; queries:never[] }
export interface GeneratedFile { path:string; content:string }
