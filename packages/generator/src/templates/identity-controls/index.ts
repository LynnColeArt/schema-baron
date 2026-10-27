import { readFileSync } from 'node:fs';
import type { GeneratedFile } from '../../ir/index.js';
export function identityControlFiles():GeneratedFile[]{return [{path:'components/sign-out.tsx',content:readFileSync(new URL('./sign-out.template',import.meta.url),'utf8')},{path:'components/identity-header.tsx',content:readFileSync(new URL('./header.template',import.meta.url),'utf8')},{path:'components/login.tsx',content:readFileSync(new URL('./login.template',import.meta.url),'utf8')}];}
