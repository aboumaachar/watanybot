import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AdministrativePlatform } from '../src/types';

const AuthorityContext = createContext<AdministrativePlatform | null>(null);

export function AdministrativeAuthorityProvider({ platform, children }: Readonly<{ platform: AdministrativePlatform | null; children: ReactNode }>) {
  return <AuthorityContext.Provider value={platform}>{children}</AuthorityContext.Provider>;
}

export function useAdministrativeAuthority(): AdministrativePlatform {
  const platform = useContext(AuthorityContext);
  if (!platform) throw new Error('UL2_AUTHORITY_RUNTIME_UNAVAILABLE');
  return platform;
}

export function useAuthorityRuntime(load: () => Promise<AdministrativePlatform>) {
  const [platform, setPlatform] = useState<AdministrativePlatform | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    load().then((next) => { if (active) setPlatform(next); }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason : new Error('UL2_RUNTIME_LOAD_FAILED')); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load]);
  return { platform, error, loading };
}

export function useGovernorates() { return useAdministrativeAuthority().governorates(); }
export function useDistricts(governorateId?: string) { return useAdministrativeAuthority().districts(governorateId); }
export function useMunicipalities(districtId?: string) { return useAdministrativeAuthority().municipalities(districtId); }
export function useLocalities(parentId?: string) { return useAdministrativeAuthority().localities(parentId); }
export function useLocalitySearch(query: string, language?: 'ar' | 'en' | 'fr') { return useAdministrativeAuthority().search(query, { mode: 'contains', language }); }
