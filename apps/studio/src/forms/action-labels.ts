import type { Action, Project, StableId, Expression } from '@schema-baron/model';

/** Visible event choices describe their effect; IDs remain the stable option values. */
export function actionChoiceLabel(project: Project, action: Action): string {
 const destination = action.destination ?? action.success;
 if (!destination) return action.operation;
 const page = project.pages.find(page => page.id === destination.pageId);
 const target = page ? `${page.title} (${page.route})` : 'Missing page';
 const fieldName = (id: StableId) => project.schema.tables.flatMap(table => table.columns).find(field => field.id === id)?.physicalName
  ?? project.queries.flatMap(query => query.projections).find(field => field.id === id)?.name ?? 'Missing field';
 const expressionName = (expression: Expression): string => expression.kind === 'field' ? fieldName(expression.fieldId) : expression.kind === 'literal' ? JSON.stringify(expression.value) : expression.kind === 'parameter' ? project.queries.flatMap(query => query.parameters).find(parameter => parameter.id === expression.parameterId)?.name ?? 'Missing parameter' : expression.kind === 'binary' ? `${expressionName(expression.left)} ${expression.operator} ${expressionName(expression.right)}` : expression.kind === 'aggregate' ? `${expression.function}(${expression.argument ? expressionName(expression.argument) : '*'})` : `${expression.function}(${expression.args.map(expressionName).join(', ')})`;
 const mappings = [
  ...destination.keyMapping.map(mapping => `key ${fieldName(mapping.targetFieldId)} ← ${expressionName(mapping.expression)}`),
  ...destination.filterMapping.map(mapping => `filter ${fieldName(mapping.targetFieldId)} ← ${expressionName(mapping.expression)}`),
 ];
 return [`${action.operation} → ${target}`, ...mappings].join(' · ');
}
