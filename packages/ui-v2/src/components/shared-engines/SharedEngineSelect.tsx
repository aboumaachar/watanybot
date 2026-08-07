import type { ChangeEvent } from "react";

export interface SharedEngineOption {
  id: string;
  label: string;
}

export interface SharedEngineSelectProps {
  id: string;
  label: string;
  value?: string;
  options: SharedEngineOption[];
  disabled?: boolean;
  onChange?: (value: string) => void;
}

export function SharedEngineSelect(props: SharedEngineSelectProps) {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    props.onChange?.(event.target.value);
  };

  return (
    <label className="watany-field" htmlFor={props.id}>
      <span className="watany-field-label">{props.label}</span>
      <select
        id={props.id}
        className="watany-select"
        value={props.value ?? ""}
        disabled={props.disabled}
        onChange={handleChange}
      >
        <option value="">اختر</option>
        {props.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
