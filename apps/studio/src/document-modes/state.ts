import { z } from 'zod';
import { idSchema } from '@schema-baron/model';
export const documentBufferSchema = z.strictObject({
  text: z.string().max(1000000),
  // Canonical serializer output observed on open/apply. Detects model changes,
  // including ordinary control insertion/deletion and unrelated remote revisions.
  baseline: z.string().max(250000),
  appliedText: z.string().max(250000),
  start: z.number().int().min(0).max(1000000),
  end: z.number().int().min(0).max(1000000),
  scroll: z.number().finite().min(0).max(10000000),
  horizontalScroll: z.number().finite().min(0).max(10000000).optional(),
  focus: z.boolean(),
});
export const documentBuffersSchema = z.record(idSchema, documentBufferSchema).refine(v => Object.keys(v).length <= 1000);
export type DocumentBuffer = z.infer<typeof documentBufferSchema>;
export type DocumentBuffers = Record<string, DocumentBuffer>;
export const pendingDocuments = (buffers: DocumentBuffers | undefined): boolean => Object.values(buffers ?? {}).some(b => b.text !== b.appliedText);
export const freshBuffer = (text: string): DocumentBuffer => ({ text, baseline: text, appliedText: text, start: 0, end: 0, scroll: 0, focus: false });
