/**
 * useFormOpener Hook
 * 
 * Provides form opening capabilities with loading state and error handling
 * 
 * Usage:
 *   const { openForm, isLoading, error } = useFormOpener();
 *   
 *   <button onClick={() => openForm({ titleAr: 'النموذج', previewUrl: '/form.pdf' })}>
 *     عرض النموذج
 *   </button>
 */

import { useCallback, useState } from 'react';
import { openWatanyUniversalFormViewer, type UniversalFormViewerItem } from './watanyUniversalFormViewer';

type OpenFormState = {
  isLoading: boolean;
  error: Error | null;
  wasOpened: boolean;
};

export function useFormOpener(contextName?: string) {
  const [state, setState] = useState<OpenFormState>({
    isLoading: false,
    error: null,
    wasOpened: false,
  });

  const openForm = useCallback(
    async (item: UniversalFormViewerItem) => {
      try {
        setState({ isLoading: true, error: null, wasOpened: false });

        const result = await openWatanyUniversalFormViewer(item);

        setState({ isLoading: false, error: null, wasOpened: result });
        if (contextName) {
          console.debug(`[${contextName}] Form opened:`, item.titleAr || item.previewUrl);
        }

        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setState({ isLoading: false, error, wasOpened: false });

        if (contextName) {
          console.error(`[${contextName}] Failed to open form:`, error);
        }

        throw error;
      }
    },
    [contextName],
  );

  const reset = useCallback(() => {
    setState({ isLoading: false, error: null, wasOpened: false });
  }, []);

  return {
    openForm,
    isLoading: state.isLoading,
    error: state.error,
    wasOpened: state.wasOpened,
    reset,
  };
}
