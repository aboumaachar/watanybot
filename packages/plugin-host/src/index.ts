export type { WatanyFeatureAdapter, WatanyFeatureManifest, WatanyFeatureStatus } from './contracts/feature-contract';
export { registerWatanyFeature, getWatanyFeature, listWatanyFeatureManifests, clearWatanyFeatureRegistryForTests } from './runtime/feature-registry';
export { isWatanyFeatureEnabled } from './runtime/feature-flags';
export type { WatanyFeatureFlagMap } from './runtime/feature-flags';