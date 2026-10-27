/** Shared server implementation; emitted verbatim as independent application source. */
import Database from 'better-sqlite3';
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { chmodSync, existsSync, lstatSync } from 'node:fs';
export type IdentityMapping={table:string;id:string;username:string;password:string};
export const quote=(name:string)=>'"'+name.replaceAll('"','""')+'"';
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
const derive=(password:string,salt:Buffer)=>new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024},(error,key)=>error?reject(error):resolve(key)));
export async function passwordHash(password:string) {
 if(!password||Buffer.byteLength(password)>1024) throw Error('Invalid credential input.');
 const salt=randomBytes(16),key=await derive(password,salt);
 return ['scrypt','1','32768','8','1',salt.toString('hex'),key.toString('hex')].join('$');
}
export async function verifyPassword(password:string,encoded:string) {
 const match=/^scrypt\$1\$32768\$8\$1\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(encoded);
 // Missing accounts and incompatible hashes incur the same KDF cost.
 const key=await derive(password.slice(0,1024),Buffer.from(match?.[1]??'00'.repeat(16),'hex'));
 return !!match&&timingSafeEqual(key,Buffer.from(match[2]!,'hex'));
}
export function managedIdentityPath(database:string,projectId:string) {return database+'.auth-'+digest(projectId).slice(0,32)+'.sqlite';}
export function compatibleMapping(project:{identity?:{kind:string;tableId?:string;userIdColumnId?:string;usernameColumnId?:string;passwordHashColumnId?:string}|undefined;schema:{tables:readonly {id:string;physicalName:string;columns:readonly {id:string;physicalName:string;type:{kind:string};nullable:boolean;generated?:unknown;default?:unknown}[];primaryKey:readonly string[];uniqueConstraints:readonly {columnIds:readonly string[]}[]}[]}}):IdentityMapping|undefined {
 const i=project.identity;if(i?.kind!=='mapped')return;
 const table=project.schema.tables.find(t=>t.id===i.tableId),ids=[i.userIdColumnId,i.usernameColumnId,i.passwordHashColumnId];
 if(!table||new Set(ids).size!==3||ids.some(id=>{const c=table.columns.find(c=>c.id===id);return !c||c.type.kind!=='text'||c.nullable||c.generated;})||table.primaryKey.length!==1||table.primaryKey[0]!==i.userIdColumnId||!table.uniqueConstraints.some(u=>u.columnIds.length===1&&u.columnIds[0]===i.usernameColumnId)||table.columns.some(c=>!ids.includes(c.id)&&!c.nullable&&!c.default&&!c.generated))throw Error('Mapped identity requires distinct required text ID primary key, unique username, versioned hash fields, and defaults for other required fields.');
 return {table:table.physicalName,id:table.columns.find(c=>c.id===i.userIdColumnId)!.physicalName,username:table.columns.find(c=>c.id===i.usernameColumnId)!.physicalName,password:table.columns.find(c=>c.id===i.passwordHashColumnId)!.physicalName};
}
export class IdentityStore {
 private db:Database.Database;
 private project:string;
 private mapping:IdentityMapping|undefined;
 private dataPath:string|undefined;
 constructor(path:string,project:string,mapping?:IdentityMapping,dataPath?:string) {
  this.project=project;this.mapping=mapping;this.dataPath=dataPath;
  for(const suffix of ['', '-wal', '-shm', '-journal']){const stat=lstatSync(path+suffix,{throwIfNoEntry:false});if(stat&&(stat.isSymbolicLink()||stat.nlink!==1||!stat.isFile()))throw Error('Identity store cannot alias another file.');}
  const existed=existsSync(path);
  this.db=new Database(path,{fileMustExist:existed});
  if(existed){try{const marker=this.db.prepare('SELECT version FROM schema_baron_identity_store WHERE purpose=?').get('visitor-identity') as {version:number}|undefined;if(marker?.version!==1)throw Error();}catch{this.db.close();throw Error('Existing identity file is unrelated or has an unsupported version; preserve it and choose a compatible identity source.');}}
  chmodSync(path,0o600);this.db.pragma('busy_timeout = 1000');
  if(!existed)this.db.exec("CREATE TABLE schema_baron_identity_store(purpose TEXT PRIMARY KEY,version INTEGER NOT NULL); INSERT INTO schema_baron_identity_store VALUES('visitor-identity',1);");
  this.db.exec('CREATE TABLE IF NOT EXISTS identities(project TEXT NOT NULL,id TEXT NOT NULL,username TEXT NOT NULL,password TEXT NOT NULL,UNIQUE(project,username),PRIMARY KEY(project,id)); CREATE TABLE IF NOT EXISTS sessions(project TEXT NOT NULL,token TEXT NOT NULL,user TEXT NOT NULL,expires INTEGER NOT NULL,csrf TEXT NOT NULL,PRIMARY KEY(project,token)); CREATE TABLE IF NOT EXISTS attempts(project TEXT NOT NULL,key TEXT NOT NULL,count INTEGER NOT NULL,until INTEGER NOT NULL,PRIMARY KEY(project,key)); CREATE TABLE IF NOT EXISTS provisions(project TEXT NOT NULL,request TEXT NOT NULL,user TEXT NOT NULL,PRIMARY KEY(project,request));');
 }
 provisioned(request:string) {return (this.db.prepare('SELECT user FROM provisions WHERE project=? AND request=?').get(this.project,request) as {user:string}|undefined)?.user;}
 private identityDatabase() {return this.mapping?new Database(this.dataPath!,{fileMustExist:true}):this.db;}
 async provision(username:string,password:string,request:string,beforeWrite:()=>void=()=>{}) {
  if(!username||username.length>200||Buffer.byteLength(password)>1024) throw Error('Invalid credential input.');
  if(this.provisioned(request)) throw Error('Provision request was already consumed; use a new request ID.');
  const encoded=await passwordHash(password),id=randomUUID();beforeWrite();const db=this.identityDatabase();
  try {
   if(this.mapping) {
    const m=this.mapping;
    // Only explicit text ID/name/versioned hash mappings, validated before opening.
    db.prepare(`INSERT INTO ${quote(m.table)}(${quote(m.id)},${quote(m.username)},${quote(m.password)}) VALUES(?,?,?)`).run(id,username,encoded);
   }else this.db.prepare('INSERT INTO identities VALUES(?,?,?,?)').run(this.project,id,username,encoded);
   this.db.prepare('INSERT INTO provisions VALUES(?,?,?)').run(this.project,request,id);return id;
  }finally {if(db!==this.db)db.close();}
 }
 async login(username:string,password:string,prior:string|undefined,rateKey:string,now=Date.now(),ttl=8*60*60*1000) {
  const key=digest(rateKey),attempt=this.db.prepare('SELECT count,until FROM attempts WHERE project=? AND key=?').get(this.project,key) as {count:number;until:number}|undefined;
  if(attempt&&attempt.until>now&&attempt.count>=8) throw Error('Sign in failed. Try again later.');
  this.db.prepare('INSERT INTO attempts VALUES(?,?,1,?) ON CONFLICT(project,key) DO UPDATE SET count=CASE WHEN until<=? THEN 1 ELSE count+1 END,until=CASE WHEN until<=? THEN excluded.until ELSE until END').run(this.project,key,now+60000,now,now);
  const db=this.identityDatabase();let user:{id:string;password:string}|undefined;
  try {user=(this.mapping?db.prepare(`SELECT ${quote(this.mapping.id)} AS id,${quote(this.mapping.password)} AS password FROM ${quote(this.mapping.table)} WHERE ${quote(this.mapping.username)}=? LIMIT 1`).get(username):db.prepare('SELECT id,password FROM identities WHERE project=? AND username=?').get(this.project,username)) as typeof user;}finally{if(db!==this.db)db.close();}
  if(!await verifyPassword(password,String(user?.password??''))||!user) throw Error('Sign in failed. Try again later.');
  const token=randomBytes(32).toString('base64url'),csrf=randomBytes(32).toString('base64url'),expires=now+ttl;
  this.db.transaction(()=>{if(prior)this.logout(prior);this.db.prepare('DELETE FROM sessions WHERE project=? AND expires<=?').run(this.project,now);this.db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run(this.project,digest(token),user!.id,expires,digest(csrf));})();
  return {token,csrf,expires,userId:user.id};
 }
 session(token:string|undefined,now=Date.now()) {if(!token||!/^[A-Za-z0-9_-]{43}$/.test(token))return;return this.db.prepare('SELECT user,expires,csrf FROM sessions WHERE project=? AND token=? AND expires>?').get(this.project,digest(token),now) as {user:string;expires:number;csrf:string}|undefined;}
 username(token:string|undefined) {const session=this.session(token);if(!session)return;const db=this.identityDatabase();try {const row=(this.mapping?db.prepare(`SELECT ${quote(this.mapping.username)} AS username FROM ${quote(this.mapping.table)} WHERE ${quote(this.mapping.id)}=?`).get(session.user):db.prepare('SELECT username FROM identities WHERE project=? AND id=?').get(this.project,session.user)) as {username:string}|undefined;return row?.username;}finally{if(db!==this.db)db.close();}}
 checkCsrf(token:string|undefined,csrf:string|undefined) {const session=this.session(token);return !!session&&!!csrf&&timingSafeEqual(Buffer.from(session.csrf,'hex'),Buffer.from(digest(csrf),'hex'));}
 logout(token:string) {this.db.prepare('DELETE FROM sessions WHERE project=? AND token=?').run(this.project,digest(token));}
 close(){this.db.close();}
}
