import { MetadataSelect } from './MetadataSelect';

export interface FreelanceSkillSelectProps {
  value?: string;
  required?: boolean;
  onChange: (value: string) => void;
}

export function FreelanceSkillSelect({ value = '', required = false, onChange }: FreelanceSkillSelectProps) {
  return (
    <MetadataSelect
      datasetId="freelanceSkills"
      label="المهارة / الخدمة"
      value={value}
      required={required}
      placeholder="اختر المهارة من القائمة"
      onChange={onChange}
    />
  );
}