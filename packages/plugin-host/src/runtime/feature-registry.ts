import type { WatanyFeatureAdapter, WatanyFeatureManifest } from '../contracts/feature-contract';

const registry = new Map<string, WatanyFeatureAdapter>();

export function registerWatanyFeature(adapter: WatanyFeatureAdapter): void {
  if (!adapter || !adapter.manifest || !adapter.manifest.key) {
    throw new Error('Invalid Watany feature adapter. Missing manifest.key.');
  }
  registry.set(adapter.manifest.key, adapter);
}

export function getWatanyFeature(key: string): WatanyFeatureAdapter | undefined {
  return registry.get(key);
}

export function listWatanyFeatureManifests(): WatanyFeatureManifest[] {
  return Array.from(registry.values()).map((adapter) => adapter.manifest);
}

export function clearWatanyFeatureRegistryForTests(): void {
  registry.clear();
}