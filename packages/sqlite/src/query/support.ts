import type { DiagnosticCode } from '@schema-baron/model';
export class QueryError extends Error { readonly code: DiagnosticCode; constructor(code: DiagnosticCode, message: string) { super(message); this.code=code; } }
export function quoteIdentifier(name: string): string {
 if (!name || name.length > 1024 || name.includes('\0')) throw new QueryError('UNSAFE_EXPRESSION','Invalid SQLite identifier.');
 return '"'+name.replaceAll('"','""')+'"';
}
