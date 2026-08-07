export interface CalendarInputProps {
  label: string;
  value?: string;
  min?: string;
  max?: string;
  includeTime?: boolean;
  required?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function CalendarInput({
  label,
  value = '',
  min,
  max,
  includeTime = false,
  required = false,
  disabled = false,
  onChange,
}: CalendarInputProps) {
  return (
    <label className="aided-field" data-aided-input="calendar">
      <span className="aided-field__label">{label}</span>
      <input
        type={includeTime ? 'datetime-local' : 'date'}
        value={value}
        min={min}
        max={max}
        required={required}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}