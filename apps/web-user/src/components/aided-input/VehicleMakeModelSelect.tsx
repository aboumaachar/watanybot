import { useCallback, useState } from 'react';
import { type AidedCsvRow } from '../../lib/aidedInputMetadata';
import { MetadataSelect } from './MetadataSelect';

export interface VehicleValue {
  vehicleType: string;
  make: string;
  model: string;
  year: string;
}

export interface VehicleMakeModelSelectProps {
  value: VehicleValue;
  required?: boolean;
  onChange: (value: VehicleValue) => void;
}

export function VehicleMakeModelSelect({ value, required = false, onChange }: VehicleMakeModelSelectProps) {
  const [selectedMake, setSelectedMake] = useState<string>(value.make);

  const modelFilter = useCallback((row: AidedCsvRow) => {
    const makeMatches = !selectedMake || row.make === selectedMake;
    const typeMatches = !value.vehicleType || row.vehicle_type === value.vehicleType;
    return makeMatches && typeMatches;
  }, [selectedMake, value.vehicleType]);

  return (
    <fieldset className="aided-vehicle" data-aided-input="vehicle-make-model">
      <legend>معلومات السيارة</legend>

      <MetadataSelect
        datasetId="vehicleTypes"
        label="نوع السيارة"
        value={value.vehicleType}
        required={required}
        onChange={(vehicleType) => onChange({ ...value, vehicleType, model: '' })}
      />

      <MetadataSelect
        datasetId="vehicleMakes"
        label="الماركة"
        value={value.make}
        required={required}
        onChange={(make) => {
          setSelectedMake(make);
          onChange({ ...value, make, model: '' });
        }}
      />

      <MetadataSelect
        datasetId="vehicleModels"
        label="الموديل"
        value={value.model}
        required={required}
        filter={modelFilter}
        onChange={(model) => onChange({ ...value, model })}
      />

      <MetadataSelect
        datasetId="vehicleYears"
        label="سنة الصنع"
        value={value.year}
        required={required}
        onChange={(year) => onChange({ ...value, year })}
      />
    </fieldset>
  );
}