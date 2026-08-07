import React, { useState } from 'react';
import AddressWidget, { type AddressWidgetProps, type AddressWidgetValue } from './AddressWidget';

export type AddressWidgetFieldAdapterProps = Omit<AddressWidgetProps, 'value' | 'onChange' | 'defaults'> & {
  name?: string;
  value?: AddressWidgetValue | null;
  defaultValue?: AddressWidgetValue;
  onChange?: (value: AddressWidgetValue) => void;
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
  errorText?: string;
};

export function AddressWidgetFieldAdapter(props: AddressWidgetFieldAdapterProps) {
  const {
    value,
    defaultValue,
    onChange,
    name,
    required,
    disabled,
    helperText,
    errorText,
    ...widgetProps
  } = props;

  const [internalValue, setInternalValue] = useState<AddressWidgetValue>(() => value ?? defaultValue ?? {});
  const currentValue = value ?? internalValue;

  function handleChange(nextValue: AddressWidgetValue) {
    if (disabled) {
      return;
    }

    if (value == null) {
      setInternalValue(nextValue);
    }

    onChange?.(nextValue);
  }

  const hasSelection = Boolean(
    currentValue.governorateId ||
      currentValue.cazaId ||
      currentValue.municipalityId ||
      currentValue.villageId
  );

  return (
    <div
      data-address-widget-field-adapter={name || 'address'}
      data-address-required={required ? 'true' : 'false'}
      aria-disabled={disabled ? 'true' : undefined}
    >
      <AddressWidget
        {...widgetProps}
        value={currentValue}
        defaults={defaultValue}
        onChange={handleChange}
      />
      <input type="hidden" name={name || 'address'} value={JSON.stringify(currentValue)} readOnly />
      {required ? <input type="hidden" required value={hasSelection ? 'selected' : ''} readOnly /> : null}
      {helperText ? <p data-address-helper-text>{helperText}</p> : null}
      {errorText ? <p data-address-error-text role="alert">{errorText}</p> : null}
    </div>
  );
}

export default AddressWidgetFieldAdapter;