import { useEffect, useMemo, useState } from 'react';
import { loadCanonicalRuntime, type CanonicalRuntime } from '../../../../../packages/watany-core/src/shared-engines/address/canonical.loader';

export interface AddressValue {
  muhafaza: string;
  qaza: string;
  village: string;
  exactAddress?: string;
}

export interface AddressPickerProps {
  value: AddressValue;
  required?: boolean;
  includeExactAddress?: boolean;
  onChange: (value: AddressValue) => void;
}

export function AddressPicker({
  value,
  required = false,
  includeExactAddress = true,
  onChange,
}: AddressPickerProps) {
  const [runtime, setRuntime] = useState<CanonicalRuntime | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    loadCanonicalRuntime()
      .then((loadedRuntime) => {
        if (!cancelled) setRuntime(loadedRuntime);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'تعذر تحميل العناوين');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const muhafazas = useMemo(() => {
    return runtime?.governorates.map((item) => item.nameAr).sort((a, b) => a.localeCompare(b, 'ar')) ?? [];
  }, [runtime]);

  const qazas = useMemo(() => {
    const governorate = runtime?.governorates.find((item) => item.nameAr === value.muhafaza);
    return runtime?.districts.filter((item) => item.governorateId === governorate?.id).map((item) => item.nameAr).sort((a, b) => a.localeCompare(b, 'ar')) ?? [];
  }, [runtime, value.muhafaza]);

  const villages = useMemo(() => {
    const governorate = runtime?.governorates.find((item) => item.nameAr === value.muhafaza);
    const district = runtime?.districts.find((item) => item.governorateId === governorate?.id && item.nameAr === value.qaza);
    return runtime?.localities.filter((item) => item.districtId === district?.id).map((item) => item.nameAr).sort((a, b) => a.localeCompare(b, 'ar')) ?? [];
  }, [runtime, value.muhafaza, value.qaza]);

  return (
    <fieldset className="aided-address" data-aided-input="address-picker">
      <legend>العنوان</legend>
      {error ? <p role="alert">{error}</p> : null}

      <label className="aided-field">
        <span className="aided-field__label">المحافظة</span>
        <select
          value={value.muhafaza}
          required={required}
          onChange={(event) => onChange({ muhafaza: event.target.value, qaza: '', village: '', exactAddress: value.exactAddress })}
        >
          <option value="">اختر المحافظة</option>
          {muhafazas.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>

      <label className="aided-field">
        <span className="aided-field__label">القضاء</span>
        <select
          value={value.qaza}
          required={required}
          disabled={!value.muhafaza}
          onChange={(event) => onChange({ ...value, qaza: event.target.value, village: '' })}
        >
          <option value="">اختر القضاء</option>
          {qazas.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>

      <label className="aided-field">
        <span className="aided-field__label">البلدة / القرية</span>
        <select
          value={value.village}
          required={required}
          disabled={!value.qaza}
          onChange={(event) => onChange({ ...value, village: event.target.value })}
        >
          <option value="">اختر البلدة</option>
          {villages.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>

      {includeExactAddress ? (
        <label className="aided-field">
          <span className="aided-field__label">تفاصيل إضافية اختيارية</span>
          <input
            type="text"
            value={value.exactAddress ?? ''}
            placeholder="الشارع، البناية، الطابق عند الحاجة"
            onChange={(event) => onChange({ ...value, exactAddress: event.target.value })}
          />
        </label>
      ) : null}
    </fieldset>
  );
}