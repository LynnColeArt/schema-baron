import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { parseProject } from '@schema-baron/model';
export function project() { return parseProject(JSON.parse(readFileSync('fixtures/queries/project.json','utf8'))); }
export function seed(path: string) {
 const db=new Database(path); db.exec(`CREATE TABLE "parent "" ledger" ("first key" TEXT NOT NULL,"second key" INTEGER NOT NULL,PRIMARY KEY("first key","second key")); CREATE TABLE detail(id INTEGER PRIMARY KEY,parent_a TEXT,parent_b INTEGER,price TEXT,quantity TEXT); CREATE TABLE fee(id INTEGER PRIMARY KEY,parent_a TEXT,parent_b INTEGER,fee TEXT); INSERT INTO "parent "" ledger" VALUES('zero',1),('one',1),('many',1),('many',2); INSERT INTO detail VALUES(1,'one',1,'0.1000','3.0000'),(2,'many',1,'2.3500','1.5000'),(3,'many',1,'0.1250','2.0000'),(4,'many',2,'10.0000','1.0000'); INSERT INTO fee VALUES(1,'many',1,'1.1250'),(2,'many',1,'0.2500');`); return db;
}
