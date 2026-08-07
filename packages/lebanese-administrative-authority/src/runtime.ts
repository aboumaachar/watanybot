import { createAdministrativePlatform } from './platform';
import { validateAuthorityDataset } from './validation';
import type { AuthorityDataset, DatasetManifest, AdministrativePlatform } from './types';

export type RuntimeLoaderOptions = Readonly<{ manifestUrl: string; canonicalUrl: string; aliasesUrl: string; fetchImpl?: typeof fetch }>;

async function readJson<T>(fetchImpl: typeof fetch, url: string): Promise<T> {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`UL2_RUNTIME_HTTP_${response.status}`);
  try { return await response.json() as T; } catch { throw new Error('UL2_RUNTIME_JSON_INVALID'); }
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

export async function loadAdministrativeRuntime(options: RuntimeLoaderOptions): Promise<AdministrativePlatform> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const manifest = await readJson<DatasetManifest>(fetchImpl, options.manifestUrl);
  if (manifest.status !== 'approvedCanonical' || !manifest.releasedAt || manifest.approval.approvedBy.length === 0) throw new Error('UL2_DATASET_NOT_RELEASED');
  const canonicalText = await (await fetchImpl(options.canonicalUrl)).text();
  const aliasesText = await (await fetchImpl(options.aliasesUrl)).text();
  if (await sha256Hex(canonicalText) !== manifest.canonicalSha256) throw new Error('UL2_CANONICAL_HASH_MISMATCH');
  if (await sha256Hex(aliasesText) !== manifest.aliasSha256) throw new Error('UL2_ALIAS_HASH_MISMATCH');
  let canonical: Omit<AuthorityDataset, 'manifest' | 'aliases'>;
  let aliases: AuthorityDataset['aliases'];
  try { canonical = JSON.parse(canonicalText) as Omit<AuthorityDataset, 'manifest' | 'aliases'>; aliases = JSON.parse(aliasesText) as AuthorityDataset['aliases']; } catch { throw new Error('UL2_RUNTIME_SCHEMA_INVALID'); }
  const dataset: AuthorityDataset = { manifest, ...canonical, aliases };
  const validation = validateAuthorityDataset(dataset, manifest.canonicalSha256, manifest.aliasSha256);
  if (!validation.productionReady) throw new Error(`UL2_DATASET_NOT_PRODUCTION_READY:${validation.issues.join(',')}`);
  return createAdministrativePlatform(dataset, validation);
}
