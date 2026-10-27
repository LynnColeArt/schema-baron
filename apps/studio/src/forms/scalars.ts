export interface ScalarBuffer {
  text: string;
  optional: boolean;
  min?: number | undefined;
  max?: number | undefined;
  positive?: boolean | undefined;
  integer?: boolean | undefined;
}
export type ScalarBuffers = Record<string, ScalarBuffer>;
export const scalarObjectId = (key: string) =>
  key.slice(0, key.lastIndexOf(":"));
export function completeScalar(buffer: ScalarBuffer): boolean {
  if (buffer.text === "") return buffer.optional;
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(buffer.text))
    return false;
  const value = Number(buffer.text);
  return (
    Number.isFinite(value) &&
    (!buffer.positive || value > 0) &&
    (!buffer.integer || Number.isInteger(value)) &&
    (buffer.min === undefined || value >= buffer.min) &&
    (buffer.max === undefined || value <= buffer.max)
  );
}
export function scalarIssues(buffers: ScalarBuffers | undefined) {
  return Object.entries(buffers ?? {})
    .filter(([, buffer]) => !completeScalar(buffer))
    .map(([key, buffer]) => ({
      objectId: key.slice(0, key.lastIndexOf(":")),
      field: key.slice(key.lastIndexOf(":") + 1),
      message: `${key.slice(key.lastIndexOf(":") + 1)}: ${buffer.text === "" ? "Enter a value" : buffer.positive ? "Enter a positive number" : buffer.min !== undefined || buffer.max !== undefined ? `Enter a number from ${buffer.min ?? "−∞"} to ${buffer.max ?? "∞"}` : "Complete the numeric value"}${buffer.integer ? " (whole numbers only)" : ""}. Your text is retained.`,
    }));
}
export function incompleteScalars(buffers: ScalarBuffers | undefined): boolean {
  return scalarIssues(buffers).length > 0;
}
