import { z } from 'zod';
/** Shared without importing project schemas, so feature contracts stay acyclic. */
export const idSchema = z.string().min(1).max(256).brand<'StableId'>();

export type StableId = z.infer<typeof idSchema>;
