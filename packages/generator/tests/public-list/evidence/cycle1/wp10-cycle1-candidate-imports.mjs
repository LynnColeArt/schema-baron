import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const candidate=process.env.WP10_REVIEW_CANDIDATE??join(readFileSync('/tmp/wp10-cycle1-runtime-root.txt','utf8').trim(),'application');
const originals=new Set(['/tmp/wp10-browser-bn2O50/output/instruments/server/repository.ts','/tmp/wp10-browser-bn2O50/output/instruments/server/format.ts']);
registerHooks({resolve(specifier,context,nextResolve){
 if(originals.has(specifier))return nextResolve(join(candidate,'server',specifier.split('/').at(-1)),context);
 return nextResolve(specifier,context);
}});
