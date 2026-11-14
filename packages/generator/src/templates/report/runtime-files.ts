import {readFileSync,existsSync} from 'node:fs';
import {isLiteralValue} from '@schema-baron/model';
import type {GeneratedFile} from '../../ir/index.js';
export function queryScalarFile():GeneratedFile {return {path:'server/query-scalar.js',content:'export '+isLiteralValue.toString()+`
export function parseQueryInput(text,input){
 if(typeof text!=='string'||text.length>1000)throw Error('Enter at most 1000 characters.');
 const kind=input.type.kind;
 const value=['integer','real'].includes(kind)?(/^[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?$/.test(text)?Number(text):undefined):kind==='boolean'?(text==='true'?true:text==='false'?false:undefined):text;
 if(!isLiteralValue(value,input.type,input.nullable))throw Error('Input does not match its declared type.');return value;
}
`};}
/** Copy the actual built preview executor/arithmetic, never a parallel implementation. */
export function queryRuntimeFiles():GeneratedFile[] {
 const entry=new URL(import.meta.resolve('@schema-baron/sqlite'));
 const base=new URL('./query/',entry);
 const read=(name:string)=>readFileSync(new URL(name,base),'utf8');
 if(!existsSync(new URL('execute.js',base)))throw Error('Build the pinned SQLite workspace before generating query reports.');
 let execute=read('execute.js');
 execute=execute.replace("import { isLiteralValue } from '@schema-baron/model';", "import { isLiteralValue } from './query-scalar.js';");
 const start=execute.indexOf("import { existsSync }");const end=execute.indexOf('/** Internal worker');
 if(start<0||end<start)throw Error('Query executor imports changed. Update portable runtime registration.');
 execute=execute.slice(0,start)+"import {QueryError,quoteIdentifier} from './query-support.js';\nimport {decimalCodec,registerDecimalFunctions} from './query-decimal.js';\n"+execute.slice(end);
 return [{path:'server/query-execute.js',content:execute},{path:'server/query-support.js',content:read('support.js')},{path:'server/query-decimal.js',content:readFileSync(new URL('../decimal/index.js',base),'utf8')}];
}
