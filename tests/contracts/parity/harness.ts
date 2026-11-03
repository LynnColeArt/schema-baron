import {spawn} from 'node:child_process';
import {mkdirSync,renameSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';

export const parityEvidenceRoot=()=>resolve(process.env.SCHEMA_BARON_PARITY_EVIDENCE??'docs/evidence/generality');
export interface ChildResult {status:number|null;signal:NodeJS.Signals|null;stdout:string;stderr:string;durationMs:number;timedOut:boolean;error?:string}
/** The owner runs in this process: never block its timers/sockets while a child installs output. */
export async function runChild(executable:string,args:string[],options:{cwd:string;timeoutMs:number}):Promise<ChildResult>{
 const started=performance.now(),child=spawn(executable,args,{cwd:options.cwd,detached:true,stdio:['ignore','pipe','pipe']});
 let stdout='',stderr='',timedOut=false,error:string|undefined,escalation:ReturnType<typeof setTimeout>|undefined;
 child.stdout!.on('data',chunk=>stdout+=String(chunk));child.stderr!.on('data',chunk=>stderr+=String(chunk));
 const kill=(signal:NodeJS.Signals)=>{if(!child.pid||child.exitCode!==null||child.signalCode!==null)return;try{if(process.platform==='win32')child.kill(signal);else process.kill(-child.pid,signal);}catch(cause){if((cause as NodeJS.ErrnoException).code!=='ESRCH')throw cause;}};
 const timer=setTimeout(()=>{timedOut=true;kill('SIGTERM');escalation=setTimeout(()=>kill('SIGKILL'),1000);},options.timeoutMs);
 return await new Promise(resolve=>{
  child.once('error',cause=>{error=cause.message;});
  child.once('close',(status,signal)=>{clearTimeout(timer);if(escalation)clearTimeout(escalation);resolve({status,signal,stdout,stderr,durationMs:performance.now()-started,timedOut,...(error?{error}:{})});});
 });
}

/** No command inputs, cookies, credentials or raw outcomes are journaled. Flush before each boundary. */
export class EvidenceJournal {
 private secrets:string[]=[];
 private started=performance.now();
 private context:Record<string,unknown>={phase:'initializing'};
 private events:Record<string,unknown>[]=[];
 private state:'running'|'succeeded'|'failed'='running';
 private failure:unknown;
 constructor(private directory:string,private name:string){mkdirSync(directory,{recursive:true});this.flush();}
 redact(...values:string[]){this.secrets.push(...values.filter(Boolean));}
 private clean(value:unknown):unknown {if(typeof value==='string')return this.secrets.reduce((text,secret)=>text.replaceAll(secret,'<redacted>'),value);if(Array.isArray(value))return value.map(v=>this.clean(v));if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,this.clean(v)]));return value;}
 begin(context:Record<string,unknown>){this.context=context;this.events.push({elapsedMs:performance.now()-this.started,...context,state:'started'});this.flush();}
 observed(value:Record<string,unknown>){this.events.push({elapsedMs:performance.now()-this.started,...this.context,...value,state:'observed'});this.flush();}
 fail(error:unknown){this.state='failed';const describe=(value:unknown):unknown=>value instanceof Error?{name:value.name,message:value.name==='AssertionError'?'Assertion failed; see test runner result.':value.message,stack:value.stack?.split('\n').filter(line=>/^\s+at /.test(line)).join('\n'),...Object.fromEntries(['code','errno','syscall'].filter(key=>key in value).map(key=>[key,(value as unknown as Record<string,unknown>)[key]])),...(value instanceof AggregateError?{errors:value.errors.map(describe)}:{}),...(value.cause?{cause:describe(value.cause)}:{})}:String(value);const failure={context:this.context,error:describe(error)};if(this.failure)this.events.push({elapsedMs:performance.now()-this.started,phase:'additional-failure',...failure});else this.failure=failure;this.flush();}
 succeed(){this.state='succeeded';this.flush();}
 cleanup(value:Record<string,unknown>){this.events.push({elapsedMs:performance.now()-this.started,phase:'cleanup',...value});this.flush();}
 private flush(){const path=join(this.directory,this.name+'.json'),temporary=path+'.'+process.pid+'.tmp';writeFileSync(temporary,JSON.stringify(this.clean({status:this.state,elapsedMs:performance.now()-this.started,context:this.context,events:this.events,...(this.failure?{failure:this.failure}:{})}),null,2)+'\n',{mode:0o600,flush:true});renameSync(temporary,path);}
}
