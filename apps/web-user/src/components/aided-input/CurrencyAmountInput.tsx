import { MetadataSelect } from './MetadataSelect';

export interface CurrencyAmountValue {
  amount: string;
  currency: string;
}

export interface CurrencyAmountInputProps {
  value: CurrencyAmountValue;
  required?: boolean;
  onChange: (value: CurrencyAmountValue) => void;
}

export function CurrencyAmountInput({ value, required = false, onChange }: CurrencyAmountInputProps) {
  return (
    <fieldset className="aided-currency-amount" data-aided-input="currency-amount">
      <legend>المبلغ</legend>
      <label className="aided-field">
        <span className="aided-field__label">القيمة</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={value.amount}
          required={required}
          onChange={(event) => onChange({ ...value, amount: event.target.value })}
        />
      </label>
      <MetadataSelect
        datasetId="currencies"
        label="العملة"
        value={value.currency}
        required={required}
        onChange={(currency) => onChange({ ...value, currency })}
      />
    </fieldset>
  );
}