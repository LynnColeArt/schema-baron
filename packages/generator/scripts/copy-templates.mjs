import {copyFileSync,mkdirSync} from 'node:fs';
for(const name of ['repository.template','package-lock.template','output-test.template','format.template']){mkdirSync(new URL('../dist/templates/base/',import.meta.url),{recursive:true});copyFileSync(new URL('../src/templates/base/'+name,import.meta.url),new URL('../dist/templates/base/'+name,import.meta.url));}
