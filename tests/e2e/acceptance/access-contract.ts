import type { BrowserContext, Page } from '@playwright/test';
import type { Project } from '@schema-baron/model';
/** Coordinates belong to private run memory; never serialize credentials or owner roots. */
export type AccessFixture = {
 project: Project; directory: string; database: string; origin: string;
 context: BrowserContext; app: Page; username: string; secret: string;
 rows: () => unknown;
};
