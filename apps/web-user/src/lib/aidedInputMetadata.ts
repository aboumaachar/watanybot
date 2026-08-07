export type AidedCsvRow = Record<string, string>;

export type AidedDatasetId =
  | 'vehicleTypes'
  | 'vehicleMakes'
  | 'vehicleModels'
  | 'vehicleYears'
  | 'vehicleFeatures'
  | 'freelanceSkills'
  | 'listingTypes'
  | 'jobCategories'
  | 'contactMethods'
  | 'eligibilityTypes'
  | 'workflowStatuses'
  | 'currencies'
  | 'educationLevels';

export interface AidedDatasetDefinition {
  id: AidedDatasetId;
  url: string;
  labelColumn: string;
  valueColumn: string;
}

export const AIDED_DATASETS: Record<AidedDatasetId, AidedDatasetDefinition> = {
  vehicleTypes: { id: 'vehicleTypes', url: '/data/aided-input/vehicle-types.csv', labelColumn: 'arabic_label', valueColumn: 'vehicle_type' },
  vehicleMakes: { id: 'vehicleMakes', url: '/data/aided-input/vehicle-makes.csv', labelColumn: 'arabic_label', valueColumn: 'make' },
  vehicleModels: { id: 'vehicleModels', url: '/data/aided-input/vehicle-models.csv', labelColumn: 'arabic_label', valueColumn: 'model' },
  vehicleYears: { id: 'vehicleYears', url: '/data/aided-input/vehicle-years.csv', labelColumn: 'year', valueColumn: 'year' },
  vehicleFeatures: { id: 'vehicleFeatures', url: '/data/aided-input/vehicle-features.csv', labelColumn: 'arabic_label', valueColumn: 'feature_id' },
  freelanceSkills: { id: 'freelanceSkills', url: '/data/aided-input/freelance-skills.csv', labelColumn: 'arabic_label', valueColumn: 'skill_id' },
  listingTypes: { id: 'listingTypes', url: '/data/aided-input/listing-types.csv', labelColumn: 'arabic_label', valueColumn: 'listing_type' },
  jobCategories: { id: 'jobCategories', url: '/data/aided-input/job-categories.csv', labelColumn: 'arabic_label', valueColumn: 'job_category' },
  contactMethods: { id: 'contactMethods', url: '/data/aided-input/contact-methods.csv', labelColumn: 'arabic_label', valueColumn: 'method' },
  eligibilityTypes: { id: 'eligibilityTypes', url: '/data/aided-input/eligibility-types.csv', labelColumn: 'arabic_label', valueColumn: 'eligibility_type' },
  workflowStatuses: { id: 'workflowStatuses', url: '/data/aided-input/workflow-statuses.csv', labelColumn: 'arabic_label', valueColumn: 'status' },
  currencies: { id: 'currencies', url: '/data/aided-input/currencies.csv', labelColumn: 'arabic_label', valueColumn: 'currency' },
  educationLevels: { id: 'educationLevels', url: '/data/aided-input/education-levels.csv', labelColumn: 'arabic_label', valueColumn: 'education_level' },
};

const csvCache = new Map<string, Promise<AidedCsvRow[]>>();

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

export function parseCsv(text: string): AidedCsvRow[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce<AidedCsvRow>((row, header, index) => {
      row[header] = values[index] ?? '';
      return row;
    }, {});
  });
}

export async function loadCsvUrl(url: string): Promise<AidedCsvRow[]> {
  if (!csvCache.has(url)) {
    csvCache.set(url, fetch(url, { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load aided-input metadata ${url}: ${response.status}`);
      }
      return parseCsv(await response.text());
    }));
  }

  return csvCache.get(url)!;
}

export async function loadAidedDataset(datasetId: AidedDatasetId): Promise<AidedCsvRow[]> {
  const definition = AIDED_DATASETS[datasetId];
  return loadCsvUrl(definition.url);
}

export function rowIsActive(row: AidedCsvRow): boolean {
  const active = row.active;
  return active === undefined || active === '' || active.toLowerCase() === 'true' || active === '1';
}

export function optionFromRow(row: AidedCsvRow, datasetId: AidedDatasetId): { label: string; value: string } {
  const definition = AIDED_DATASETS[datasetId];
  const value = row[definition.valueColumn] || row.id || row.value || '';
  const label = row[definition.labelColumn] || row.label || value;
  return { label, value };
}