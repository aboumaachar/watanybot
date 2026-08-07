import { MetadataSelect } from './MetadataSelect';

export interface ListingTypeSelectProps {
  value?: string;
  required?: boolean;
  onChange: (value: string) => void;
}

export function ListingTypeSelect({ value = '', required = false, onChange }: ListingTypeSelectProps) {
  return (
    <MetadataSelect
      datasetId="listingTypes"
      label="نوع الإعلان / الخدمة"
      value={value}
      required={required}
      placeholder="اختر نوع الإعلان أو الخدمة"
      onChange={onChange}
    />
  );
}