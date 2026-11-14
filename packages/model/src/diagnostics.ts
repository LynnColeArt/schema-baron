import { z } from 'zod';
import { idSchema, revisionSchema } from './schemas.js';
export const diagnosticCodeSchema = z.enum(['INVALID_INPUT', 'QUERY_COST_EXCEEDED', 'TIMEOUT', 'CANCELED', 'NOT_FOUND', 'UNSUPPORTED_FORMAT', 'UNSUPPORTED_SCHEMA_OBJECT', 'BROKEN_REFERENCE', 'TYPE_MISMATCH', 'INVALID_QUERY_GRAIN', 'UNSAFE_EXPRESSION', 'REVISION_CONFLICT', 'DATABASE_CHANGED', 'PLAN_EXPIRED', 'PLAN_HASH_MISMATCH', 'IMPACT_NOT_ACKNOWLEDGED', 'OUTPUT_CONFLICT', 'PATH_OUTSIDE_ROOT', 'AUTH_REQUIRED', 'ACCESS_DENIED', 'VALIDATION_FAILED', 'RELATED_RECORDS_EXIST', 'PROJECT_BUSY', 'IDEMPOTENCY_CONFLICT', 'RECOVERY_REQUIRED']);
export const diagnosticSchema = z.strictObject({ code: diagnosticCodeSchema, severity: z.enum(['info', 'warning', 'error']), message: z.string().min(1), objectId: idSchema.optional(), path: z.string().optional(), field: z.string().optional(), retryable: z.boolean().optional(), recoveryAction: z.string().optional() });
export type Diagnostic = z.infer<typeof diagnosticSchema>;
export type DiagnosticCode = Diagnostic['code'];
export const errorSchema = diagnosticSchema.omit({ severity: true });
export function outcomeSchema<T extends z.ZodType>(result: T) { return z.discriminatedUnion('ok', [z.strictObject({ ok: z.literal(true), revision: revisionSchema, result, diagnostics: z.array(diagnosticSchema), jobId: idSchema.optional() }), z.strictObject({ ok: z.literal(false), revision: z.number().int().min(0), error: errorSchema, diagnostics: z.array(diagnosticSchema) })]); }
export type Outcome<T> = { ok: true; revision: number; result: T; diagnostics: Diagnostic[]; jobId?: string } | { ok: false; revision: number; error: Omit<Diagnostic, 'severity'>; diagnostics: Diagnostic[] };
