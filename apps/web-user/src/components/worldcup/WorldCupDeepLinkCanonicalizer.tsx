import { useEffect } from 'react';

const WORLD_CUP_ALIAS_PREFIXES = ['/worldcup', '/worldcups'];

function normalizeMcpBase(baseUrl: string): string {
  const fallback = '/mcp/';
  const raw = baseUrl || fallback;
  const withLeading = raw.startsWith('/') ? raw : `/${raw}`;
  return withLeading.endsWith('/') ? withLeading.slice(0, -1) : withLeading;
}

function normalizeWorldCupAliasPath(pathname: string, baseUrl: string): string | null {
  const base = normalizeMcpBase(baseUrl);
  let localPath = pathname;

  if (localPath === base || localPath === `${base}/`) {
    return null;
  }

  if (localPath.startsWith(`${base}/`)) {
    localPath = localPath.slice(base.length);
  }

  for (const aliasPrefix of WORLD_CUP_ALIAS_PREFIXES) {
    if (localPath === aliasPrefix || localPath.startsWith(`${aliasPrefix}/`)) {
      const suffix = localPath.slice(aliasPrefix.length);
      return `${base}/world-cup${suffix || ''}`;
    }
  }

  return null;
}

export function getCanonicalWorldCupMcpPath(pathname: string, baseUrl = import.meta.env.BASE_URL): string | null {
  return normalizeWorldCupAliasPath(pathname, baseUrl);
}

export function WorldCupDeepLinkCanonicalizer() {
  useEffect(() => {
    const canonicalPath = getCanonicalWorldCupMcpPath(window.location.pathname);
    if (!canonicalPath || canonicalPath === window.location.pathname) {
      return;
    }

    const nextUrl = `${canonicalPath}${window.location.search}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', nextUrl);
    window.dispatchEvent(new CustomEvent('watanybot:worldcup-route-canonicalized', {
      detail: {
        canonicalPath,
        sourcePath: window.location.pathname,
      },
    }));
  }, []);

  return null;
}
