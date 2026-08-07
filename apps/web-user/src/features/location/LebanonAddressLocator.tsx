
// ADDRESS_NETWORK_LEGACY_COMPATIBILITY_WRAPPER_REVIEWED
import { useEffect, useMemo, useState } from "react";
import { loadCanonicalRuntime, type CanonicalRuntime } from "../../../../../packages/watany-core/src/shared-engines/address/canonical.loader";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "./lebanon-address-locator.css";

export type LebanonAddressValue = {
  mohafaza: string;
  caza: string;
  village: string;
  exactAddress: string;
  displayAddress: string;
  source?: string;
  status?: string;
  governorateId?: string;
  districtOrEquivalentId?: string;
  localityId?: string;
  locationDatasetVersion?: string;
  locationApprovalStatus?: string;
};

type LebanonAddressLocatorProps = {
  idPrefix?: string;
  namePrefix?: string;
  value?: Partial<LebanonAddressValue>;
  onChange?: (value: LebanonAddressValue) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

export function LebanonAddressLocator({
  idPrefix = "watany-address-locator",
  namePrefix = "address",
  value,
  onChange,
  required = false,
  disabled = false,
  className = "",
}: LebanonAddressLocatorProps) {
  const [runtime, setRuntime] = useState<CanonicalRuntime | null>(null);
  const [mohafaza, setMohafaza] = useState(value?.mohafaza ?? "");
  const [caza, setCaza] = useState(value?.caza ?? "");
  const [village, setVillage] = useState(value?.village ?? "");
  const [exactAddress, setExactAddress] = useState(value?.exactAddress ?? "");

  useEffect(() => {
    let cancelled = false;
    loadCanonicalRuntime().then((loadedRuntime) => {
      if (!cancelled) setRuntime(loadedRuntime);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const mohafazat = useMemo(() => {
    return runtime?.governorates.map((item) => item.nameAr) ?? [];
  }, [runtime]);

  const cazaOptions = useMemo(() => {
    if (!mohafaza) return [];
    const governorate = runtime?.governorates.find((item) => item.nameAr === mohafaza);
    return runtime?.districts.filter((item) => item.governorateId === governorate?.id).map((item) => item.nameAr) ?? [];
  }, [runtime, mohafaza]);

  const villageOptions = useMemo(() => {
    if (!mohafaza || !caza) return [];
    const governorate = runtime?.governorates.find((item) => item.nameAr === mohafaza);
    const district = runtime?.districts.find((item) => item.governorateId === governorate?.id && item.nameAr === caza)
      ?? runtime?.districtEquivalents.find((item) => item.governorateId === governorate?.id && item.nameAr === caza);
    return runtime?.localities.filter((item) => item.districtId === district?.id).map((item) => item.nameAr) ?? [];
  }, [runtime, mohafaza, caza]);

  const selectedGovernorate = runtime?.governorates.find((item) => item.nameAr === mohafaza);
  const selectedDistrict = runtime?.districts.find((item) => item.governorateId === selectedGovernorate?.id && item.nameAr === caza)
    ?? runtime?.districtEquivalents.find((item) => item.governorateId === selectedGovernorate?.id && item.nameAr === caza);
  const selectedLocality = runtime?.localities.find((item) => item.districtId === selectedDistrict?.id && item.nameAr === village);
  const displayAddress = [mohafaza, caza, village, exactAddress].filter(Boolean).join(" - ");

  useEffect(() => {
    onChange?.({ mohafaza, caza, village, exactAddress, displayAddress, source: "universal-locator", status: runtime ? "approvedCanonical" : "loading", governorateId: selectedGovernorate?.id, districtOrEquivalentId: selectedDistrict?.id, localityId: selectedLocality?.id, locationDatasetVersion: runtime?.datasetVersion, locationApprovalStatus: runtime?.approvalStatus });
  }, [mohafaza, caza, village, exactAddress, displayAddress, onChange, runtime, selectedGovernorate, selectedDistrict, selectedLocality]);

  return (
    <section className={`lebanon-address-locator ${className}`} data-watany-address-locator="strict-cascade" dir="rtl">
      <header className="lebanon-address-locator__header">
        <strong>تحديد العنوان</strong>
        <span>المحافظة ثم القضاء ثم البلدة/القرية ثم العنوان التفصيلي</span>
      </header>

      <div className="lebanon-address-locator__grid" data-cascade-order="mohafaza-caza-village-exact-address">
        <label className="lebanon-address-locator__field">
          <span>المحافظة</span>
          <select
            id={`${idPrefix}-mohafaza`}
            value={mohafaza}
            required={required}
            disabled={disabled}
            onChange={(event) => {
              setMohafaza(event.target.value);
              setCaza("");
              setVillage("");
              setExactAddress("");
            }}
          >
            <option value="">اختر المحافظة</option>
            {mohafazat.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>

        {mohafaza ? (
          <label className="lebanon-address-locator__field" data-stage="caza-visible-after-mohafaza">
            <span>القضاء</span>
            <select
              id={`${idPrefix}-caza`}
              value={caza}
              required={required}
              disabled={disabled || !mohafaza}
              onChange={(event) => {
                setCaza(event.target.value);
                setVillage("");
                setExactAddress("");
              }}
            >
              <option value="">اختر القضاء</option>
              {cazaOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        ) : null}

        {mohafaza && caza ? (
          <label className="lebanon-address-locator__field" data-stage="village-visible-after-caza">
            <span>البلدة / القرية</span>
            <select
              id={`${idPrefix}-village`}
              value={village}
              required={required}
              disabled={disabled || !caza}
              onChange={(event) => {
                setVillage(event.target.value);
                setExactAddress("");
              }}
            >
              <option value="">اختر البلدة أو القرية</option>
              {villageOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        ) : null}

        {mohafaza && caza && village ? (
          <label className="lebanon-address-locator__field lebanon-address-locator__field--wide" data-stage="exact-address-visible-after-village">
            <span>العنوان التفصيلي</span>
            <textarea
              id={`${idPrefix}-exact-address`}
              value={exactAddress}
              rows={3}
              required={required}
              disabled={disabled || !village}
              placeholder="مثال: الشارع، المبنى، الطابق، أقرب نقطة دلالة"
              onChange={(event) => setExactAddress(event.target.value)}
            />
          </label>
        ) : null}
      </div>

      <input data-aided-input-hidden-address-mirror="true" type="hidden" name={`${namePrefix}.mohafaza`} value={mohafaza} />
      <input data-aided-input-hidden-address-mirror="true" type="hidden" name={`${namePrefix}.caza`} value={caza} />
      <input data-aided-input-hidden-address-mirror="true" type="hidden" name={`${namePrefix}.village`} value={village} />
      <input data-aided-input-hidden-address-mirror="true" type="hidden" name={`${namePrefix}.exactAddress`} value={exactAddress} />
      <input type="hidden" name={`${namePrefix}.displayAddress`} value={displayAddress} />
    </section>
  );
}

export default LebanonAddressLocator;
