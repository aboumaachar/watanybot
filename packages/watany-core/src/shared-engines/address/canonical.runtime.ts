import { loadCanonicalLocatorDataset } from "./canonical.loader";
import type { CanonicalDatasetManifest, CanonicalLocatorCatalog, CanonicalLocatorDataset } from "./canonical.types";

export type CanonicalLocatorRuntimeOptions = Readonly<{
  manifestUrl: string;
  datasetUrl: string;
  fetchImpl?: typeof fetch;
}>;

type CanonicalDatasetPayload = Omit<CanonicalLocatorDataset, "manifest">;

export async function loadCanonicalLocatorRuntime(options: CanonicalLocatorRuntimeOptions): Promise<CanonicalLocatorCatalog> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const [manifestResponse, datasetResponse] = await Promise.all([
    fetchImpl(options.manifestUrl),
    fetchImpl(options.datasetUrl),
  ]);

  if (!manifestResponse.ok) {
    throw new Error(`CANONICAL_MANIFEST_FETCH_${manifestResponse.status}`);
  }
  if (!datasetResponse.ok) {
    throw new Error(`CANONICAL_DATASET_FETCH_${datasetResponse.status}`);
  }

  const [manifestText, datasetText] = await Promise.all([
    manifestResponse.text(),
    datasetResponse.text(),
  ]);

  let manifest: CanonicalDatasetManifest;
  let dataset: CanonicalDatasetPayload;
  try {
    manifest = JSON.parse(manifestText) as CanonicalDatasetManifest;
    dataset = JSON.parse(datasetText) as CanonicalDatasetPayload;
  } catch {
    throw new Error("CANONICAL_RUNTIME_JSON_INVALID");
  }

  if (!dataset || !Array.isArray(dataset.localities) || !Array.isArray(dataset.aliases)) {
    throw new Error("CANONICAL_RUNTIME_SCHEMA_INVALID");
  }

  return loadCanonicalLocatorDataset({
    manifest,
    dataset,
    datasetText,
  });
}