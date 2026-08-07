import { useEffect, useMemo, useState } from 'react';
import { type AidedCsvRow, loadAidedDataset, optionFromRow, rowIsActive } from '../../lib/aidedInputMetadata';

export interface VehicleFeatureMultiSelectProps {
  value: string[];
  vehicleType?: string;
  onChange: (value: string[]) => void;
}

export function VehicleFeatureMultiSelect({
  value,
  vehicleType = '',
  onChange,
}: VehicleFeatureMultiSelectProps) {
  const [rows, setRows] = useState<AidedCsvRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadAidedDataset('vehicleFeatures').then((loadedRows) => {
      if (!cancelled) setRows(loadedRows.filter(rowIsActive));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleRows = useMemo(() => {
    return rows.filter((row) => !row.vehicle_type || row.vehicle_type === 'all' || row.vehicle_type === vehicleType);
  }, [rows, vehicleType]);

  return (
    <fieldset className="aided-vehicle-features" data-aided-input="vehicle-feature-multi-select">
      <legend>مزايا السيارة</legend>
      {visibleRows.map((row) => {
        const option = optionFromRow(row, 'vehicleFeatures');
        const checked = value.includes(option.value);
        return (
          <label key={option.value} className="aided-check">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => {
                if (event.target.checked) {
                  onChange([...value, option.value]);
                } else {
                  onChange(value.filter((entry) => entry !== option.value));
                }
              }}
            />
            <span>{option.label}</span>
          </label>
        );
      })}
    </fieldset>
  );
}