import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GenerationError } from '/home/lynn/projects/schema-baron/.worktrees/schema-baron-studio-01M5W3Q9-lane-j/packages/generator/dist/index.js';
const project=JSON.parse(readFileSync('/tmp/wp10-browser-yUgdqS/definitions/5d0c33a3-9165-4280-beca-5103f04f3ff5.json','utf8'));
let rejected=false;
try { await import('/tmp/wp10-review-routes.mjs'); }
catch(error) {
 assert.ok(error instanceof GenerationError);
 assert.ok(error.diagnostics.some(d=>d.objectId===project.pages[0].id&&d.code==='UNSUPPORTED_SCHEMA_OBJECT'));
 rejected=true;
 console.log(JSON.stringify({unchangedReproducer:'/tmp/wp10-review-routes.mjs',rejectedBeforeOutput:true,diagnostics:error.diagnostics}));
}
assert.ok(rejected,'The declared private route must be rejected before output.');
