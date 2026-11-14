# Executed operation matrix

Both columns are independent primary executions. Matching opposite-transport replay is additional evidence. Repeated job/status polling is collapsed here; raw outcomes remain in parity-matrix.json. HTTP uses Studio session cookie, Origin and CSRF; MCP is a real SDK stdio process forwarding to the owner.

| Operation | MCP primary outcomes | HTTP UI primary outcomes |
|---|---|---|
| connection.bind | OK | OK |
| connection.inspect | OK | OK |
| extension.read | OK | OK |
| extension.write | OK, OUTPUT_CONFLICT | OK, OUTPUT_CONFLICT |
| flow.inspect | OK | OK |
| form.construct | OK | OK |
| generation.apply | IMPACT_NOT_ACKNOWLEDGED, OK | IMPACT_NOT_ACKNOWLEDGED, OK |
| generation.preview | OK | OK |
| identity.configure | OK | OK |
| identity.provision | OK | OK |
| job.cancel | OK | OK |
| job.inspect | OK | OK |
| project.batch | INVALID_INPUT, OK, REVISION_CONFLICT, VALIDATION_FAILED | INVALID_INPUT, OK, REVISION_CONFLICT, VALIDATION_FAILED |
| project.create | OK | OK |
| project.export | OK | OK |
| project.inspect | OK | OK |
| project.list | OK | OK |
| project.open | OK | OK |
| project.validate | IDEMPOTENCY_CONFLICT, OK | IDEMPOTENCY_CONFLICT, OK |
| query.preview | OK | OK |
| runtime.context | OK | OK |
| runtime.route | OK, PROJECT_BUSY | OK, PROJECT_BUSY |
| runtime.start | OK | OK |
| runtime.status | OK | OK |
| runtime.stop | OK | OK |
| schema.apply | OK | OK |
| schema.history | OK | OK |
| schema.preview | OK | OK |
| schema.restoreApply | OK | OK |
| schema.restorePreview | OK | OK |
| source.read | OK | OK |

Advertised implemented operations: 31. Unexecuted advertised operations: none.

This is operation parity, not a claim of every negative input or every lifecycle race. Schema flow projection is explicitly unsupported; the corpus uses supported application/endpoint projections. The main report describes concrete database, authored-file, generated HTTP, job and export effect assertions.
