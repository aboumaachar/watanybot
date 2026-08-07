import { useEffect, useMemo, useState } from 'react';
import {
  type AidedCsvRow,
  type AidedDatasetId,
  loadAidedDataset,
  optionFromRow,
  rowIsActive,
} from '../../lib/aidedInputMetadata';

export interface MetadataSelectProps {
  datasetId: AidedDatasetId;
  label: string;
  value?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  filter?: (row: AidedCsvRow) => boolean;
  onChange: (value: string, row?: AidedCsvRow) => void;
}

export function MetadataSelect({
  datasetId,
  label,
  value = '',
  required = false,
  disabled = false,
  placeholder = 'اختر من القائمة',
  filter,
  onChange,
}: MetadataSelectProps) {
  const [rows, setRows] = useState<AidedCsvRow[]>([]);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    loadAidedDataset(datasetId)
      .then((loadedRows) => {
        if (!cancelled) setRows(loadedRows.filter(rowIsActive));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'تعذر تحميل البيانات');
      });

    return () => {
      cancelled = true;
    };
  }, [datasetId]);

  const visibleRows = useMemo(() => {
    return filter ? rows.filter(filter) : rows;
  }, [rows, filter]);

  return (
    <label className="aided-field" data-aided-input="metadata-select" data-aided-dataset={datasetId}>
      <span className="aided-field__label">{label}</span>
      <select
        value={value}
        required={required}
        disabled={disabled || Boolean(error)}
        onChange={(event) => {
          const selected = visibleRows.find((row) => optionFromRow(row, datasetId).value === event.target.value);
          onChange(event.target.value, selected);
        }}
      >
        <option value="">{error || placeholder}</option>
        {visibleRows.map((row) => {
          const option = optionFromRow(row, datasetId);
          return (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}