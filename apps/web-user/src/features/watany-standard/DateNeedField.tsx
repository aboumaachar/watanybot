'use client';
import { CalendarInput } from '../../components/aided-input';

type Props = {
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  includeTime?: boolean;
};

export function DateNeedField({ label = 'التاريخ المطلوب', value = '', onChange, includeTime = false }: Props) {
  return (
    <label className="watany-card" style={{ display: 'grid', gap: 8 }}>
      <span>{label}</span>
      <CalendarInput label={label} value={value} includeTime={includeTime} onChange={(next) => onChange?.(next)} />
    </label>
  );
}