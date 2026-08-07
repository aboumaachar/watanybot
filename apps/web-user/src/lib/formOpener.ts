/**
 * Unified Form & Document Opener
 * 
 * Centralizes all form/document opening across the application using the
 * Watany Universal Form Viewer. Handles:
 * - HTML forms and documents
 * - PDF files
 * - Word documents
 * - Images
 * - Direct file downloads as fallback
 * 
 * Usage:
 *   openForm({ titleAr: 'النموذج', previewUrl: '/path/to/form.pdf' })
 */

import { openWatanyUniversalFormViewer, type UniversalFormViewerItem } from './watanyUniversalFormViewer';

export type FormItem = UniversalFormViewerItem & {
  preferUniversal?: boolean;
};

/**
 * Open a form or document using the universal viewer
 * @param item Form/document to open
 * @returns true if opened in viewer, false if opened directly
 */
export async function openForm(item: FormItem): Promise<boolean> {
  return openWatanyUniversalFormViewer(item);
}

/**
 * Open multiple forms/documents in sequence
 * @param items Forms/documents to open
 */
export async function openForms(items: FormItem[]): Promise<boolean[]> {
  return Promise.all(items.map((item) => openForm(item)));
}

/**
 * Create a form opener for a specific context (e.g., school forms, procedures)
 * @param contextName Human-readable context name
 * @returns Function to open forms in this context
 */
export function createContextualFormOpener(contextName: string) {
  return async function openContextForm(item: FormItem): Promise<boolean> {
    try {
      const result = await openForm(item);
      console.debug(`[${contextName}] Opened form:`, item.titleAr || item.previewUrl);
      return result;
    } catch (error) {
      console.error(`[${contextName}] Failed to open form:`, error);
      throw error;
    }
  };
}

/**
 * Batch form opener for procedures and catalogs
 * @param contextName Context name for logging
 * @param items Forms to open
 */
export async function batchOpenForms(
  contextName: string,
  items: FormItem[],
): Promise<{ opened: number; failed: number }> {
  let opened = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const result = await openForm(item);
      if (result) opened++;
      else failed++;
    } catch (error) {
      console.error(`[${contextName}] Failed to open:`, item.titleAr, error);
      failed++;
    }
  }

  return { opened, failed };
}

/**
 * Legacy form opener - maintains backward compatibility
 * @deprecated Use openForm() directly
 */
export async function legacyOpenFormWindow(url: string, title?: string): Promise<boolean> {
  return openForm({
    titleAr: title || 'نموذج',
    previewUrl: url,
  });
}
