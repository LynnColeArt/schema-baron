import { z } from 'zod';

export const FORMAT_VERSION = 1 as const;
export const idSchema = z.string().min(1).max(256).brand<'StableId'>();
export type StableId = z.infer<typeof idSchema>;
/** IDs are allocated by the caller's secure UUID source, never derived from names. */
export function createId(uuid: () => string = () => globalThis.crypto.randomUUID()): StableId { return idSchema.parse(uuid()); }
const text = z.string().min(1);
const ids = z.array(idSchema);
export const revisionSchema = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
export const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const targetSchema = z.literal('next-typescript-sqlite');
export const scalarTypeSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.enum(['integer', 'real', 'text', 'blob', 'boolean']) }),
  z.strictObject({ kind: z.literal('date'), encoding: z.literal('iso-date') }),
  z.strictObject({ kind: z.literal('datetime'), encoding: z.literal('iso-utc') }),
  z.strictObject({ kind: z.literal('decimal'), scale: z.number().int().min(0).max(18), precision: z.number().int().min(1).max(38), encoding: z.enum(['text', 'scaled-integer']), rounding: z.enum(['half-up', 'half-even', 'down']) }).refine(t => t.scale <= t.precision && (t.encoding !== 'scaled-integer' || t.precision <= 18), 'Scale exceeds precision or scaled integer exceeds the supported 18-digit boundary'),
]);
export type ScalarType = z.infer<typeof scalarTypeSchema>;
export type LiteralValue = string | number | boolean | null;
export type Expression =
  | { kind: 'literal'; value: LiteralValue; type: ScalarType }
  | { kind: 'field'; alias: string; fieldId: StableId }
  | { kind: 'parameter'; parameterId: StableId }
  | { kind: 'binary'; operator: '+' | '-' | '*' | '/' | '=' | '!=' | '<' | '<=' | '>' | '>=' | 'and' | 'or'; left: Expression; right: Expression }
  | { kind: 'function'; function: 'coalesce' | 'lower' | 'upper' | 'length' | 'abs' | 'date' | 'year'; args: Expression[] }
  | { kind: 'aggregate'; function: 'count' | 'sum' | 'min' | 'max' | 'avg'; argument?: Expression | undefined; distinct?: boolean | undefined; zeroChildren?: 'null' | 'zero' | undefined };
export const expressionSchema: z.ZodType<Expression> = z.lazy(() => z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('literal'), value: z.union([z.string(), z.number().finite(), z.boolean(), z.null()]), type: scalarTypeSchema }),
  z.strictObject({ kind: z.literal('field'), alias: text, fieldId: idSchema }),
  z.strictObject({ kind: z.literal('parameter'), parameterId: idSchema }),
  z.strictObject({ kind: z.literal('binary'), operator: z.enum(['+', '-', '*', '/', '=', '!=', '<', '<=', '>', '>=', 'and', 'or']), left: expressionSchema, right: expressionSchema }),
  z.strictObject({ kind: z.literal('function'), function: z.enum(['coalesce', 'lower', 'upper', 'length', 'abs', 'date', 'year']), args: z.array(expressionSchema).min(1).max(16) }),
  z.strictObject({ kind: z.literal('aggregate'), function: z.enum(['count', 'sum', 'min', 'max', 'avg']), argument: expressionSchema.optional(), distinct: z.boolean().optional(), zeroChildren: z.enum(['null', 'zero']).optional() }),
]));
export const sourceRefSchema = z.strictObject({ kind: z.enum(['table', 'query']), id: idSchema });
export const columnSchema = z.strictObject({ id: idSchema, physicalName: text, type: scalarTypeSchema, nullable: z.boolean(), default: expressionSchema.optional(), generated: z.strictObject({ expression: expressionSchema, sourceDependencies: ids.min(1) }).optional() });
export const foreignKeySchema = z.strictObject({ id: idSchema, columnIds: ids.min(1), referencedTableId: idSchema, referencedColumnIds: ids.min(1), onUpdate: z.enum(['restrict', 'cascade', 'set-null', 'set-default', 'no-action']), onDelete: z.enum(['restrict', 'cascade', 'set-null', 'set-default', 'no-action']), deferrable: z.boolean() });
export const tableSchema = z.strictObject({ id: idSchema, physicalName: text, columns: z.array(columnSchema).min(1), primaryKey: ids, foreignKeys: z.array(foreignKeySchema), uniqueConstraints: z.array(z.strictObject({ id: idSchema, columnIds: ids.min(1) })), checks: z.array(z.strictObject({ id: idSchema, expression: expressionSchema })), indexes: z.array(z.strictObject({ id: idSchema, physicalName: text, columnIds: ids.min(1), unique: z.boolean(), where: expressionSchema.optional() })) });
export const schemaSchema = z.strictObject({ id: idSchema, revision: revisionSchema, tables: z.array(tableSchema), opaqueObjects: z.array(z.strictObject({ id: idSchema, kind: text, physicalName: text, sql: text, dependencies: ids, readOnly: z.literal(true) })) });
export const capabilityReportSchema = z.strictObject({ sqliteVersion: text, foreignKeys: z.boolean(), returning: z.boolean(), strictTables: z.boolean(), unsupportedObjects: ids });
export const connectionSchema = z.strictObject({ id: idSchema, name: text, locator: z.strictObject({ approvedRootId: idSchema, relativePath: text }), fingerprint: hashSchema, capabilities: capabilityReportSchema, secretRef: idSchema.optional(), physical: z.strictObject({ encoding: text, objects: z.array(z.strictObject({ type: text, name: text, tbl_name: text, rootpage: z.number().int(), sql: z.string().nullable() })), tables: z.array(z.strictObject({ name: text, columns: z.array(z.strictObject({ cid: z.number().int(), name: text, type: z.string(), notnull: z.number().int(), dflt_value: z.string().nullable(), pk: z.number().int(), hidden: z.number().int() })), foreignKeys: z.array(z.strictObject({ id: z.number().int(), seq: z.number().int(), table: text, from: text, to: z.string().nullable(), on_update: text, on_delete: text, match: text })), indexes: z.array(z.strictObject({ name: text, unique: z.number().int(), origin: text, partial: z.number().int(), sql: z.string().nullable(), columns: z.array(z.strictObject({ seqno: z.number().int(), cid: z.number().int(), name: z.string().nullable(), desc: z.number().int(), coll: z.string().nullable(), key: z.number().int() })) })) })) }).optional() });
export const schemaSnapshotSchema = z.strictObject({ schema: schemaSchema, capabilities: capabilityReportSchema, physicalFingerprint: hashSchema });
export const parameterSchema = z.strictObject({ id: idSchema, name: text, type: scalarTypeSchema, nullable: z.boolean(), default: z.union([z.string(), z.number().finite(), z.boolean(), z.null()]).optional() });
export const resultFieldSchema = z.strictObject({ id: idSchema, name: text, type: scalarTypeSchema, nullable: z.boolean() });
export const querySchema = z.strictObject({ id: idSchema, name: text, sources: z.array(z.strictObject({ alias: text, source: sourceRefSchema })).min(1), joins: z.array(z.strictObject({ leftAlias: text, rightAlias: text, kind: z.enum(['inner', 'left']), cardinality: z.enum(['one-to-one', 'many-to-one', 'one-to-many', 'many-to-many']), on: expressionSchema })), projections: z.array(resultFieldSchema.extend({ expression: expressionSchema })).min(1), parameters: z.array(parameterSchema), where: expressionSchema.optional(), groupBy: z.array(expressionSchema), having: expressionSchema.optional(), orderBy: z.array(z.strictObject({ expression: expressionSchema, direction: z.enum(['asc', 'desc']) })), grain: z.discriminatedUnion('strategy', [z.strictObject({ strategy: z.literal('rows'), keys: ids }), z.strictObject({ strategy: z.literal('grouped'), keys: ids }), z.strictObject({ strategy: z.literal('preaggregated'), keys: ids, sourceAliases: z.array(text).min(1) })]) });
export const policySchema = z.strictObject({ id: idSchema, scope: z.enum(['global', 'page', 'action']), ownerId: idSchema, access: z.enum(['inherit', 'public', 'authenticated']) });
export type DocumentNode = { kind: 'text'; text: string } | { kind: 'element'; tag: 'div' | 'p' | 'span' | 'h1' | 'h2' | 'header' | 'footer' | 'section'; children: DocumentNode[] } | { kind: 'form'; formId: StableId };
export const documentNodeSchema: z.ZodType<DocumentNode> = z.lazy(() => z.discriminatedUnion('kind', [z.strictObject({ kind: z.literal('text'), text: z.string() }), z.strictObject({ kind: z.literal('element'), tag: z.enum(['div', 'p', 'span', 'h1', 'h2', 'header', 'footer', 'section']), children: z.array(documentNodeSchema) }), z.strictObject({ kind: z.literal('form'), formId: idSchema })]));
export const pageSchema = z.strictObject({ id: idSchema, route: text, title: text, document: z.array(documentNodeSchema), formIds: ids, policyId: idSchema.optional() });
export const keyMappingSchema = z.strictObject({ targetFieldId: idSchema, expression: expressionSchema });
export const appearanceSchema = z.strictObject({ label: z.string().optional(), className: z.string().optional(), width: z.number().positive().optional(), format: z.enum(['plain', 'decimal', 'currency', 'date', 'datetime']).optional() });
export const formSchema = z.strictObject({ id: idSchema, pageId: idSchema, kind: z.enum(['Grid', 'Record', 'Search', 'Login']), sourceRef: sourceRefSchema.optional(), keyMapping: z.array(keyMappingSchema), controlIds: ids, actionIds: ids, search: z.array(z.strictObject({ fieldId: idSchema, operator: z.enum(['eq', 'contains', 'gte', 'lte']) })), paging: z.strictObject({ pageSize: z.number().int().min(1).max(200) }), sorting: z.array(z.strictObject({ fieldId: idSchema, direction: z.enum(['asc', 'desc']) })), appearance: appearanceSchema });
export const bindingSchema = z.discriminatedUnion('kind', [z.strictObject({ kind: z.literal('stored'), fieldId: idSchema }), z.strictObject({ kind: z.literal('derived'), expression: expressionSchema, sourceDependencies: ids.min(1) })]);
export const controlSchema = z.strictObject({ id: idSchema, formId: idSchema, kind: z.enum(['label', 'text', 'number', 'date', 'checkbox', 'select', 'link', 'button', 'identity']), binding: bindingSchema.optional(), readOnly: z.boolean(), appearance: appearanceSchema, validation: z.strictObject({ required: z.boolean(), min: z.number().optional(), max: z.number().optional(), maxLength: z.number().int().positive().optional() }), events: z.array(z.strictObject({ event: z.enum(['click', 'change', 'submit']), actionId: idSchema })), lookup: z.strictObject({ source: sourceRefSchema, valueFieldIds: ids.min(1), labelFieldId: idSchema }).optional() });
export const destinationSchema = z.strictObject({ pageId: idSchema, keyMapping: z.array(keyMappingSchema), filterMapping: z.array(keyMappingSchema) });
export const actionSchema = z.strictObject({ id: idSchema, formId: idSchema, operation: z.enum(['insert', 'update', 'delete', 'navigate', 'search', 'login', 'logout', 'cancel', 'extension']), policyId: idSchema.optional(), destination: destinationSchema.optional(), success: destinationSchema.optional(), cancel: destinationSchema.optional(), extensionHookRef: idSchema.optional() });
export const extensionContractSchema = z.strictObject({ id: idSchema, relativePath: text, version: revisionSchema, kind: z.enum(['validator', 'action', 'component']) });
export const projectSchema = z.strictObject({ id: idSchema, formatVersion: z.literal(FORMAT_VERSION), revision: revisionSchema, name: text, target: targetSchema, targetVersion: text, connectionRefs: ids, connections: z.array(connectionSchema), schema: schemaSchema, queries: z.array(querySchema), pages: z.array(pageSchema), forms: z.array(formSchema), controls: z.array(controlSchema), actions: z.array(actionSchema), policies: z.array(policySchema), globalPolicyId: idSchema, outputConfig: z.strictObject({ approvedRootId: idSchema, relativePath: text }), extensionContracts: z.array(extensionContractSchema), identity: z.discriminatedUnion('kind', [z.strictObject({ kind: z.literal('managed'), storeRef: idSchema }), z.strictObject({ kind: z.literal('mapped'), tableId: idSchema, userIdColumnId: idSchema, usernameColumnId: idSchema, passwordHashColumnId: idSchema })]).optional() });
export type Project = z.infer<typeof projectSchema>;
export type Query = z.infer<typeof querySchema>;
export type Table = z.infer<typeof tableSchema>;
export type Form = z.infer<typeof formSchema>;
export type Control = z.infer<typeof controlSchema>;
export type Page = z.infer<typeof pageSchema>;
export type Action = z.infer<typeof actionSchema>;
export type Policy = z.infer<typeof policySchema>;
export type Connection = z.infer<typeof connectionSchema>;
export type Schema = z.infer<typeof schemaSchema>;
