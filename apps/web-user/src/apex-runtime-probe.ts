/*
APEX V2.5.1 runtime reconstruction probe.
ASCII-only. Safe no-op diagnostic module.
*/
declare global {
  interface Window {
    __APEX_WATANY_RUNTIME_PROBE__?: {
      loaded: boolean;
      loadedAt: string;
      rootExists: boolean;
      rootChildCount: number;
      locationPath: string;
      title: string;
    };
  }
}

export function apexWatanyRuntimeProbeSnapshot() {
  const root = document.getElementById('root');
  return {
    loaded: true,
    loadedAt: new Date().toISOString(),
    rootExists: !!root,
    rootChildCount: root ? root.children.length : 0,
    locationPath: window.location.pathname,
    title: document.title || ''
  };
}

if (typeof window !== 'undefined') {
  window.__APEX_WATANY_RUNTIME_PROBE__ = apexWatanyRuntimeProbeSnapshot();
  window.addEventListener('error', function(event) {
    try {
      const prior = window.__APEX_WATANY_RUNTIME_PROBE__;
      window.__APEX_WATANY_RUNTIME_PROBE__ = Object.assign({}, prior, {
        lastError: event && event.message ? String(event.message) : 'unknown'
      });
    } catch (_err) {}
  });
}