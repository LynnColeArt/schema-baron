import type { Action, Control, DocumentNode, Form, LiteralValue, ScalarType, Query }  from '@schema-baron/model';
import type { IdentityMapping } from '../templates/auth/store.js';
export interface FieldIR { id:string; name:string; type:ScalarType; nullable:boolean; generated?:boolean; hasDefault?:boolean }
export interface ControlIR { id:string; kind:Control['kind']; fieldId?:string; label:string; readOnly?:boolean; validation?:Control['validation']; lookup?:Control['lookup']; events?:Control['events']; format:NonNullable<Control['appearance']['format']> }
export interface SourceIR { id:string; kind:'table'|'query'; name:string; fields:FieldIR[]; keys:string[] }
export type NavigationExpressionIR = {kind:'field';fieldId:string}|{kind:'parameter';parameterId:string}|{kind:'literal';value:LiteralValue};
export interface DestinationIR {path:string;mappings:{parameter:string;field:FieldIR;expression:NavigationExpressionIR}[];newForms:string[]}
export interface ActionIR {id:string;label?:string;operation:Action['operation'];access?:'public'|'authenticated';destination?:DestinationIR;success?:DestinationIR;cancel?:DestinationIR}
export interface ContextIR {parameter:string;field?:FieldIR;kind?:'page'|'sort'|'direction'|'search'|'key'|'query'|'mode';allowed?:string[]}
export interface GridIR { report?: {queryId:string;parameters:Form['queryParameters']}; pageId?:string; id:string; label:string; source:SourceIR; controls:ControlIR[]; keyMapping:Form['keyMapping']; search:Form['search']; sorting:Form['sorting']; pageSize:number; actions?:ActionIR[]; context?:ContextIR[]; kind?:Form['kind'] }
export interface RecordIR { id:string; label:string; source:SourceIR; controls:ControlIR[]; config:Record<string,unknown> }
export interface RouteIR { id:string; path:string; title:string; document:DocumentNode[]; identityCaption?:string; grids:GridIR[]; records:RecordIR[]; logins:{id:string;username:string;password:string;usernameLabel:string;passwordLabel:string;actions:ActionIR[]}[]; policy:{access:'public'|'authenticated'; sourceId:string} }
export interface GenerationIR { projectId:string; revision:number; name:string; routes:RouteIR[]; sources:SourceIR[]; auth?:{mapping?:IdentityMapping}; contexts:ContextIR[]; queries:QueryIR[] }
export interface GeneratedFile { path:string; content:string }

export interface QueryIR {id:string; compiled:import('@schema-baron/sqlite').CompiledQuery; inputs:Query['parameters']; bindings:Record<string,string[]>;aliases?:Record<string,string>}
